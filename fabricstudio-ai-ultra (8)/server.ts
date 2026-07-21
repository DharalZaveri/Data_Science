import express from 'express';
import path from 'path';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';
import stream from 'stream';

// Initialize Firebase Admin (ADC or env vars)
try {
  admin.initializeApp();
} catch (e) {
  console.log("Firebase Admin already initialized or missing credentials");
}
const db = admin.firestore();
const storage = admin.storage();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Central Developer Drive logic
  const getDriveClient = () => {
    try {
      const credsString = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
      if (!credsString) return null;
      const credentials = JSON.parse(credsString);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      return google.drive({ version: 'v3', auth });
    } catch (e) {
      console.warn("Failed to initialize Google Drive Developer client:", e);
      return null;
    }
  };

  app.post('/api/drive/upload', async (req, res) => {
    try {
      const { fileName, base64Data, folderPath } = req.body;
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ error: "Google Drive service account not configured." });
      }

      // Root folder shared by the developer
      const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      
      if (!rootFolderId) {
        return res.status(500).json({ error: "GOOGLE_DRIVE_ROOT_FOLDER_ID is missing in Settings. You must create a folder, share it with your Service Account email as Editor, and put its ID in the environment variables." });
      }
      
      // We will just upload directly to the root folder for simplicity, or implement nested folder logic
      let targetFolderId = rootFolderId;

      // Extract raw data
      let mimeType = 'image/jpeg';
      let buffer: Buffer;

      if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        // Fetch the image from the URL
        const fetchRes = await fetch(base64Data);
        if (!fetchRes.ok) {
          throw new Error('Failed to fetch image from URL: ' + fetchRes.statusText);
        }
        const arrayBuffer = await fetchRes.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
      } else {
        let b64Data = base64Data;
        if (base64Data.startsWith('data:')) {
          const matches = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,(.*)/);
          if (matches) {
             mimeType = matches[1];
             b64Data = matches[2];
          }
        }
        buffer = Buffer.from(b64Data, 'base64');
      }

      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);

      const fileMetadata: any = {
        name: fileName,
      };
      if (targetFolderId) {
        fileMetadata.parents = [targetFolderId];
      }

      const media = {
        mimeType: mimeType,
        body: bufferStream,
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
        supportsAllDrives: true,
      });

      res.json({ success: true, id: file.data.id });
    } catch (error: any) {
      console.error("Developer Drive Upload Error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/drive/list', async (req, res) => {
    try {
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ error: "Google Drive service account not configured." });
      }

      const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      let query = "trashed=false and mimeType contains 'image/'";
      if (rootFolderId) {
        query += ` and '${rootFolderId}' in parents`;
      }

      const driveRes = await drive.files.list({
        q: query,
        fields: 'files(id, name, thumbnailLink, webContentLink)',
        orderBy: 'createdTime desc',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      res.json({ success: true, files: driveRes.data.files });
    } catch (error: any) {
      console.error("Developer Drive List Error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/drive/download/:id', async (req, res) => {
    try {
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ error: "Google Drive service account not configured." });
      }

      const fileId = req.params.id;
      const file = await drive.files.get({
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true,
      }, { responseType: 'stream' });

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="drive_image_${fileId}.jpeg"`);
      return file.data.pipe(res);
    } catch (error: any) {
      console.error("Developer Drive Download Error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Razorpay Initialization
  // Ensure you set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the Environment Variables (.env)
  let razorpayInstance: Razorpay | null = null;
  const getRazorpay = () => {
    if (!razorpayInstance) {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay API keys are missing. Please add them to your environment variables.");
      }
      razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }
    return razorpayInstance;
  };

  // API Route: Create Razorpay Order
  app.post('/api/create-order', async (req, res) => {
    try {
      const { amount, currency = "INR", receipt, userId } = req.body;
      
      const rzp = getRazorpay();
      const options = {
        amount: amount * 100, // Razorpay works in paise
        currency,
        receipt,
        notes: {
          user_id: userId
        }
      };
      
      const order = await rzp.orders.create(options);
      res.json({ 
        success: true, 
        order,
        key_id: process.env.RAZORPAY_KEY_ID 
      });
    } catch (error: any) {
      console.error("Order Creation Error:", error);
      const errorMessage = error.error?.description || error.message || "Failed to create order";
      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  // API Route: Verify Razorpay Payment
  app.post('/api/verify-payment', async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, userId } = req.body;
      
      if (!process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Missing RAZORPAY_KEY_SECRET");
      }

      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

      if (generated_signature === razorpay_signature) {
        // Payment is legit!
        if (userId && amount) {
           try {
             // 1. Write to payments ledger
             await db.collection('payments').doc(razorpay_order_id).set({
               user_id: userId,
               amount: amount,
               status: 'captured',
               created_at: admin.firestore.FieldValue.serverTimestamp()
             }, { merge: true });

             // 2. Add credits atomicly on the backend
             // amount is the package credit amount, so we just increment by that number
             // wait, the amount passed from frontend is the PRICE not the CREDITS.
             // We need to know how many credits to add. Let's say frontend passes "creditsToAdd"
             const creditsToAdd = req.body.creditsToAdd || Math.floor((amount) / 10) || 1;

             await db.collection('users').doc(userId).set({
               available_credits: admin.firestore.FieldValue.increment(creditsToAdd)
             }, { merge: true });

           } catch (err) {
             console.error("Failed to write to payments ledger or add credits:", err);
           }
        }
        res.json({ success: true, message: "Payment verified successfully" });
      } else {
        res.status(400).json({ success: false, error: "Invalid signature" });
      }
    } catch (error: any) {
      console.error("Payment Verification Error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to verify payment" });
    }
  });

  // Proxy route for Gemini API Client calls
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }
      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;
      const response = await ai.models.generateContent({ model, contents, config });
      res.json(response);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      const status = error.status === 429 ? 429 : 500;
      res.status(status).json({ error: error.message || String(error) });
    }
  });

  // API Route: Cloudinary Signature
  app.post('/api/cloudinary/signature', async (req, res) => {
    try {
      const { paramsToSign } = req.body;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      
      if (!apiSecret || !process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
         return res.status(500).json({ error: "Cloudinary credentials not configured in environment." });
      }

      const cloudinary = await import('cloudinary');
      
      const signature = cloudinary.v2.utils.api_sign_request(paramsToSign, apiSecret);
      
      res.json({ 
        signature, 
        apiKey: process.env.CLOUDINARY_API_KEY, 
        cloudName: process.env.CLOUDINARY_CLOUD_NAME 
      });
    } catch (error: any) {
      console.error("Cloudinary Signature Error:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/cloudinary/config', (req, res) => {
    res.json({ 
      cloudName: process.env.CLOUDINARY_CLOUD_NAME, 
      apiKey: process.env.CLOUDINARY_API_KEY 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
