import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Download, Loader2, Sparkles, Image as ImageIcon, Trash2, Cloud } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchFromGoogleDrive } from '../services/driveService';

interface SavedImage {
  id: string;
  originalImageUrl: string;
  generatedImageUrl: string;
  prompt: string;
  createdAt: number;
  driveFileId?: string;
  type?: 'uploaded' | 'generated';
}

interface ImageGroup {
  id: string;
  originalImage?: SavedImage;
  generations: SavedImage[];
  createdAt: number;
}

export function HistoryGallery() {
  const { user, getAccessToken } = useAuth();
  const [groupedImages, setGroupedImages] = useState<ImageGroup[]>([]);
  const [driveImages, setDriveImages] = useState<{id: string, name: string, thumbnailLink: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [activeView, setActiveView] = useState<'cloud' | 'drive'>('cloud');

  const fetchImages = async () => {
    if (!user) return;
    try {
      // Fetch all images
      const imagesQ = query(
        collection(db, 'users', user.uid, 'images'),
        orderBy('timestamp', 'desc')
      );
      const imagesSnapshot = await getDocs(imagesQ);
      
      const groupsMap = new Map<string, ImageGroup>();

      imagesSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const img = {
          id: docSnap.id,
          ...data,
          generatedImageUrl: data.url,
          originalImageUrl: data.originalUrl || data.url,
          prompt: data.prompt || data.name || 'Image',
          createdAt: data.timestamp,
          type: data.type
        } as SavedImage;
        
        const groupId = data.sourceHash || img.originalImageUrl;
        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, {
            id: groupId,
            generations: [],
            createdAt: img.createdAt
          });
        }
        
        const group = groupsMap.get(groupId)!;
        if (img.type === 'uploaded') {
          group.originalImage = img;
        } else {
          group.generations.push(img);
        }
        if (img.createdAt > group.createdAt) {
          group.createdAt = img.createdAt;
        }
      });

      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      setGroupedImages(sortedGroups);
      
      const token = getAccessToken();
      if (token) {
         try {
           const driveFiles = await fetchFromGoogleDrive(token, [user.uid, 'Generation 1']);
           setDriveImages(driveFiles);
         } catch (e) {
           console.error(e);
         }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isOfflineError = errMsg.includes('offline') || errMsg.includes('Backend didn\'t respond') || errMsg.includes('Could not reach') || errMsg.includes('10 seconds');
      if (isOfflineError) {
        console.warn("Failed to fetch image history (client offline):", errMsg);
      } else {
        console.error("Failed to fetch image history:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [user]);

  const handleClearHistory = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete your entire cloud image history? This action cannot be undone.")) return;
    
    setIsClearing(true);
    try {
      const imagesQ = query(collection(db, 'users', user.uid, 'images'));
      const snapshot = await getDocs(imagesQ);
      
      const deletePromises = snapshot.docs.map(document => 
        deleteDoc(doc(db, 'users', user.uid, 'images', document.id))
      );
      
      await Promise.all(deletePromises);
      await fetchImages(); // Refresh the empty state
    } catch (err) {
      console.error("Failed to clear history:", err);
      alert("Failed to clear history. See console for details.");
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase">Loading Cloud Archive</p>
      </div>
    );
  }

  const handleDownload = async (url: string, name: string, isDrive?: boolean) => {
    try {
      const headers: any = {};
      const response = await fetch(url, { headers });
      const blob = await response.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      const ext = isDrive ? '' : '.png';
      a.download = `${name.replace(/\s+/g, '_')}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (e) {
      console.error('Failed to download image from cloud:', e);
      window.open(url, '_blank');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-blue-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Cloud Render Archive</h2>
            <p className="text-sm text-blue-500 mt-1">Permanently stored in Google Cloud Storage</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleClearHistory}
            disabled={isClearing || groupedImages.length === 0}
            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear History
          </button>
          <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
            <button 
              onClick={() => setActiveView('cloud')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeView === 'cloud' ? 'bg-white text-gray-900 shadow-sm' : 'text-blue-500 hover:text-gray-900'}`}
            >
              Cloud 
            </button>
            <button 
              onClick={() => setActiveView('drive')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${activeView === 'drive' ? 'bg-white text-gray-900 shadow-sm' : 'text-blue-500 hover:text-gray-900'}`}
            >
              <Cloud className="w-3 h-3" /> Drive
            </button>
          </div>
        </div>
      </div>

      {groupedImages.length === 0 && activeView !== 'drive' && (
        <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-500">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Images Yet</h3>
          <p className="text-sm text-blue-500 max-w-sm text-center">
            Uploaded root images and their virtual garments will be permanently stored and appear here.
          </p>
        </div>
      )}
      
      {activeView === 'drive' && driveImages.length === 0 && (
         <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-500">
            <Cloud className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Drive Images Found</h3>
          <p className="text-sm text-blue-500 max-w-sm text-center mb-4">
            We checked your connected Google Drive (folder: {user?.uid} / Generation 1). Ensure you have granted Google Drive permissions when signing in.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
          >
            Reconnect to Google Drive
          </button>
        </div>
      )}

      {activeView === 'cloud' && groupedImages.length > 0 && (
        <div className="space-y-12">
          {groupedImages.map((group) => (
            <div key={group.id} className="space-y-4">
               <div className="flex items-center gap-4">
                 <div className="h-px flex-1 bg-blue-200" />
                 <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">
                   {new Date(group.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                 </span>
                 <div className="h-px flex-1 bg-blue-200" />
               </div>
               <div className="flex flex-wrap gap-6">
                 {group.originalImage && (
                    <motion.div 
                      key={group.originalImage.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-48 group relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all shrink-0"
                    >
                      <div className="aspect-[3/4] p-2">
                        <img 
                          src={group.originalImage.generatedImageUrl} 
                          className="w-full h-full object-contain rounded-xl opacity-80" 
                          alt="Original" 
                          loading="lazy"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gray-900/5 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDownload(group.originalImage!.generatedImageUrl, `cloud_uploaded_${group.originalImage!.id}`)}
                            className="bg-white/90 text-gray-900 py-1.5 rounded-lg font-bold text-[10px] w-full"
                          >
                           Original
                          </button>
                      </div>
                      <div className="absolute top-2 left-2 bg-gray-900/40 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-md font-bold uppercase">
                          Source
                      </div>
                    </motion.div>
                 )}
                 <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                   {group.generations.map((img) => (
                      <motion.div 
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="aspect-[3/4] bg-gray-50 relative overflow-hidden">
                          <img 
                            src={img.driveFileId ? `https://drive.google.com/thumbnail?id=${img.driveFileId}&sz=w1000` : img.generatedImageUrl} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" 
                            alt={img.prompt || 'Image'} 
                            loading="lazy"
                            crossOrigin="anonymous"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 gap-2">
                            <button
                              onClick={() => {
                                if (img.driveFileId) {
                                  window.open(`https://drive.google.com/file/d/${img.driveFileId}/view`, '_blank');
                                } else {
                                  handleDownload(img.generatedImageUrl, `cloud_generated_${img.id}`);
                                }
                              }}
                              className="bg-white text-gray-900 h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition hover:bg-gray-50 cursor-pointer shadow-lg"
                            >
                              <Download className="w-4 h-4" /> Download HD
                            </button>
                          </div>
                        </div>
                        <div className="p-4 border-t border-gray-100">
                          <p className="text-xs font-semibold text-blue-700 truncate mb-1">
                            {img.prompt || 'Generated Layout'}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'drive' && driveImages.length > 0 && (
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {driveImages.map((img) => (
            <motion.div 
              key={img.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              <div className="aspect-[3/4] bg-gray-50 relative overflow-hidden">
                {img.thumbnailLink ? (
                    <img 
                      src={img.thumbnailLink.replace('=s220', '=s600')} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" 
                      alt={img.name || 'Drive Image'} 
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <ImageIcon className="w-8 h-8" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 gap-2">
                  <button
                    onClick={() => {
                        if ((img as any).webContentLink) {
                          window.open((img as any).webContentLink, '_blank');
                        } else {
                          window.open(`https://drive.google.com/file/d/${img.id}/view`, '_blank');
                        }
                    }}
                    className="bg-white text-gray-900 h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition hover:bg-gray-50 cursor-pointer shadow-lg"
                  >
                    <Download className="w-4 h-4" /> Download HD
                  </button>
                  <button
                    onClick={() => window.open(`https://drive.google.com/file/d/${img.id}/view`, '_blank')}
                    className="bg-white text-gray-900 h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition hover:bg-gray-50 cursor-pointer shadow-lg"
                  >
                    Open in Drive
                  </button>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-blue-700 truncate mb-1">
                  {img.name || 'Drive File'}
                </p>
                <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <span>Google Drive</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
