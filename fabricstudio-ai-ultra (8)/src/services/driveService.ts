export async function ensureNestedFolder(accessToken: string, path: string[]): Promise<string | null> {
  let parentId: string | undefined = undefined;
  for (const folderName of path) {
    let folderId = await getFolderId(accessToken, folderName, parentId);
    if (!folderId) {
      folderId = await createFolder(accessToken, folderName, parentId);
    }
    if (!folderId) return null;
    parentId = folderId;
  }
  return parentId || null;
}

export async function uploadToGoogleDrive(
  accessToken: string | null,
  fileName: string,
  base64Data: string,
  folderPath: string[]
): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const parentId = await ensureNestedFolder(accessToken, folderPath);
    const metadata = {
      name: fileName,
      parents: parentId ? [parentId] : undefined
    };

    let mimeType = 'image/jpeg';
    let b64Data = base64Data;
    
    // Convert base64 to Blob
    if (base64Data.startsWith('data:')) {
      const matches = base64Data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,(.*)/);
      if (matches) {
         mimeType = matches[1];
         b64Data = matches[2];
      }
    }
    
    const binaryBytes = atob(b64Data);
    const array = new Uint8Array(binaryBytes.length);
    for (let i = 0; i < binaryBytes.length; i++) {
        array[i] = binaryBytes.charCodeAt(i);
    }
    const blob = new Blob([array], { type: mimeType });

    // 1. Create the file metadata first
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!createRes.ok) {
       console.error("User drive init upload failed:", await createRes.text());
       return null;
    }

    const fileData = await createRes.json();
    const fileId = fileData.id;

    // 2. Upload file content
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': mimeType
      },
      body: blob
    });
    
    if (!res.ok) {
       console.error("User drive upload failed:", await res.text());
       return null;
    }

    return fileId;
  } catch (error) {
    console.error("User Drive upload failed:", error);
    return null;
  }
}

export async function fetchFromGoogleDrive(accessToken: string | null, folderPath: string[]): Promise<{id: string, name: string, thumbnailLink: string}[]> {
  if (!accessToken) return [];
  try {
    let parentId = undefined;
    if (folderPath.length > 0) {
      parentId = await getFolderId(accessToken, folderPath[folderPath.length - 1]);
    }
    
    let q = "mimeType != 'application/vnd.google-apps.folder' and trashed=false";
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }
    const query = encodeURIComponent(q);
    
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,thumbnailLink,webContentLink)&orderBy=createdTime desc&pageSize=100`, {
       headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error("Failed to fetch from user drive", error);
    return [];
  }
}

async function getFolderId(accessToken: string, folderName: string, parentId?: string): Promise<string | null> {
  try {
    let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }
    const query = encodeURIComponent(q);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function createFolder(accessToken: string, folderName: string, parentId?: string): Promise<string | null> {
  try {
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      metadata.parents = [parentId];
    }
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    return data.id || null;
  } catch (e) {
    return null;
  }
}
