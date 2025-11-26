import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Use environment variable in production (Cloud Run)
        console.log('Using Firebase credentials from environment variable');
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        // Use file in local development
        console.log('Using Firebase credentials from service-account.json');
        serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
    }
} catch (error) {
    console.error('Error reading service account:', error);
    process.exit(1);
}

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const appId = 'my-event-v1'; // Your app ID

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');

        // Fetch admin user from Firestore
        const adminDoc = await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('customers').doc(username).get();

        if (!adminDoc.exists) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const adminData = adminDoc.data();

        // Check password and role
        if (adminData.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!adminData.role || (!adminData.role.startsWith('admin'))) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Attach user info to request
        req.user = {
            id: username,
            role: adminData.role,
            ...adminData
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// 1. Get Pre-signed URL for S3 Upload
app.post('/api/upload/sign', async (req, res) => {
    try {
        const { fileName, fileType, customerId } = req.body;

        if (!fileName || !fileType || !customerId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const key = `uploads/${customerId}/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${key}`;

        res.json({ signedUrl, fileUrl });
    } catch (error) {
        console.error('S3 Upload Sign Error:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

// 1.5 Get Pre-signed URL for S3 Read (Viewing)
app.post('/api/sign-read', async (req, res) => {
    try {
        const { fileUrl } = req.body;
        if (!fileUrl) return res.status(400).json({ error: 'Missing fileUrl' });

        // Robust Key Extraction using URL object
        try {
            const urlObj = new URL(fileUrl);
            // Check if it's our bucket
            if (!urlObj.hostname.includes(process.env.S3_BUCKET_NAME)) {
                return res.json({ signedUrl: fileUrl });
            }
            // Extract key (remove leading slash and decode)
            const key = decodeURIComponent(urlObj.pathname.substring(1));

            const command = new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: key
            });

            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            console.log(`Signed URL generated for key: ${key}`);
            res.json({ signedUrl });
        } catch (e) {
            console.error('URL Parsing Error:', e);
            return res.json({ signedUrl: fileUrl });
        }
    } catch (error) {
        console.error('S3 Read Sign Error:', error);
        res.status(500).json({ error: 'Failed to generate read URL' });
    }
});

// 2. Get S3 Stats for Customer
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

app.get('/api/stats/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const prefix = `uploads/${customerId}/`;

        let totalBytes = 0;
        let fileCount = 0;
        let continuationToken = undefined;

        do {
            const command = new ListObjectsV2Command({
                Bucket: process.env.S3_BUCKET_NAME,
                Prefix: prefix,
                ContinuationToken: continuationToken
            });
            const response = await s3Client.send(command);

            if (response.Contents) {
                fileCount += response.Contents.length;
                totalBytes += response.Contents.reduce((acc, item) => acc + (item.Size || 0), 0);
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        res.json({
            customerId,
            fileCount,
            totalBytes,
            sizeMB: (totalBytes / (1024 * 1024)).toFixed(2)
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// 2. Submit Message (Write to Firestore via Server)
app.post('/api/messages', async (req, res) => {
    try {
        const { customerId, sender, text, imageUrl, type, userId } = req.body;

        if (!customerId || !sender || !text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newMessage = {
            customerId,
            sender,
            text,
            image: imageUrl || null, // Store the S3 URL
            type: type || 'text',
            status: 'pending',
            timestamp: new Date(), // Firestore Admin uses native Date or Timestamp
            userId: userId || 'anon'
        };

        // Add to Firestore
        const docRef = await db.collection('artifacts').doc('my-event-v1')
            .collection('public').doc('data')
            .collection('messages').add(newMessage);

        res.json({ success: true, id: docRef.id });
    } catch (error) {
        console.error('Message Submit Error:', error);
        res.status(500).json({ error: 'Failed to submit message' });
    }
});

// 3. Health Check
app.get('/', (req, res) => {
    res.send('Event Cast Server Running');
});

// --- ADMIN ENDPOINTS ---

// Get all customers (admin only)
app.get('/api/admin/customers', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('customers').get();

        const customers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(customers);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Create customer (admin only)
app.post('/api/admin/customers', authenticateAdmin, async (req, res) => {
    try {
        if (req.user.role === 'admin-read') {
            return res.status(403).json({ error: 'Read-only access' });
        }

        const { id, name, password, role, disabled, settings, headerTitle, backgroundImage } = req.body;

        if (!id || !name || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('customers').doc(id).set({
                name,
                password,
                role: role || 'customer',
                disabled: disabled || false,
                settings: settings || { imgTimer: 5, textTimer: 5, imgCount: 3, textCount: 5 },
                headerTitle: headerTitle || '',
                backgroundImage: backgroundImage || null,
                createdAt: new Date()
            });

        res.json({ success: true, id });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Update customer (admin only)
app.put('/api/admin/customers/:id', authenticateAdmin, async (req, res) => {
    try {
        if (req.user.role === 'admin-read') {
            return res.status(403).json({ error: 'Read-only access' });
        }

        const { id } = req.params;
        const updates = req.body;

        await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('customers').doc(id).update(updates);

        res.json({ success: true });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Delete customer (admin only)
app.delete('/api/admin/customers/:id', authenticateAdmin, async (req, res) => {
    try {
        if (req.user.role === 'admin-read') {
            return res.status(403).json({ error: 'Read-only access' });
        }

        const { id } = req.params;

        await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('customers').doc(id).delete();

        res.json({ success: true });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

// --- SOCKET.IO SETUP ---
import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });

    socket.on('send_emoji', (data) => {
        // data: { customerId, emoji }
        // Broadcast to everyone in the room (StageView)
        io.to(data.customerId).emit('new_emoji', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Use httpServer.listen instead of app.listen
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
