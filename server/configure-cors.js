import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const corsRules = [
    {
        AllowedHeaders: ["*"],
        AllowedMethods: ["PUT", "POST", "GET"],
        AllowedOrigins: ["http://localhost:5173", "http://localhost:3000", "*"], // Allow localhost and all for dev
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3000,
    },
];

const run = async () => {
    try {
        const command = new PutBucketCorsCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            CORSConfiguration: { CORSRules: corsRules },
        });
        await client.send(command);
        console.log("✅ S3 CORS Configured Successfully!");
        console.log("Allowed Origins:", corsRules[0].AllowedOrigins);
    } catch (err) {
        console.error("❌ Error configuring CORS:", err);
    }
};

run();
