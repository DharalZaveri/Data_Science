import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Download, 
  ChevronRight, 
  Sparkles,
  Layers,
  Maximize2,
  FileText,
  User as UserIcon,
  Upload,
  CheckCircle2,
  Mountain,
  Check,
  History,
  Coins,
  Loader2
} from 'lucide-react';
import { Button, Card } from './UI';
import { Garment, Model, PoseImage } from '../types';
import { POSES, GARMENT_CATEGORIES } from '../constants';
import { Garment3DViewer } from './Garment3DViewer';
import { generateGarmentPose, generateGarmentDescription, generateMaterialSwatch } from '../services/geminiService';
import { saveGeneratedImageToCloud, saveUploadedImageToCloud } from '../services/storageService';
import { uploadToGoogleDrive } from '../services/driveService';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import JSZip from 'jszip';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';



// Helper to downscale and compress base64 images optimally while preserving high quality
const compressBase64Image = (base64Str: string, maxDim = 2048, quality = 0.95): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
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
            width = Math.round((img.width * maxDim) / img.height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for massive compression gains compared to PNG
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        console.error("Image compression error:", err);
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

// Helper to enforce max file size for Cloudinary (~10MB payload)
const getOptimalDataUrl = (canvas: HTMLCanvasElement): string => {
  let quality = 0.98;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  // Max cloudinary size is 10485760 bytes. Base64 adds ~33% overhead.
  // 10485760 * 1.33 ≈ 13946060. We use 13900000 as a safe string length.
  while (dataUrl.length > 13900000 && quality > 0.6) {
    quality -= 0.04;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
};

// Helper to ensure any raw base64 string doesn't exceed Cloudinary's 10MB limit
const ensureValidSize = async (base64Str: string): Promise<string> => {
  if (base64Str.length <= 13900000) return base64Str;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; 
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(base64Str);
      ctx.drawImage(img, 0, 0);
      resolve(getOptimalDataUrl(c));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
};

export function CatalogStudio({ uiTheme = 'modern', uiLayout = 'centered' }: { uiTheme?: 'modern' | 'monochrome' | 'elegant', uiLayout?: 'centered' | 'fluid' | 'compact' }) {
  const { user, userProfile, deductCredit, getAccessToken } = useAuth();
  const [step, setStep] = useState(1);
  const [productionMode, setProductionMode] = useState<'single' | 'batch'>('batch');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('3:4');
  const [selectedResolution, setSelectedResolution] = useState<string>('2K');
  const [intendedUse, setIntendedUse] = useState<'ecommerce' | 'print'>('ecommerce');
  const [autoCompleteSet, setAutoCompleteSet] = useState<boolean>(false);
  const [selectedBackground, setSelectedBackground] = useState<{id: string, name: string, prompt: string, url?: string} | null>(null);
  // Model Library State
  const [customModels, setCustomModels] = useState<{id: string, name: string, url: string, basePrompt: string}[]>([]);
  const allAvailableModels = customModels;
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  
  const [customBackgrounds, setCustomBackgrounds] = useState<{id: string, name: string, url: string, prompt: string}[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [modelPrompt, setModelPrompt] = useState('');
  const [modelImage, setModelImage] = useState<string | null>(null);
const [atmospherePrompt, setAtmospherePrompt] = useState('Professional minimalist studio setup with softbox lighting');
  const [selectedBackgroundPreset, setSelectedBackgroundPreset] = useState<string>('Studio');
  const [includeMaterialSwatch, setIncludeMaterialSwatch] = useState<boolean>(false);
  const [garmentFabric, setGarmentFabric] = useState<string>('Cotton');

  const FABRIC_TYPES = ['Cotton', 'Silk', 'Denim', 'Satin', 'Velvet', 'Linen', 'Wool', 'Chiffon', 'Polyester', 'Leather', 'Georgette', 'Viscose'];

  const BACKGROUND_PRESETS = [
    { id: 'natural', name: 'Natural', prompt: 'Breathtaking natural landscape with soft outdoor daylight, lush greenery, and organic depth.' },
    { id: 'garden', name: 'In Garden', prompt: 'A vibrant, manicured luxury garden with colorful blooming flowers, stone pathways, and soft dappled sunlight.' },
    { id: 'studio', name: 'In Studio', prompt: 'Professional minimalist studio setup with high-end softbox lighting and a clean, neutral seamless backdrop.' },
    { id: 'lake-classic', name: 'In Classic Lake View', prompt: 'Serene classic lake view at dawn, tranquil blue waters, mountain silhouettes in the distance, and soft atmospheric mist.' },
    { id: 'lake-haveli', name: 'In Lake View with Heritage Haveli', prompt: 'Traditional Rajasthani Haveli architecture overlooking a majestic lake under bright, modern daytime studio-quality ambient lighting, intricate stone carvings, and royal heritage vibes.' },
    { id: 'wedding', name: 'In Wedding Function', prompt: 'A lavish Indian wedding celebration background with warm decorative fairy lights, marigold floral arrangements, and a festive luxury banquet theme.' },
    { id: 'modern-apt', name: 'Modern Apartment', prompt: 'Ultra-modern luxury apartment with floor-to-ceiling windows, designer furniture, and clean architectural lines.' },
    { id: 'hotel-lobby', name: 'Hotel Lobby', prompt: 'Grand entrance of a 7-star luxury hotel, marble floors, crystal chandeliers, and an opulent atmosphere.' },
    { id: 'serene-beach', name: 'Serene Day Beach', prompt: 'Pristine sandy beach under bright late morning sky, crystal clear turquoise waters, gentle white surf, crisp neutral daylight.' },
    { id: 'industrial-loft', name: 'Industrial Loft', prompt: 'Chic industrial loft with exposed brick walls, large metal-framed windows, and artistic lighting.' },
    { id: 'urban-street', name: 'Urban Street', prompt: 'Trendy urban street setting in a modern city downtown with blurred bustling background and cinematic afternoon lighting.' },
    { id: 'cafe-terrace', name: 'Cafe Terrace', prompt: 'Cozy European-style outdoor cafe terrace with small round tables, soft sunlight, and a relaxed stylish atmosphere.' },
    { id: 'desert-dunes', name: 'Desert Dunes', prompt: 'Endless golden sand dunes under a clear blue sky, warm golden hour lighting casting dramatic shadows.' },
    { id: 'neon-city', name: 'Neon City Night', prompt: 'Cyberpunk-inspired modern city street at night, illuminated by vibrant neon signs and cinematic colorful rim lights.' },
    { id: 'minimal-concrete', name: 'Minimalist Concrete', prompt: 'Architectural minimalist space featuring smooth concrete walls and geometric shadow plays from harsh sunlight.' }
  ];

  const [shopName, setShopName] = useState("");
  const [shopLogo, setShopLogo] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressedLogo = await compressBase64Image(reader.result as string, 512, 0.9);
      setShopLogo(compressedLogo);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedBg = await compressBase64Image(reader.result as string);
        const newBg = {
          id: `custom-bg-${Date.now()}-${index}`,
          name: file.name.split('.')[0] || `Custom Bg ${customBackgrounds.length + 1}`,
          url: compressedBg,
          prompt: "A professional studio background matching the uploaded reference."
        };
        setCustomBackgrounds(prev => [...prev, newBg]);
        if (index === 0) setSelectedBackground(newBg);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeBackground = (id: string) => {
    setCustomBackgrounds(prev => prev.filter(b => b.id !== id));
    if (selectedBackground?.id === id) {
      setSelectedBackground(null);
    }
  };

  const handleModelLibraryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedModel = await compressBase64Image(reader.result as string);
        const newModel = {
          id: `custom-model-${Date.now()}-${index}`,
          name: file.name.split('.')[0] || `Custom Model ${customModels.length + 1}`,
          url: compressedModel,
          basePrompt: "A professional fashion model with realistic features matching the reference."
        };
        setCustomModels(prev => [...prev, newModel]);
        if (index === 0 && customModels.length === 0) {
          setSelectedModelId(newModel.id);
          setModelImage(compressedModel);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeModel = (id: string) => {
    setCustomModels(prev => prev.filter(m => m.id !== id));
    if (selectedModelId === id) {
      setSelectedModelId('');
      setModelImage(null);
      setModelPrompt('');
    }
  };

  // Batch mode state
  const [batchItems, setBatchItems] = useState<{ 
    id: string,
    images: string[],
    modelId: string,
    name: string,
    designNumber: string
  }[]>([]);

  const addBatchItem = () => {
    setBatchItems(prev => [...prev, { 
      id: `batch-${Date.now()}-${prev.length}`,
      images: [], 
      modelId: allAvailableModels[0]?.id || '',
      name: `Garment ${prev.length + 1}`,
      designNumber: ''
    }]);
  };

  const handleAutoRandomize = () => {
    if (batchItems.length === 0) return;
    
    const allModels = allAvailableModels.map(m => m.id);
    const allBgs = [...customBackgrounds].map(b => b.id);
    
    if (allModels.length === 0 || allBgs.length === 0) {
      alert("Please upload at least one background to the pool (Models are available).");
      return;
    }
    
    const G = batchItems.length;
    
    const generateBalancedDistribution = (items: string[], total: number) => {
       const assignments: string[] = [];
       
       // Force each to be used at least once
       for (let i = 0; i < items.length && assignments.length < total; i++) {
           assignments.push(items[i]);
       }
       
       // Fill the rest, prioritizing items used least to balance utilization
       while (assignments.length < total) {
           const counts = items.map(id => ({ 
             id, 
             count: assignments.filter(a => a === id).length 
           }));
           counts.sort((a, b) => a.count - b.count);
           
           // Randomly pick from candidates that have the lowest count
           const minCount = counts[0].count;
           const candidates = counts.filter(c => c.count === minCount);
           const chosen = candidates[Math.floor(Math.random() * candidates.length)].id;
           assignments.push(chosen);
       }
       
       // Shuffle the array
       return assignments.sort(() => Math.random() - 0.5);
    };

    const assignedModels = generateBalancedDistribution(allModels, G);
    const assignedBgs = generateBalancedDistribution(allBgs, G);
    
    setBatchItems(prev => prev.map((item, idx) => {
       return {
         ...item,
         modelId: assignedModels[idx]
       };
    }));
  };

  const removeBatchItem = (index: number) => {
    setBatchItems(prev => prev.filter((_, i) => i !== index));
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedPoses, setGeneratedPoses] = useState<PoseImage[]>([]);

  // Drag and Drop State
  const [draggedPoseIndex, setDraggedPoseIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedPoseIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedPoseIndex === null || draggedPoseIndex === targetIndex) return;

    setGeneratedPoses(prevPoses => {
      const newPoses = [...prevPoses];
      const draggedItem = newPoses[draggedPoseIndex];
      newPoses.splice(draggedPoseIndex, 1);
      newPoses.splice(targetIndex, 0, draggedItem);
      return newPoses;
    });
    setDraggedPoseIndex(null);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && generationProgress < 95) {
      interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 95) return prev;
          const slowDown = prev > 85 ? 0.2 : (prev > 50 ? 2 : 5);
          return Math.min(95, prev + slowDown);
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isGenerating, generationProgress]);

  // Shared mode state
  const [globalStyleReference, setGlobalStyleReference] = useState<string | null>(null);

  // Single mode state
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  const [garmentName, setGarmentName] = useState('Premium Garment');
  const [garmentDesignNumber, setGarmentDesignNumber] = useState('');
  const [garmentCategory, setGarmentCategory] = useState(GARMENT_CATEGORIES[0]);
  const [selectedPoseIndices, setSelectedPoseIndices] = useState<number[]>([0]); // Default 1 pose for instant generation (highly optimized for speed)
  
  const handleGlobalStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressedStyle = await compressBase64Image(reader.result as string);
      setGlobalStyleReference(compressedStyle);
    };
    reader.readAsDataURL(file);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        
        if (user && user.uid) {
           const accessToken = getAccessToken();
           const uid = user.uid;
           (async () => {
             let driveId = null;
             if (accessToken) {
               try {
                 driveId = await uploadToGoogleDrive(accessToken, file.name, result, [uid, 'Generation 1']);
               } catch(e) { console.error(e); }
             }
             saveUploadedImageToCloud(uid, result, file.name, driveId).catch(e => console.error(e));
           })();
        }

        setBatchItems(prev => [...prev, {
          id: `batch-${Date.now()}-${prev.length}-${Math.random().toString(36).substr(2, 9)}`,
          images: [result],
          modelId: selectedModelId,
          name: file.name.split('.')[0] || `Garment ${prev.length + 1}`,
          designNumber: ''
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        
        if (user && user.uid) {
           const accessToken = getAccessToken();
           const uid = user.uid;
           (async () => {
             let driveId = null;
             if (accessToken) {
               try {
                 driveId = await uploadToGoogleDrive(accessToken, file.name, result, [uid, 'Generation 1']);
               } catch(e) { console.error(e); }
             }
             saveUploadedImageToCloud(uid, result, file.name, driveId).catch(e => console.error(e));
           })();
        }

        if (productionMode === 'single') {
          setGarmentImages(prev => [...prev, result].slice(0, 5));
        } else if (index !== undefined) {
          setBatchItems(prev => {
            const next = [...prev];
            next[index] = { 
              ...next[index], 
              images: [...next[index].images, result].slice(0, 5)
            };
            return next;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGarmentImage = (idx: number, batchIdx?: number) => {
    if (productionMode === 'single') {
      setGarmentImages(prev => prev.filter((_, i) => i !== idx));
    } else if (batchIdx !== undefined) {
      setBatchItems(prev => {
        const next = [...prev];
        next[batchIdx].images = next[batchIdx].images.filter((_, i) => i !== idx);
        return next;
      });
    }
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedModel = await compressBase64Image(reader.result as string);
        setModelImage(compressedModel);
      };
      reader.readAsDataURL(file);
    }
  };

  const getModelData = (id: string) => {
    const model = allAvailableModels.find(m => m.id === id);
    if (model) return { url: model.url, basePrompt: model.basePrompt, name: model.name };
    return { url: allAvailableModels[0]?.url || '', basePrompt: allAvailableModels[0]?.basePrompt || '', name: allAvailableModels[0]?.name || 'Auto Model' };
  };

  const handleStartGeneration = async () => {
    if (!user || !userProfile) return;
    
    // Check wallet balance
    if (!userProfile.isPro && (userProfile.credits ?? 0) <= 0) {
      alert("You have run out of image credits! Please use the 'Top up Wallet' button in the navigation header to buy more credits.");
      return;
    }

    const currentModelData = getModelData(selectedModelId);
    
    // Debug log to help identify failures
    console.log('Production starting with conditions:', {
      hasModelImage: !!modelImage,
      hasCurrentModelUrl: !!currentModelData.url,
      productionMode,
      garmentImagesCount: garmentImages.length,
      batchItemsValid: batchItems.some(b => b.images.length > 0)
    });

    if (productionMode === 'single') {
      if (garmentImages.length === 0) {
        alert("Please upload at least one garment image.");
        return;
      }
      if (selectedPoseIndices.length === 0) {
        alert("Please select at least one shoot angle from the global settings.");
        return;
      }
    } else {
      if (batchItems.every(b => b.images.length === 0)) {
        alert("Production queue is empty. Please upload some garments.");
        return;
      }
      if (selectedPoseIndices.length === 0) {
        alert("Please select at least one shoot angle.");
        return;
      }
    }
    
    // Check credits before executing
    if (!userProfile || userProfile.credits <= 0) {
      window.dispatchEvent(new Event('openPaymentModal'));
      return;
    }

    setIsGenerating(true);
    setGeneratedPoses([]);
    setStep(3);
    setGenerationProgress(0);
    setGenerationStatus('Validating configuration...');
    
    try {
      let results: PoseImage[] = [];
      
      // Default model prompt if none provided
      const defaultModelPersona = "A stunning 26 years old Indian girl with natural beauty, elegant features, and professional poise.";
      const effectiveModelPrompt = modelPrompt || defaultModelPersona;

      if (productionMode === 'single') {
        const activePoses = POSES.filter((_, i) => selectedPoseIndices.includes(i));
        
        let globalSwatchUrl: string | undefined = undefined;
        if (includeMaterialSwatch && garmentImages.length > 0) {
          setGenerationStatus('Generating global material swatch...');
          try {
            globalSwatchUrl = await generateMaterialSwatch({ 
              garmentImages, 
              fabric: garmentFabric, 
              description: garmentName 
            });
          } catch (e) {
            console.error("Swatch generation failed", e);
          }
        }

        const posePromises: (() => Promise<PoseImage>)[] = activePoses.map((poseName, index) => {
          return async (): Promise<PoseImage> => {
            const isCustomBg = selectedBackground && selectedBackground.id.startsWith('custom-');
            const customBg = isCustomBg ? customBackgrounds.find(b => b.id === selectedBackground!.id) : null;
            
            const url = await generateGarmentPose({
              garmentType: garmentName + (garmentDesignNumber ? ` (Design: ${garmentDesignNumber})` : ''),
              garmentCategory: garmentCategory,
              color: "exact reference match",
              pattern: "exact reference match",
              fabric: garmentFabric,
              pose: poseName,
              description: `ABSOLUTE VTO LOCK: You MUST copy the exact colors, fabric material, layout, and prints from the garment references exactly. Do NOT change anything about the garments or model identity. PHOTOSHOOT QUALITY: Use professional three-point lighting and elegant high-fashion poses. Note: Frame tightly. ${garmentCategory.toLowerCase() === 'saree' ? 'SPECIAL SAREE PALLU LOGIC: If reference images primarily show the pallu (ornamental end), apply that design ONLY to the pallu area of the model drape. Use a coordinating solid color or subtle texture for the saree body and pleats that complements the pallu without overpowering it.' : ''}`,
              referenceImages: garmentImages,
              styleReferenceImage: globalStyleReference || undefined,
              modelImage: modelImage || currentModelData.url,
              modelPrompt: effectiveModelPrompt,
              backgroundImage: customBg?.url,
              backgroundPrompt: atmospherePrompt + (selectedBackground ? ` - matching uploaded background` : ''),
              aspectRatio: selectedAspectRatio,
              imageResolution: intendedUse === 'print' ? 'Print (300 DPI)' : selectedResolution,
              autoCompleteSet: autoCompleteSet
            });

            let finalUrl = url;
            if (globalSwatchUrl) {
              finalUrl = await applySplitComposition(finalUrl, globalSwatchUrl);
            }
            if (shopName || shopLogo || garmentDesignNumber) {
              finalUrl = await applyWatermark(finalUrl, shopName, shopLogo, garmentDesignNumber);
            }
            
            finalUrl = await ensureValidSize(finalUrl);

            if (user && user.uid) {
              const fileName = `Generated_${poseName.replace(/\s+/g, '_')}_${Date.now()}.png`;
              const accessToken = getAccessToken();
              const uid = user.uid;
              const ogImage = garmentImages[0] || url;
              (async () => {
                let driveId = null;
                if (accessToken) {
                  try {
                    driveId = await uploadToGoogleDrive(accessToken, fileName, finalUrl, [uid, 'Generation 1']);
                  } catch(e) { console.error(e); }
                }
                saveGeneratedImageToCloud(
                  uid,
                  ogImage,
                  finalUrl,
                  poseName,
                  fileName,
                  driveId
                ).catch(e => console.error("Cloud save failed:", e));
              })();
            }
            const result = { 
              id: `pose-${index}`, 
              url: finalUrl, 
              poseType: poseName,
              swatchUrl: globalSwatchUrl,
              aspectRatio: selectedAspectRatio
            };
            setGeneratedPoses(prev => [...prev, result]);
            return result;
          };
        });
        
        results = [];
        // Process in parallel with concurrency limit (max 10 at a time)
        const unfilteredResults: (PoseImage | null)[] = [];
        const concurrencyLimit = 10;
        const totalSingle = posePromises.length;
        let completedSingle = 0;

        for (let i = 0; i < posePromises.length; i += concurrencyLimit) {
          const chunk = posePromises.slice(i, i + concurrencyLimit);
          setGenerationStatus(`Rendering pose models (${completedSingle} / ${totalSingle})...`);
          
          const chunkResults = await Promise.all(chunk.map(async (fn) => {
            try {
              return await fn();
            } catch (r: any) {
              console.error('Pose generation failed:', r);
              const rMsg = r?.message || String(r);
              if (rMsg.includes('QUOTA_EXCEEDED') || rMsg.includes('SPENDING_CAP_EXCEEDED') || rMsg.includes('429')) {
                throw r;
              }
              return null;
            }
          }));
          unfilteredResults.push(...chunkResults);
          completedSingle += chunk.length;
          setGenerationProgress(Math.floor((completedSingle / totalSingle) * 100));
        }
        results = unfilteredResults.filter((r): r is PoseImage => r !== null);

      } else {
        // Batch mode: multiple poses for EACH garment
        setGenerationStatus('Analyzing batch jobs...');
        const activeBatchItems = batchItems.filter(b => b.images.length > 0);
        const allBatchPromises: (() => Promise<PoseImage>)[] = [];

        // Pre-generate swatches for all batch items to keep the promises cleaner
        setGenerationStatus('Generating material swatches for batch assets...');
        const batchSwatches: (string | undefined)[] = await Promise.all(
          activeBatchItems.map(async (item) => {
            if (!includeMaterialSwatch) return undefined;
            try {
              return await generateMaterialSwatch({ 
                garmentImages: item.images, 
                fabric: garmentFabric, 
                description: item.name 
              });
            } catch (e) {
              console.error(`Swatch generation failed for ${item.name}`, e);
              return undefined;
            }
          })
        );

        for (let itemIdx = 0; itemIdx < activeBatchItems.length; itemIdx++) {
          const item = activeBatchItems[itemIdx];
          const itemSwatchUrl = batchSwatches[itemIdx];
          const itemModelData = getModelData(item.modelId || selectedModelId);
          const isCustomBg = selectedBackground && selectedBackground.id.startsWith('custom-');
          const customBg = isCustomBg ? customBackgrounds.find(b => b.id === selectedBackground!.id) : null;
          
          const filteredPoses = POSES.filter((_, i) => selectedPoseIndices.includes(i));
          
          const garmentPoses: (() => Promise<PoseImage>)[] = filteredPoses.map((poseName, poseIdx) => {
            return async (): Promise<PoseImage> => {
              const url = await generateGarmentPose({
                garmentType: item.name + (item.designNumber ? ` (Design: ${item.designNumber})` : ''),
                garmentCategory: garmentCategory,
                color: "exact reference match",
                pattern: "exact reference match",
                fabric: garmentFabric,
                pose: poseName,
                description: `ABSOLUTE VTO LOCK: You MUST copy the exact colors, fabric material, layout, and prints from the garment references exactly. Do NOT change anything about the garments or model identity. PHOTOSHOOT QUALITY: Use professional three-point lighting and elegant high-fashion poses. Note: Frame tightly. ${garmentCategory.toLowerCase() === 'saree' ? 'SPECIAL SAREE PALLU LOGIC: If reference images primarily show the pallu (ornamental end), apply that design ONLY to the pallu area of the model drape. Use a coordinating solid color or subtle texture for the saree body and pleats that complements the pallu without overpowering it.' : ''}`,
                referenceImages: item.images,
                styleReferenceImage: globalStyleReference || undefined,
                modelImage: itemModelData.url || modelImage,
                modelPrompt: itemModelData.basePrompt || effectiveModelPrompt,
                backgroundImage: customBg?.url,
                backgroundPrompt: atmospherePrompt + (selectedBackground ? ` - matching uploaded background` : ''),
                aspectRatio: selectedAspectRatio,
                imageResolution: intendedUse === 'print' ? 'Print (300 DPI)' : selectedResolution,
                autoCompleteSet: autoCompleteSet
              });

              let finalUrl = url;
              if (itemSwatchUrl) {
                finalUrl = await applySplitComposition(finalUrl, itemSwatchUrl);
              }
              if (shopName || shopLogo || item.designNumber) {
                finalUrl = await applyWatermark(finalUrl, shopName, shopLogo, item.designNumber);
              }
              
              finalUrl = await ensureValidSize(finalUrl);
              
              if (user && user.uid) {
                const fileName = `Generated_${item.name.replace(/\s+/g, '_')}_${poseName.replace(/\s+/g, '_')}_${Date.now()}.png`;
                const accessToken = getAccessToken();
                const uid = user.uid;
                const ogImage = item.images[0] || finalUrl;
                (async () => {
                  let driveId = null;
                  if (accessToken) {
                    try {
                      driveId = await uploadToGoogleDrive(accessToken, fileName, finalUrl, [uid, 'Generation 1']);
                    } catch(e) { console.error(e); }
                  }
                  saveGeneratedImageToCloud(
                    uid,
                    ogImage,
                    finalUrl,
                    `${item.name} - ${poseName}`,
                    fileName,
                    driveId
                  ).catch(e => console.error("Cloud save failed:", e));
                })();
              }
              const result = { 
                id: `batch-${itemIdx}-pose-${poseIdx}`, 
                url: finalUrl, 
                poseType: `${item.name}: ${poseName.split(',')[0]} (Model: ${itemModelData.name}, Bg: ${selectedBackground?.name || 'Preset'})`,
                swatchUrl: itemSwatchUrl,
                aspectRatio: selectedAspectRatio
              };
              setGeneratedPoses(prev => [...prev, result]);
              return result;
            };
          });
          
          allBatchPromises.push(...garmentPoses);
        }

        results = [];
        // Process in parallel with concurrency limit (max 10 at a time)
        const unfilteredBatchResults: (PoseImage | null)[] = [];
        
        const concurrencyLimit = 10;
        const totalBatch = allBatchPromises.length;
        let completedBatch = 0;

        for (let i = 0; i < allBatchPromises.length; i += concurrencyLimit) {
          const chunk = allBatchPromises.slice(i, i + concurrencyLimit);
          setGenerationStatus(`Rendering batch items (${completedBatch} / ${totalBatch})...`);
          
          const chunkResults = await Promise.all(chunk.map(async (fn) => {
            try {
              return await fn();
            } catch (r: any) {
              console.error('Batch pose generation failed:', r);
              const rMsg = r?.message || String(r);
              if (rMsg.includes('QUOTA_EXCEEDED') || rMsg.includes('SPENDING_CAP_EXCEEDED') || rMsg.includes('429')) {
                throw r; // Propagate fatal errors to stop the loop
              }
              return null;
            }
          }));
          unfilteredBatchResults.push(...chunkResults);
          completedBatch += chunk.length;
          setGenerationProgress(Math.floor((completedBatch / totalBatch) * 100));
        }
        
        results.push(...unfilteredBatchResults.filter((r): r is PoseImage => r !== null));
      }
      
      if (results.length === 0) {
        throw new Error('All image generations failed. Please check the console for details or try again later.');
      }

      // Deduct exactly 1 credit securely upon success
      setGenerationStatus('Finalizing transaction...');
      await deductCredit();

      setGenerationStatus('Completed successfully!');
      setGenerationProgress(100);
    } catch (error: any) {
      console.error('Generation failed', error);

      const errorMsg = error?.message || String(error);
      
      if (errorMsg.includes('SPENDING_CAP_EXCEEDED') || errorMsg.includes('billing')) {
        alert('BILLING LIMIT REACHED: Your project has exceeded its spending cap for the Gemini API. Please check your billing settings and spending cap in the Google AI Studio settings or Google Cloud Console to continue generating images.');
      } else if (errorMsg.includes('QUOTA_EXCEEDED') || errorMsg.includes('429')) {
        alert('DAILY QUOTA REACHED: High-fidelity garment generation requires significant GPU resources. You have reached the maximum allowed generations for today. Please return tomorrow or check your plan details.');
      } else {
        alert('Generation failed. Please ensure your reference images are clear and that your model persona description is complete.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const [selectedPoses, setSelectedPoses] = useState<string[]>([]);

  const togglePoseSelection = (id: string) => {
    setSelectedPoses(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const applySplitComposition = async (modelImg: string, swatchImg: string): Promise<string> => {
    return new Promise((resolve) => {
      const model = new Image();
      const swatch = new Image();
      let loaded = 0;
      const check = () => {
        loaded++;
        if (loaded === 2) {
          const canvas = document.createElement('canvas');
          canvas.width = model.width;
          canvas.height = model.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(modelImg);
            return;
          }
          
          ctx.drawImage(model, 0, 0);
          
          // Calculate swatch dimensions (30% of main image width)
          const swatchSize = model.width * 0.3;
          const x = model.width - swatchSize - 20; // 20px padding from right
          const y = model.height - swatchSize - 20; // 20px padding from bottom
          
          // Draw swatch with a white border/frame and shadow
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 20;
          ctx.fillStyle = 'white';
          ctx.fillRect(x - 5, y - 5, swatchSize + 10, swatchSize + 10);
          
          ctx.shadowBlur = 0; // Reset shadow
          ctx.drawImage(swatch, x, y, swatchSize, swatchSize);
          
          // Add a subtle "Fabric Detail" badge
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          const labelHeight = Math.max(20, swatchSize * 0.15);
          ctx.fillRect(x, y + swatchSize - labelHeight, swatchSize, labelHeight);
          ctx.fillStyle = 'white';
          ctx.font = `bold ${Math.floor(labelHeight * 0.5)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText("FABRIC DETAIL", x + swatchSize / 2, y + swatchSize - labelHeight / 2);

          resolve(getOptimalDataUrl(canvas));
        }
      };
      model.onload = check;
      swatch.onload = check;
      model.onerror = () => resolve(modelImg);
      swatch.onerror = () => resolve(modelImg);
      model.src = modelImg;
      swatch.src = swatchImg;
    });
  };

  const applyWatermark = async (base64Img: string, name: string, logo: string | null, designCode?: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!name && !logo && !designCode) {
        resolve(base64Img);
        return;
      }
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Img);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        const padding = Math.max(20, img.width * 0.02);
        let startY = padding * 2;
        const nameFontSize = Math.max(32, img.width * 0.035);
        const codeFontSize = Math.max(42, img.width * 0.05);
        
        if (logo) {
          const logoImg = new Image();
          logoImg.crossOrigin = "anonymous";
          logoImg.onload = () => {
            const maxLogoWidth = img.width * 0.15;
            const logoRatio = logoImg.height / logoImg.width;
            let drawWidth = maxLogoWidth;
            let drawHeight = drawWidth * logoRatio;
            
            if (drawHeight > img.height * 0.15) {
               drawHeight = img.height * 0.15;
               drawWidth = drawHeight / logoRatio;
            }
            
            const logoX = img.width - drawWidth - padding;
            const logoY = padding;
            
            ctx.globalAlpha = 0.8;
            ctx.drawImage(logoImg, logoX, logoY, drawWidth, drawHeight);
            ctx.globalAlpha = 1.0;
            
            if (name) {
              startY = logoY + drawHeight + padding + (nameFontSize * 0.5);
              ctx.font = `bold ${nameFontSize}px Arial`;
              ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
              ctx.textAlign = "right";
              ctx.shadowColor = "rgba(0,0,0,0.6)";
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
              ctx.fillText(name, img.width - padding, startY);
            }
            if (designCode) {
              const codeY = name ? startY + (codeFontSize * 1.2) : (logoY + drawHeight + padding + (nameFontSize * 0.5));
              ctx.font = `bold ${codeFontSize}px Arial`;
              ctx.fillStyle = "rgba(255, 255, 255, 1)";
              ctx.strokeStyle = "rgba(0, 0, 0, 1)";
              ctx.lineWidth = Math.max(5, codeFontSize * 0.12);
              ctx.textAlign = "right";
              ctx.strokeText(designCode, img.width - padding, codeY);
              ctx.fillText(designCode, img.width - padding, codeY);
            }
            
            resolve(getOptimalDataUrl(canvas));
          };
          logoImg.onerror = () => resolve(base64Img);
          logoImg.src = logo;
        } else if (name) {
          ctx.font = `bold ${nameFontSize}px Arial`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.textAlign = "right";
          
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText(name, img.width - padding, startY);
          
          if (designCode) {
            ctx.font = `bold ${codeFontSize}px Arial`;
            ctx.fillStyle = "rgba(255, 255, 255, 1)";
            ctx.strokeStyle = "rgba(0, 0, 0, 1)";
            ctx.lineWidth = Math.max(5, codeFontSize * 0.12);
            ctx.textAlign = "right";
            ctx.strokeText(designCode, img.width - padding, startY + (codeFontSize * 1.2));
            ctx.fillText(designCode, img.width - padding, startY + (codeFontSize * 1.2));
          }
          
          resolve(getOptimalDataUrl(canvas));
        } else if (designCode) {
          ctx.font = `bold ${codeFontSize}px Arial`;
          ctx.fillStyle = "rgba(255, 255, 255, 1)";
          ctx.strokeStyle = "rgba(0, 0, 0, 1)";
          ctx.lineWidth = Math.max(5, codeFontSize * 0.12);
          ctx.textAlign = "right";
          ctx.strokeText(designCode, img.width - padding, startY);
          ctx.fillText(designCode, img.width - padding, startY);
          resolve(getOptimalDataUrl(canvas));
        } else {
           resolve(base64Img);
        }
      };
      img.onerror = () => resolve(base64Img);
      img.src = base64Img;
    });
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = async () => {
    const posesToExport = generatedPoses.filter(p => selectedPoses.length === 0 || selectedPoses.includes(p.id));
    if (posesToExport.length === 0) {
      alert("Please select at least one image to export.");
      return;
    }
    
    // Create PDF with dynamic page sizing
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < posesToExport.length; i++) {
      const pose = posesToExport[i];
      
      // Load image to determine true pixel dimensions (handles watermarks/split compositions properly)
      const imgProps = await new Promise<{width: number, height: number}>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({width: img.width, height: img.height});
        img.onerror = () => resolve({width: 3, height: 4}); // fallback
        img.src = pose.url;
      });

      const ratio = imgProps.height / imgProps.width;
      
      // Page setup based on true image aspect ratio
      const pageWidthBase = 210;
      const pageHeightBase = pageWidthBase * ratio;
      const orientation = ratio >= 1 ? 'p' : 'l';
      
      if (i === 0) {
        pdf.addPage([pageWidthBase, pageHeightBase], orientation);
        pdf.deletePage(1); // Remove initial a4 page
      } else {
        pdf.addPage([pageWidthBase, pageHeightBase], orientation);
      }
      
      // High-quality JPEG insertion at 1:1 scale to the page
      pdf.addImage(pose.url, 'JPEG', 0, 0, pageWidthBase, pageHeightBase, undefined, 'FAST');
    }
    
    pdf.save(`catalog_${new Date().getTime()}.pdf`);
  };

  const exportJPEG = async () => {
    const el = document.getElementById('catalog-preview');
    if (el) {
      const dataUrl = await toJpeg(el, { quality: 1.0, pixelRatio: window.devicePixelRatio * 2 || 3 });
      const link = document.createElement('a');
      link.download = `catalog.jpeg`;
      link.href = dataUrl;
      link.click();
    }
  };

  const exportPrintZip = async () => {
    const toDownload = selectedPoses.length > 0
      ? generatedPoses.filter(p => selectedPoses.includes(p.id))
      : generatedPoses;
      
    if (toDownload.length === 0) return;
    setGenerationStatus('Preparing high-res print files...');
    setIsGenerating(true);
    
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < toDownload.length; i++) {
        const pose = toDownload[i];
        const res = await fetch(pose.url);
        const blob = await res.blob();
        zip.file(`PRINT_300DPI_${pose.id}.jpg`, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `HighRes_Print_Ready_${Date.now()}.zip`;
      link.click();
    } catch (e) {
      console.error(e);
      alert('Failed to generate print zip.');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  return (
    <div className="space-y-8 pb-32 font-sans text-gray-900">
      {/* Premium Step & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4 mb-6 mt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-amber-500 uppercase">NanoBee Engine</h1>
          <p className="text-xs text-gray-500 font-medium">Create AI-draped model try-on images</p>
        </div>
        
        {/* Actions */}
        

        {/* Dynamic Studio Timeline */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide">
          {[
            { id: 1, num: '1', title: 'Assets' },
            { id: 2, num: '2', title: 'Compose' },
            { id: 3, num: '3', title: 'Renders' }
          ].map((s, idx) => (
            <div key={s.id} className="flex items-center shrink-0">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-bold uppercase tracking-wider",
                step === s.id ? "bg-gray-900 text-white border-gray-800" :
                step > s.id ? "bg-yellow-50 text-yellow-800 border-yellow-100" : "bg-white text-gray-500 border-gray-200"
              )}>
                <span>{s.title}</span>
                {step > s.id && <CheckCircle2 className="w-3 h-3 text-yellow-600 ml-1" />}
              </div>
              {idx < 2 && <ChevronRight className="w-3 h-3 text-gray-400 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Centralized Control Strip Hub */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 flex-wrap">
             <div className="flex items-center gap-3 flex-wrap text-[10px] leading-[20px]">
                {garmentCategory === 'Kurti' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3.5 py-2 bg-yellow-50 text-yellow-900 border border-yellow-200 rounded-xl text-[11px] font-bold h-11 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                    <span>Kurti Smart Set: Plain coordinating pyjamas/leggings/pants are automatically generated to complete the outfit!</span>
                  </motion.div>
                )}
               <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl h-11 flex items-center gap-2">
                 <Sparkles className="w-3.5 h-3.5 text-gray-900" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-800">Batch Catalog Workspace</span>
               </div>

               {/* Universal Category Switcher */}
               <div className="bg-gray-50 p-1 rounded-xl flex items-center h-11 gap-1">
                 <div className="pl-2 flex items-center gap-1.5">
                   <Layers className="w-3.5 h-3.5 text-gray-500" />
                   <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Global Category:</span>
                 </div>
                 <select
                   value={garmentCategory}
                   onChange={(e) => setGarmentCategory(e.target.value)}
                   className="h-9 flex-1 sm:w-36 bg-white border border-gray-200 rounded-lg px-3 text-[11.5px] leading-normal font-bold outline-none focus:ring-1 focus:ring-gray-900 transition-all cursor-pointer"
                 >
                   {GARMENT_CATEGORIES.map(c => (
                     <option key={c} value={c}>{c}</option>
                   ))}
                 </select>
               </div>
             </div>

             <div className="flex items-center gap-4 flex-wrap">
               {/* Aspect Ratio Box */}
               <div className="bg-gray-50 p-1 rounded-xl flex gap-1 h-10 w-full xs:w-auto sm:w-auto items-center overflow-x-auto scrollbar-hide">
                 <span className="pl-2 pr-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest inline">Aspect Ratio:</span>
                 {[{label: '12x12 in', value: '1:1'}, {label: '8x12 in', value: '3:4'}, {label: '12x9 in', value: '4:3'}].map(ratio => (
                   <button
                     key={ratio.value}
                     onClick={() => setSelectedAspectRatio(ratio.value)}
                     className={cn(
                       "px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all h-full flex items-center justify-center min-w-[48px] whitespace-nowrap",
                       selectedAspectRatio === ratio.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-500 font-semibold"
                     )}
                   >
                     {ratio.label}
                   </button>
                 ))}
               </div>

               {/* Intended Use Box */}
               <div className="bg-gray-50 p-1 rounded-xl flex gap-1 h-10 w-full xs:w-auto sm:w-auto items-center overflow-x-auto scrollbar-hide">
                 <span className="pl-2 pr-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest inline">Use Case:</span>
                 {[{label: 'E-commerce', value: 'ecommerce'}, {label: 'Printing (300 DPI)', value: 'print'}].map(use => (
                   <button
                     key={use.value}
                     onClick={() => setIntendedUse(use.value as 'ecommerce' | 'print')}
                     className={cn(
                       "px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all h-full flex items-center justify-center min-w-[48px] whitespace-nowrap",
                       intendedUse === use.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-500 font-semibold"
                     )}
                   >
                     {use.label}
                   </button>
                 ))}
               </div>

               {/* Resolution Box (Only for E-commerce) */}
               {intendedUse === 'ecommerce' && (
                 <div className="bg-gray-50 p-1 rounded-xl flex gap-1 h-10 w-full xs:w-auto sm:w-auto items-center overflow-x-auto scrollbar-hide">
                   <span className="pl-2 pr-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest inline">Quality:</span>
                   {['2K', '4K'].map(res => (
                     <button
                       key={res}
                       onClick={() => setSelectedResolution(res)}
                       className={cn(
                         "px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all h-full flex items-center justify-center min-w-[48px] whitespace-nowrap",
                         selectedResolution === res ? "bg-amber-500 text-amber-950 shadow-sm" : "text-gray-500 hover:text-gray-500 font-semibold"
                       )}
                     >
                       {res}
                     </button>
                   ))}
                 </div>
               )}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6 items-start">
            {/* LEFT SIDE: CREATIVE studio WORKSPACE */}
            <div className="space-y-4">
              {productionMode === 'single' ? (
                    <Card className={cn("p-4 sm:p-6 bg-white border shadow-sm transition-all relative overflow-hidden", garmentImages.length > 0 ? "border-gray-800" : "border-gray-200")}>
                      <div className="flex flex-col gap-4 mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                             <div className="w-1.5 h-6 bg-amber-400 rounded-full" />
                             <div className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-gray-900 shrink-0 hidden sm:flex">
                               <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 uppercase text-[10px] tracking-widest font-sans">Garment Blueprint Reference</h3>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Provide up to 5 reference drapes for 1:1 texture mapping</p>
                            </div>
                          </div>
                          {garmentImages.length < 5 && (
                            <label className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-gray-800 transition-all shadow-sm shrink-0 whitespace-nowrap">
                              Upload Shot
                              <input type="file" className="hidden" accept="image/*" multiple onChange={handleGarmentUpload} />
                            </label>
                          )}
                        </div>

                        {/* Configuration Row */}
                        <div className="p-4 bg-white border border-gray-200 rounded-xl">
                          <div className="space-y-4">
                            <div>
                              <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block font-sans mb-2">Garment Description Name</label>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <input 
                                  type="text" 
                                  value={garmentName}
                                  onChange={(e) => setGarmentName(e.target.value)}
                                  placeholder="Enter description name..."
                                  className="sm:col-span-9 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-gray-900 placeholder:text-gray-500"
                                />
                                <div className="sm:col-span-3 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                                  {garmentCategory}
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block font-sans mb-2">Design Number</label>
                              <input 
                                type="text" 
                                value={garmentDesignNumber}
                                onChange={(e) => setGarmentDesignNumber(e.target.value)}
                                placeholder="Enter design number (e.g. #D-4012)..."
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-gray-900 placeholder:text-gray-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Upload Drop Zone / Gallery */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {garmentImages.map((img, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white group">
                            <img src={img} crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-full h-full object-contain p-2" />
                            <button 
                              onClick={() => removeGarmentImage(i)}
                              className="absolute top-2 right-2 bg-white p-1.5 rounded-xl shadow-md text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-wrap flex items-center justify-center w-8 h-8 shrink-0 z-20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-2 left-2 bg-gray-900/60 backdrop-blur-sm text-[8px] text-white px-1.5 py-0.5 rounded font-mono font-bold">
                              Angle {i + 1}
                            </div>
                          </div>
                        ))}
                        
                        {garmentImages.length === 0 && (
                          <label className="col-span-full flex flex-col items-center justify-center aspect-[21/9] border border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-gray-800 hover:bg-white/50 transition-all group py-3">
                            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center mb-3 group-hover:bg-gray-50">
                              <ImageIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-900 transition-colors" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900 transition-colors">Select base garment photographs</span>
                            <p className="text-[9px] text-gray-500 mt-1">Accepts multiple file angles (optimal for 3D simulation mapping)</p>
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleGarmentUpload} />
                          </label>
                        )}
                      </div>
                    </Card>
                  ) : (
                /* Batch Queue Workspace Layout */
                <Card className="p-4 sm:p-5 bg-white border border-gray-200 shadow-sm relative rounded-3xl">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4 relative">
                     <div className="hidden sm:flex w-1.5 h-6 bg-amber-400 rounded-full shrink-0" />
                     <div className="flex-1 w-full">
                       <div className="flex items-center gap-2 mb-4">
                         <div className="sm:hidden w-1.5 h-5 bg-amber-400 rounded-full" />
                         <h3 className="font-bold text-gray-900 uppercase text-[10px] tracking-widest font-sans">Batch Production Queue ({batchItems.length})</h3>
                       </div>
                       <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                         <label className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 shadow-sm transition-all cursor-pointer h-11 sm:h-10">
                            <Upload className="w-3.5 h-3.5" />
                            Bulk Upload Garments
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleBulkUpload} />
                         </label>
                         {batchItems.length > 0 && (
                           <button 
                             onClick={handleAutoRandomize}
                             className="px-3.5 py-2 border border-gray-200 hover:border-gray-800 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all h-11 sm:h-10"
                           >
                             Optimize Casts
                           </button>
                         )}
                       </div>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {batchItems.map((item, i) => (
                      <div key={i} className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md relative group">
                         <div className="relative w-full aspect-[3/4] bg-white border-b border-gray-200 rounded-t-2xl">
                           {item.images.length > 0 ? (
                              <img src={item.images[0]} crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-full h-full object-contain p-2" />
                           ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                 <ImageIcon className="w-7 h-7" />
                              </div>
                           )}
                           <button 
                             onClick={() => removeBatchItem(i)}
                             className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-xl text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-55 shadow-sm text-wrap flex items-center justify-center w-8 h-8 z-20 shrink-0"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         </div>
                         <div className="p-3 bg-white">
                           <input 
                             type="text" 
                             value={item.name}
                             onChange={(e) => {
                               setBatchItems(prev => {
                                 const next = [...prev];
                                 next[i] = { ...next[i], name: e.target.value };
                                 return next;
                               });
                             }}
                             placeholder="Garment Name"
                             className="w-full bg-white border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-800 text-gray-800 text-[11px] font-bold outline-none rounded-lg px-2.5 py-1.5 transition-colors placeholder:text-gray-500 mb-2"
                           />
                           <input 
                             type="text" 
                             value={item.designNumber}
                             onChange={(e) => {
                               setBatchItems(prev => {
                                 const next = [...prev];
                                 next[i] = { ...next[i], designNumber: e.target.value };
                                 return next;
                               });
                             }}
                             placeholder="Design # Code"
                             className="w-full bg-white border border-gray-200 focus:bg-white focus:ring-1 focus:ring-gray-900 focus:border-gray-800 text-gray-800 text-[11px] font-bold outline-none rounded-lg px-2.5 py-1.5 transition-colors placeholder:text-gray-500"
                           />
                           <div className="mt-2 text-[8px] font-bold text-gray-500 uppercase tracking-widest text-center px-2 py-0.5 bg-gray-50 rounded">
                             {garmentCategory}
                           </div>
                         </div>
                      </div>
                    ))}
                    
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-gray-800 hover:bg-white transition-all group p-4 min-h-[100px] aspect-[3/4]">
                      <Plus className="w-6 h-6 text-gray-500 group-hover:text-gray-900 mb-2 transition-colors" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900 transition-colors text-center leading-relaxed">Add Item<br/>Drop</span>
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleBulkUpload} />
                    </label>
                  </div>
                </Card>
              )}
              
              
            </div>

            {/* RIGHT SIDE: CONTROLS & MODEL SIDEBAR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Model Casting Reference */}
              <Card className={cn("p-4 border transition-all bg-white shadow-sm rounded-2xl", selectedModelId ? "border-gray-800" : "border-gray-200")}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-900 shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="w-1.5 h-4 bg-amber-400 rounded-full" /><h3 className="font-bold text-gray-900 uppercase text-[10px] tracking-widest font-sans">Model</h3>
                  </div>
                  
                  <label className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 hover:border-gray-800 transition-all cursor-pointer group flex items-center justify-center sm:w-auto w-full">
                     <Upload className="w-3.5 h-3.5 group-hover:scale-110 transition-transform mr-1.5 sm:mr-0" />
                     <span className="sm:hidden text-xs font-bold">Upload Custom</span>
                     <input type="file" className="hidden" accept="image/*" onChange={handleModelLibraryUpload} />
                  </label>
                </div>

                <div className="space-y-4">
                  {/* Library Grid list */}
                  <div className="grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto pr-1 select-none custom-scrollbar pb-1">
                    {customModels.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(m.id);
                          setModelImage(m.url);
                          setModelPrompt(m.basePrompt);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-xl border transition-all group text-left relative overflow-hidden h-11 shrink-0",
                          selectedModelId === m.id ? "bg-gray-900 text-white border-gray-800 shadow-md shadow-black/10" : "bg-white text-gray-500 border-gray-200 hover:border-gray-800 hover:bg-gray-50 font-sans"
                        )}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden w-full pr-1">
                           <img src={m.url} crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-6.5 h-6.5 rounded-full flex-shrink-0 object-cover border border-gray-200 bg-gray-50" />
                           <span className="text-[9px] font-black uppercase tracking-widest truncate">{m.name}</span>
                        </div>
                        {selectedModelId === m.id ? (
                          <div className="ml-1 shrink-0 bg-white text-gray-900 p-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-gray-900" />
                          </div>
                        ) : (
                          <Trash2 
                            className="w-3 h-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-650 flex-shrink-0" 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeModel(m.id);
                            }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {customModels.length === 0 && (
                    <div className="py-6 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-relaxed">
                        No custom faces uploaded yet<br/>Using default auto-model
                      </p>
                    </div>
                  )}

                  <label className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 hover:border-gray-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-white/40 cursor-pointer transition-all group font-sans">
                    <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Upload Custom Model face
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleModelLibraryUpload} />
                  </label>
                </div>
              </Card>

                  {/* Global Background */}
                   <Card className={cn("p-4 border transition-all bg-white shadow-sm rounded-2xl", selectedBackground ? "border-gray-800" : "border-gray-200")}>
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                         <div className="flex items-center gap-2">
                           <div className="w-8 h-8 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center text-gray-900">
                             <Mountain className="w-4 h-4" />
                           </div>
                           <div className="w-1.5 h-4 bg-amber-400 rounded-full" /><h3 className="font-bold text-gray-900 uppercase text-[10px] tracking-widest font-sans">Background</h3>
                         </div>
                         <label className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 hover:border-gray-800 transition-all cursor-pointer group flex items-center justify-center sm:w-auto w-full">
                            <Upload className="w-3.5 h-3.5 group-hover:scale-110 transition-transform mr-1.5 sm:mr-0" />
                            <span className="sm:hidden text-xs font-bold">Upload Custom</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                         </label>
                       </div>
                       
                       <div className="space-y-4">
                         <div className="flex flex-wrap gap-1.5 mb-2">
                            {BACKGROUND_PRESETS.map(preset => (
                              <button
                                key={preset.id}
                                onClick={() => {
                                  setSelectedBackgroundPreset(preset.name);
                                  setAtmospherePrompt(preset.prompt);
                                }}
                                className={cn(
                                  "px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-wider transition-all",
                                  selectedBackgroundPreset === preset.name 
                                    ? "bg-gray-900 border-gray-800 text-white shadow-sm" 
                                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-800 hover:text-gray-900"
                                )}
                              >
                                {preset.name}
                              </button>
                            ))}
                         </div>

                         <textarea
                           value={atmospherePrompt}
                           onChange={(e) => {
                             setAtmospherePrompt(e.target.value);
                             setSelectedBackgroundPreset('Custom');
                           }}
                           placeholder="Describe background context, studio lights, or environment (e.g. 'Photorealistic studio, soft bounce lighting, white background')"
                           className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-semibold leading-relaxed resize-none h-12 focus:bg-white focus:outline-none focus:border-gray-800 focus:ring-1 focus:ring-gray-900 placeholder:text-gray-500 text-gray-500 shadow-sm transition-all font-sans"
                         />
                         
                         <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-2 custom-scrollbar">
                           {customBackgrounds.map(bg => (
                           <button 
                             key={bg.id} 
                             onClick={() => setSelectedBackground(bg)}
                             className={cn(
                               "w-full text-left p-2 rounded-xl border transition-all text-[9.5px] font-bold uppercase tracking-widest flex items-center justify-between group h-11 shrink-0 font-sans",
                               selectedBackground?.id === bg.id ? "bg-gray-900 text-white border-gray-800 shadow-md" : "bg-white text-gray-500 border-gray-200 hover:border-gray-800 hover:bg-gray-50"
                             )}
                           >
                             <span className="flex items-center gap-2 truncate">
                                {bg.id.startsWith('custom-') ? (
                                    <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 text-inherit" />
                                 ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-100 group-hover:bg-gray-900" />
                                 )}
                                {bg.name}

                             </span>
                             {bg.id.startsWith('custom-') && (
                                <Trash2 
                                  className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 flex-shrink-0" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomBackgrounds(prev => prev.filter(b => b.id !== bg.id));
                                    if (selectedBackground?.id === bg.id) setSelectedBackground(null);
                                  }}
                                />
                             )}
                           </button>
                         ))}
                       </div>
                       </div>
                     </Card>

                     {/* Global Pose Setup */}
                    <Card className="p-4 border transition-all bg-white shadow-sm rounded-2xl">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100"><div className="flex items-center gap-2.5"><div className="w-1.5 h-4 bg-amber-400 rounded-full" /><h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest font-sans">Select Default Shoot Angles</h4></div></div><div>
                           <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                              <div className="flex gap-1.5">
                                 {[3, 5, 10].map(n => (
                                   <button 
                                     key={n}
                                     onClick={() => setSelectedPoseIndices(Array.from({length: n}, (_, i) => i))}
                                     className="text-[8px] font-bold uppercase px-2 py-1.5 rounded bg-slate-50 border border-slate-200 hover:border-gray-800 hover:bg-gray-900 hover:text-white transition-all"
                                   >
                                     Top {n}
                                   </button>
                                 ))}
                                 <button 
                                   onClick={() => {
                                     const shuffled = [...Array(POSES.length).keys()].sort(() => 0.5 - Math.random());
                                     setSelectedPoseIndices(shuffled.slice(0, 3));
                                   }}
                                   className="text-[8px] font-bold uppercase px-2 py-1.5 rounded bg-slate-50 border border-slate-200 hover:border-gray-800 hover:bg-gray-900 hover:text-white transition-all"
                                 >
                                   Random 3
                                 </button>
                              </div>
                              <div className="flex gap-1.5">
                                 <button 
                                   onClick={() => setSelectedPoseIndices([...Array(POSES.length).keys()])}
                                   className="text-[8px] font-bold uppercase px-2 py-1.5 rounded bg-slate-50 border border-slate-200 hover:border-gray-800 hover:bg-gray-900 hover:text-white transition-all"
                                 >
                                   Select All
                                 </button>
                                 <button 
                                   onClick={() => setSelectedPoseIndices([])}
                                   className="text-[8px] font-bold uppercase px-2 py-1.5 rounded bg-red-50 border border-red-100 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                                 >
                                   Clear All
                                 </button>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {POSES.map((pose, idx) => (
                               <button 
                                 key={idx}
                                 onClick={() => {
                                    setSelectedPoseIndices(prev => 
                                      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                    );
                                 }}
                                 className={cn(
                                   "text-[9.5px] font-black uppercase tracking-widest p-2 rounded-lg border transition-all text-left flex items-center justify-between font-sans min-h-[40px] leading-normal",
                                   selectedPoseIndices.includes(idx) ? "bg-gray-900 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-200 hover:text-gray-900"
                                 )}
                               >
                                 <span className="mr-2 whitespace-normal break-words leading-relaxed pr-1 text-inherit inline-block w-full text-left font-sans">{pose.split(',')[0]}</span>
                                 {selectedPoseIndices.includes(idx) && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                               </button>
                            ))}
                          </div>
                        </div></Card>

                    {/* Brand Overlays & Material Swatches */}
                    <Card className="p-4 border transition-all bg-white shadow-sm rounded-2xl">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100"><div className="flex items-center gap-2.5"><div className="w-1.5 h-4 bg-amber-400 rounded-full" /><h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest font-sans">Brand Settings & Overlays</h4></div></div><div className="space-y-4 font-sans">
                          {/* Shop Name */}
                          <div className="space-y-1">
                            <label className="block text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest font-sans">Brand / Shop Name</label>
                            <input 
                              type="text" 
                              value={shopName}
                              onChange={(e) => setShopName(e.target.value)}
                              placeholder="e.g. Trendy Boutique"
                              className="w-full px-3 py-2 bg-white border rounded-xl text-xs font-semibold outline-none border-gray-200 focus:bg-white focus:border-gray-800 focus:ring-1 focus:ring-gray-900 placeholder:text-gray-500 text-gray-800 transition-all font-sans"
                            />
                          </div>

                          {/* Shop Logo upload */}
                          <div className="space-y-1">
                             <label className="block text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest font-sans">Brand watermark logo</label>
                             <div className="flex items-center gap-3">
                                {shopLogo && (
                                  <div className="relative w-11 h-11 border border-gray-200 rounded-xl bg-white p-1 shrink-0">
                                    <img src={shopLogo} alt="Logo" crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-full h-full object-contain rounded-lg" />
                                    <button 
                                      type="button"
                                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-650 shadow-sm"
                                      onClick={() => setShopLogo(null)}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )}
                                <label className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 hover:border-gray-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-white/50 cursor-pointer transition-all font-sans">
                                  <Plus className="w-3.5 h-3.5" />
                                  Upload watermark Logo
                                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                </label>
                             </div>
                          </div>

                          {/* Material Swatch Toggle */}
                          <div className="pt-2 border-t border-gray-100">
                            <label className="flex items-center gap-3 cursor-pointer group w-fit select-none">
                              <button 
                                type="button"
                                onClick={() => setIncludeMaterialSwatch(!includeMaterialSwatch)}
                                className={cn(
                                  "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                  includeMaterialSwatch ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 group-hover:border-gray-800"
                                )}
                              >
                                {includeMaterialSwatch && <Check className="w-3 h-3 text-white stroke-[3.5]" />}
                              </button>
                              <div>
                                 <span className="text-[10px] font-black text-gray-800 uppercase tracking-wider block leading-relaxed">Include Material Swatch Overlay</span>
                                 <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest font-mono">Prints standard texture swatches in corner</p>
                              </div>
                            </label>
                          </div>
                        </div>
                    </Card>
                </div>
              </div>

            {/* Proceed to Production Full Width Bar */}
            <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8 flex justify-center w-full pb-8 sm:pb-0 z-30">
              <Button 
                size="lg" 
                disabled={step === 1 && (productionMode === 'single' ? garmentImages.length === 0 : batchItems.every(b => b.images.length === 0))}
                onClick={() => { window.scrollTo(0, 0); setStep(2); }}
                className="w-full max-w-md sm:max-w-none sm:w-auto h-14 px-8 sm:h-16 sm:px-16 rounded-2xl shadow-xl shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black tracking-widest uppercase transition-all flex items-center justify-center gap-3 text-[11px] group"
              >
                Proceed to Production
                <div className="bg-amber-950/10 p-1.5 rounded-full group-hover:bg-amber-950/20 transition-colors">
                  <ChevronRight className="w-4 h-4 text-amber-950" />
                </div>
              </Button>
            </div>
            </div>
      )}

      {step === 2 && (
        <div className="max-w-xl mx-auto py-12 animate-in zoom-in-95 duration-500">
           <Card className="p-8 text-center bg-white border border-gray-200 shadow-lg rounded-3xl animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-gray-900 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 rotate-6 group">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {productionMode === 'single' ? "Deep Dive Generation" : "Batch Production engaged"}
              </h2>
              <p className="text-slate-500 text-sm mb-8">
                {productionMode === 'single' 
                  ? `Replicating 8K textures from your multi-angle references into ${POSES.filter((_, i) => selectedPoseIndices.includes(i)).length} cinematic poses.` 
                  : `Synthesizing ${batchItems.filter(b => b.images.length > 0).length} distinct garments onto your chosen model identity synchronously.`}
              </p>
              
              <div className="bg-white border border-gray-200 shadow-inner rounded-3xl p-5 mb-8">
                 <div className="flex items-center justify-center gap-8">
                    <div className="relative">
                       {(modelImage || getModelData(selectedModelId).url) ? (
                           <img src={modelImage || getModelData(selectedModelId).url || undefined} crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-20 h-20 rounded-2xl object-cover shadow-lg border-2 border-white" />
                        ) : (
                           <div className="w-20 h-20 rounded-2xl bg-slate-200 shadow-lg border-2 border-white flex items-center justify-center text-slate-400 text-[10px]">Model</div>
                        )}
                       <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white p-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                       </div>
                    </div>
                    <div className="text-left space-y-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {productionMode === 'single' ? "Single Garment" : "5 Item Queue"}
                       </p>
                       <p className="text-sm font-bold text-slate-900">
                          {productionMode === 'single' ? `${garmentImages.length} Reference Views` : `${batchItems.filter(b => b.images.length > 0).length} Assets Loading`}
                       </p>
                       {productionMode === 'single' && (
                         <span className="inline-block text-[9px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-full">
                            {selectedBackground?.name || 'Using Style Preset'}
                         </span>
                       )}
                    </div>
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleStartGeneration} 
                  isLoading={isGenerating}
                  className="w-full h-14 rounded-2xl shadow-lg bg-gray-900 hover:bg-gray-900 text-white font-black font-sans uppercase tracking-widest text-[11px]"
                >
                  {isGenerating ? "Executing Neural Draping..." : "Initiate Full Render"}
                </Button>
                <Button variant="ghost" onClick={() => setStep(1)} disabled={isGenerating}>Replay Config</Button>
              </div>
           </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
           <div className="flex flex-col sm:flex-row sm:items-end justify-between px-2 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tighter">8K Master Renders</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {selectedPoses.length > 0 ? `${selectedPoses.length} Assets Selected` : "High-Fidelity Selection Queue"}
                </p>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={exportPrintZip} className="rounded-full shadow-sm hover:shadow-md h-10 px-6 flex-1 sm:flex-none border-amber-500 text-amber-900 bg-amber-50/50 hover:bg-amber-100 uppercase tracking-widest font-black text-[10px]">
                  Prepare for Print (Zip)
                </Button>
                <Button variant="outline" size="sm" onClick={exportJPEG} className="rounded-full shadow-sm hover:shadow-md h-10 px-6 flex-1 sm:flex-none">
                  Save All JPEG
                </Button>
                <Button onClick={exportPDF} className="rounded-full shadow-lg h-10 px-8 bg-gray-900 hover:bg-slate-800 flex-1 sm:flex-none">
                  Generate PDF {selectedPoses.length > 0 ? `(${selectedPoses.length})` : ""}
                </Button>
              </div>
           </div>

           <div id="catalog-preview" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedPoses.map((pose, i) => (
                <motion.div
                  key={pose.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, i)}
                    className={cn("cursor-grab active:cursor-grabbing", draggedPoseIndex === i ? "opacity-50 scale-95" : "")}
                  >
                    <Card className={cn(
                      "p-3 bg-white border-slate-100 group relative transition-all duration-300",
                      selectedPoses.includes(pose.id) ? "ring-2 ring-gray-900 border-gray-800 shadow-lg" : "hover:shadow-lg hover:border-gray-200"
                    )}>
                    <div 
                      className={cn(
                        "relative overflow-hidden rounded-xl bg-slate-50 cursor-pointer",
                        pose.aspectRatio === '1:1' ? "aspect-square" :
                        pose.aspectRatio === '3:4' ? "aspect-[3/4]" :
                        pose.aspectRatio === '4:3' ? "aspect-[4/3]" :
                        pose.aspectRatio === '9:16' ? "aspect-[9/16]" :
                        pose.aspectRatio === '16:9' ? "aspect-[16/9]" : "aspect-[3/4]"
                      )}
                      onClick={() => togglePoseSelection(pose.id)}
                    >
                      <img src={pose.url} crossOrigin="anonymous" referrerPolicy="no-referrer" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 bg-slate-50" />
                      
                      {/* Selection Overlay */}
                      <div className={cn(
                        "absolute inset-0 bg-gray-900/20 flex items-center justify-center transition-opacity",
                        selectedPoses.includes(pose.id) ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-2 border-white transition-all",
                          selectedPoses.includes(pose.id) ? "bg-white text-gray-900 scale-110 shadow-lg" : "text-white"
                        )}>
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 px-1">
                       <span className="bg-slate-100 text-[9px] text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                          {pose.poseType.split(':')[1]?.trim() || pose.poseType}
                       </span>
                       <button 
                         onClick={() => downloadImage(pose.url, `render-${pose.id}.png`)}
                         className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-gray-900 transition-colors"
                         title="Download Single Image"
                       >
                          <Download className="w-4 h-4" />
                       </button>
                    </div>

                    {/* Batch Asset Label Attachment */}
                    {pose.poseType.includes('Asset') && (
                       <div className="absolute top-6 left-6">
                          <span className="bg-gray-900/80 text-[8px] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest backdrop-blur-sm shadow-lg border border-white/20">
                             {pose.poseType.split(':')[0]}
                          </span>
                       </div>
                    )}
                  </Card>
                  </div>
                </motion.div>
              ))}
              
              {isGenerating && (
                <Card className={cn(
                  "aspect-[3/4] p-8 border-none bg-slate-50 flex flex-col items-center justify-center text-center transition-all rounded-3xl min-h-[400px]",
                  generatedPoses.length > 0 ? "col-span-1" : "col-span-full max-w-sm mx-auto w-full"
                )}>
                   <div className="w-full mx-auto flex flex-col items-center">
                     <Loader2 className="w-8 h-8 animate-spin text-slate-300 mb-8" />
                     
                     <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3 overflow-hidden shadow-inner">
                       <div 
                         className="bg-gray-900 h-1.5 rounded-full transition-all duration-300 ease-out"
                         style={{ width: `${generationProgress}%` }}
                       ></div>
                     </div>
                     
                     <div className="w-full text-center space-y-1">
                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                          {Math.floor(generationProgress)}%
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {generationStatus || 'Starting...'}
                        </p>
                     </div>
                     
                     <p className="text-[8px] text-slate-400 mt-6 max-w-[260px] leading-relaxed">
                       Please keep this window open. High-fidelity renders require significant processing time.
                     </p>
                   </div>
                </Card>
              )}
              
              <Card className="aspect-[3/4] p-8 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center group hover:border-gray-800 cursor-pointer transition-all rounded-3xl" onClick={() => setStep(1)}>
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-gray-900 group-hover:text-white transition-all">
                     <Plus className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs">New Project</h4>
              </Card>
           </div>
        </div>
      )}
    </div>
  );
}
