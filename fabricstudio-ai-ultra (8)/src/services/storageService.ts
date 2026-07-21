import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

export const hashString = (str: string): string => {
  if (!str) return 'empty';
  let hash = 0;
  for (let i = 0; i < str.length && i < 5000; i += 10) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash).toString(16);
};

export const compressBase64Image = (base64Str: string, maxDim = 800, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    // Do not set crossOrigin for data or blob URLs so we don't taint the canvas unnecessarily
    if (!base64Str.startsWith('data:') && !base64Str.startsWith('blob:')) {
       img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          // If no context, fallback to transparent pixel
          resolve(base64Str.startsWith('data:') && base64Str.length > 500000 ? "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" : base64Str);
        }
      } catch (err) {
        resolve(base64Str.startsWith('data:') && base64Str.length > 500000 ? "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" : base64Str);
      }
    };
    img.onerror = () => resolve(base64Str.startsWith('data:') && base64Str.length > 500000 ? "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" : base64Str);
    img.src = base64Str;
  });
};

async function fetchUrlAsBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to fetch image as base64:", e);
    return url;
  }
}

async function uploadToStorage(userId: string, base64Data: string, prefix: string = 'image'): Promise<string> {
  // If it's not base64, assume it's already a URL and return it
  if (!base64Data.startsWith('data:')) {
    return base64Data;
  }
  
  try {
    const timestamp = Math.round((new Date).getTime() / 1000);
    const paramsToSign: Record<string, any> = {
      timestamp: timestamp,
      folder: `catalog_studio/${userId}/${prefix}`
    };
    
    // Call server to generate signature securely
    const sigRes = await fetch('/api/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paramsToSign })
    });
    
    if (!sigRes.ok) throw new Error("Failed to get signature. Check backend setup.");
    
    const { signature, apiKey, cloudName } = await sigRes.json();
    if (!cloudName) throw new Error("Cloudinary not configured on server.");

    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', paramsToSign.folder);
    
    // Upload directly to Cloudinary
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    const uploadData = await uploadRes.json();
    if (uploadData.secure_url) {
      return uploadData.secure_url;
    }
    throw new Error(uploadData.error?.message || "Cloudinary upload failed without error message");
  } catch (error) {
    console.error('Cloudinary upload failed, falling back to base64:', error);
    return base64Data;
  }
}

export async function saveUploadedImageToCloud(
  userId: string,
  originalBase64: string,
  fileName: string = "User Upload",
  driveFileId?: string | null
): Promise<{ url: string, id: string }> {
  const base64Data = await fetchUrlAsBase64(originalBase64);
  const sourceHash = hashString(originalBase64);
  const storageUrl = await uploadToStorage(userId, base64Data, 'upload');
  
  let finalUrlToSave = storageUrl;
  if (storageUrl === base64Data) {
    // If Firebase Storage failed, it returned the original huge base64.
    // We must compress it to avoid Firestore's 1MB document limit.
    finalUrlToSave = await compressBase64Image(base64Data, 800, 0.6);
  }

  try {
    const uploadedDocRef = await addDoc(collection(db, 'users', userId, 'images'), {
      user_id: userId,
      url: finalUrlToSave, // Use Firebase Storage URL or compressed thumbnail
      name: fileName,
      type: 'uploaded',
      sourceHash,
      timestamp: Date.now(),
      driveFileId: driveFileId || null
    });

    return { url: finalUrlToSave, id: uploadedDocRef.id };
  } catch (err: any) {
    console.error("Firestore save failed:", err);
    throw err;
  }
}

export async function saveGeneratedImageToCloud(
  userId: string,
  originalBase64: string,
  generatedBase64: string,
  prompt: string,
  fileName: string = "Generated Image",
  driveFileId?: string | null
): Promise<{ originalUrl: string, generatedUrl: string, id: string }> {
  
  // Ensure we have base64 data to upload
  const b64Original = await fetchUrlAsBase64(originalBase64);
  const sourceHash = hashString(originalBase64);
  const b64Generated = await fetchUrlAsBase64(generatedBase64);
  
  // Upload FULL QUALITY to Firebase Storage
  let storageOriginalUrl = await uploadToStorage(userId, b64Original, 'original');
  let storageGeneratedUrl = await uploadToStorage(userId, b64Generated, 'generated');
  
  // Compress for Firestore if Storage failed
  if (storageOriginalUrl === b64Original) {
    storageOriginalUrl = await compressBase64Image(b64Original, 800, 0.6);
  }
  if (storageGeneratedUrl === b64Generated) {
    storageGeneratedUrl = await compressBase64Image(b64Generated, 800, 0.6);
  }
  
  try {
    const generatedDocRef = await addDoc(collection(db, 'users', userId, 'images'), {
      user_id: userId,
      url: storageGeneratedUrl, // Use Firebase Storage URL or thumbnail
      originalUrl: storageOriginalUrl, // Use Firebase Storage URL or thumbnail
      prompt,
      name: fileName,
      type: 'generated',
      sourceHash,
      timestamp: Date.now(),
      driveFileId: driveFileId || null
    });

    return { originalUrl: storageOriginalUrl, generatedUrl: storageGeneratedUrl, id: generatedDocRef.id };
  } catch (err: any) {
    console.error("Firestore save failed:", err);
    throw err;
  }
}

