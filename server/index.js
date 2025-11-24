import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- FIREBASE SETUP ---
// --- FIREBASE SETUP ---
import { applicationDefault } from 'firebase-admin/app';

let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    credential = cert(serviceAccount);
} else {
    // Use Application Default Credentials (ADC) for Cloud Run
    credential = applicationDefault();
}

initializeApp({
    credential,
    projectId: 'collab-inn' // Explicitly set project ID for ADC
});
const db = getFirestore();

// --- AWS S3 SETUP ---
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// --- ROUTES ---

// --- AUTHENTICATION MIDDLEWARE ---
const MASTER_ADMIN = { user: 'admin', pass: 'admin123' };
const appId = 'my-event-v1';

const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Check master admin
    if (username === MASTER_ADMIN.user && password === MASTER_ADMIN.pass) {
        req.user = { role: 'admin', name: 'Master' };
        return next();
    }

    // Check database admins
    try {
        const snapshot = await db.collection('artifacts').doc(appId)
            .collection('public').doc('data')
            .collection('customers')
            .where('name', '==', username)
            .where('password', '==', password)
            .get();

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            if (userData.role === 'admin' || userData.role === 'admin-read') {
                req.user = { role: userData.role, name: userData.name };
                return next();
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
    }

    return res.status(401).json({ error: 'Invalid credentials' });
};

// 1. Get Pre-signed URL for S3 Upload
app.post('/api/upload/sign', async (req, res) => {
    try {
        const { fileName, fileType, folder } = req.body;
        if (!fileName || !fileType) return res.status(400).json({ error: 'Missing fileName or fileType' });

        const safeFolder = folder ? folder.replace(/[^a-zA-Z0-9-_]/g, '') : 'default';
        const key = `uploads/${safeFolder}/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({
            uploadUrl: signedUrl,
            key: key,
            publicUrl: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
        });
    } catch (error) {
        console.error('S3 Sign Error:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
