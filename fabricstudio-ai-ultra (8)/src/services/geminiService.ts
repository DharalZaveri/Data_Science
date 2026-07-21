import { GoogleGenAI } from "@google/genai";

async function fetchServerGenerateContent(payload: any, maxRetries = 3): Promise<any> {
  let retries = 0;
  while (retries <= maxRetries) {
    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw { status: response.status, data, message: data.error || 'Server error' };
        }
        throw new Error(data.error || 'Failed to call Gemini API via server proxy');
      }
      
      return data;
    } catch (error: any) {
      if (error.status === 429 || error.status >= 500) {
        if (retries >= maxRetries) {
          throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
        }
        retries++;
        const backoffTime = Math.min(2000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
        console.warn(`API overloaded (Status ${error.status}). Retrying in ${Math.round(backoffTime/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        throw error;
      }
    }
  }
}

export interface GeneratePoseParams {
  garmentType: string;
  garmentCategory?: string; // New
  color: string;
  pattern: string;
  fabric: string;
  modelPrompt?: string;
  pose: string;
  description: string;
  referenceImages: string[]; // Up to 5 base64 garment images
  styleReferenceImage?: string; // Global sample for drape/style
  jewelryImages?: string[]; // Up to 3 base64 jewelry images
  modelImage?: string; // Base64 model image
  backgroundImage?: string; // Base64 custom background image
  backgroundPrompt: string;
  sheen?: number;
  roughness?: number;
  weaveIntensity?: number;
  includeMaterialSwatch?: boolean; // New
  aspectRatio?: string; // New: "1:1", "3:4", "4:3", "9:16", "16:9"
  imageResolution?: string; // "1K", "2K", "4K"
  autoCompleteSet?: boolean; // New: Add matching pieces if partial set
}

const urlToBase64Cache: { [url: string]: string } = {};

async function imageUrlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url.split(',')[1];
  if (urlToBase64Cache[url]) return urlToBase64Cache[url];
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Resize image to ensure payload isn't too large (Gemini has limits)
    const base64 = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Balanced dimension for performance/quality
        const maxDim = 512;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG with 0.6 quality to keep size very small and fast
        const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        resolve(b64);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(blob);
    });
    
    urlToBase64Cache[url] = base64;
    return base64;
  } catch (error) {
    console.error('Failed to convert image URL to base64:', error);
    throw new Error('Image fetch failed');
  }
}

export async function generateMaterialSwatch(params: { garmentImages: string[], fabric: string, description: string }): Promise<string> {
  const parts: any[] = [];

  const garmentBase64s = await Promise.all(params.garmentImages.map(img => imageUrlToBase64(img)));
  
  for (const base64Data of garmentBase64s) {
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: "image/png"
      }
    });
  }

  const promptText = `
    MATERIAl SWATCH GENERATOR - ULTRA-MACRO MASTER PHOTOGRAPHY.
    OBJECTIVE: Generate a hyper-realistic, microscopic "swatch" of the provided fabric for a luxury catalog.
    
    CRITICAL INSTRUCTIONS:
    - NO PEOPLE, NO MODELS, NO FACES, NO BACKGROUNDS: The image MUST ONLY contain the fabric itself, edge-to-edge.
    - MACRO TEXTURE: Focus extremely tightly on the microscopic grain of the ${params.fabric}. Render individual thread crossings, weave patterns (e.g., twill, satin, plain), and the characteristic fuzz or sheen of the material.
    - LIGHTING: Use directional glancing light to cast tiny shadows across the weave, emphasizing the depth and "hand" of the fabric.
    - CONSISTENCY: The color, pattern scale, and embroidery details MUST be a 1:1 match to the reference images.
    - PHYSICAL PROPERTIES:
        - If Silk: High luster, anisotropic sheen, fluid micro-folds.
        - If Cotton: Soft matte finish, visible fiber twist, crisp shadows in folds.
        - If Linen: Distinctive slub texture, irregular weave density.
        - If Wool: Visible fiber crown, soft surface texture.
        - If Embroidery: Render individual stitches with physical height and light interaction.
    - ASPECT RATIO: 1:1 (Square).
    
    GARMENT CONTEXT: ${params.description}
    SAFETY GUIDANCE: Do not include full humans, realistic faces, or sensitive content, strictly just the cropped macro fabric/texture alone.
  `;

  parts.push({ text: promptText });

  const executeGeneration = async (modelName: string): Promise<string> => {
    const response = await fetchServerGenerateContent({
      model: modelName,
      contents: {
        parts: parts,
      },
      config: {
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ] as any,
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

      const resParts = response.candidates?.[0]?.content?.parts || [];
      const finishReason = response.candidates?.[0]?.finishReason;
      
      for (const part of resParts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      if (finishReason === 'SAFETY' || finishReason === 'IMAGE_OTHER') {
        throw new Error(`Generation rejected by safety filters.`);
      }

      console.error('Swatch API returned no image. Full response:', JSON.stringify(response));
      throw new Error('No swatch image generated');
  };

  const modelChain = ['gemini-2.5-flash-image'];
  let lastError: any = null;

  for (const modelName of modelChain) {
    try {
      return await executeGeneration(modelName);
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${modelName} failed for swatch, trying next in chain...`, err);
    }
  }

  const finalMsg = typeof lastError?.message === 'string' ? lastError.message : String(lastError);
  if (finalMsg.includes('spending cap') || finalMsg.includes('monthly spending cap')) {
     throw new Error('SPENDING_CAP_EXCEEDED');
  }
  
  throw lastError || new Error('All swatch generations failed');
}

export async function generateGarmentPose(params: GeneratePoseParams): Promise<string> {
  const parts: any[] = [];

  // Background Reference (if custom image)
  const bgPromise = params.backgroundImage ? imageUrlToBase64(params.backgroundImage) : Promise.resolve(null);
  
  const garmentPromises = (params.referenceImages || []).map(img => imageUrlToBase64(img));
  const jewelryPromises = (params.jewelryImages || []).map(img => imageUrlToBase64(img));
  const modelPromise = params.modelImage ? imageUrlToBase64(params.modelImage) : Promise.resolve(null);
  const stylePromise = params.styleReferenceImage ? imageUrlToBase64(params.styleReferenceImage) : Promise.resolve(null);

  const [bgBase64, garmentBase64s, jewelryBase64s, modelBase64, styleBase64] = await Promise.all([
    bgPromise,
    Promise.all(garmentPromises),
    Promise.all(jewelryPromises),
    modelPromise,
    stylePromise
  ]);

  if (bgBase64) {
    parts.push({
      inlineData: {
        data: bgBase64,
        mimeType: "image/png"
      }
    });
    parts.push({
      text: `ENVIRONMENT REFERENCE UPLOADED. This is the background for the catalog. Use this EXACT location/setting for the scene.`
    });
  }
  
  if (garmentBase64s.length > 0) {
    for (const data of garmentBase64s) {
      parts.push({
        inlineData: {
          data: data,
          mimeType: "image/png"
        }
      });
    }
    parts.push({
      text: `SUBJECT REFERENCE (PRIMARY GARMENT / BASE DRESS): THIS IS THE MAIN CLOTHING. It is the base layer. Under NO CIRCUMSTANCES should this be shown as a secondary accessory. \n\nCRITICAL DIRECTIVE ON DESIGN PATTERNS: YOU MUST act as a precise scanner. You MUST perfectly preserve its intricate patterns, material texture, color palette, borders, embroidery, and overall design. Do NOT alter the colors or design. If it's a Saree with specific work (like floral motifs or heavy stone work), you MUST replicate that exact work. Do not hallucinate or change the work/design under any condition.`
    });
  }

  // General Style/Draping Reference
  if (styleBase64) {
    parts.push({
      inlineData: {
        data: styleBase64,
        mimeType: "image/png"
      }
    });
    parts.push({
      text: `STYLE AND DRAPING REFERENCE UPLOADED (POSE/DRAPE ONLY). \n\nCRITICAL DIRECTIVE: This image is SOLELY for referencing HOW the clothes are worn (the silhouette, draping, and pose). \n\nYOU ARE STRICTLY FORBIDDEN from taking the model's face, identity, skin tone, or body from this image. YOU MUST ALSO NOT take any color, pattern, design, print, embroidery, or fabric material from the clothing in this image. \n\nABSOLUTE RULE: The final output MUST preserve the EXACT face of the uploaded Model Reference, and the EXACT design/color of the uploaded Garment References. ONLY use this style image as an invisible mannequin pose/drape template.`
    });
  }

  // Jewelry References
  if (jewelryBase64s.length > 0) {
    for (const data of jewelryBase64s) {
      parts.push({
        inlineData: {
          data: data,
          mimeType: "image/png"
        }
      });
    }
    parts.push({
      text: `JEWELRY REFERENCES UPLOADED (${jewelryBase64s.length} images). These are specific accessories the model MUST wear.`
    });
  }

  // Model Reference
  if (modelBase64) {
    parts.push({
      inlineData: {
        data: modelBase64,
        mimeType: "image/png"
      }
    });
    parts.push({
      text: `SUBJECT REFERENCE (PERSON/MODEL): THIS IS THE ANCHOR IDENTITY. THIS IS A PIXEL-PERFECT CLONE TASK. The face, facial features, eyes, nose, lips, hair, skin tone, and body type MUST be 100% IDENTICAL and indistinguishable from this person. DO NOT ALTER, MERGE, OR CHANGE THE FACE. THIS PERSON IS THE ONLY FACE THAT CAN APPEAR.`
    });
  }

  const categoryRaw = params.garmentCategory || '';
  const catLower = categoryRaw.toLowerCase();
  const nameLower = (params.garmentType || '').toLowerCase();
  const fabricLower = (params.fabric || '').toLowerCase();
  const descLower = (params.description || '').toLowerCase();

  const isKurti = catLower.includes('kurti') || catLower.includes('kurty') || catLower.includes('kurties') || 
                  nameLower.includes('kurti') || nameLower.includes('kurty') || nameLower.includes('kurties') ||
                  descLower.includes('kurti') || descLower.includes('kurty') || descLower.includes('kurties');

  const isMale = catLower.includes('shirt') || catLower.includes('pant') || catLower.includes('sherwani') || 
                 catLower.includes('kurta (men)') || catLower.includes('indo-western') || catLower.includes('shorts') || 
                 catLower.includes('tracksuit') || catLower.includes('trackpants') ||
                 nameLower.includes('shirt') || nameLower.includes('pant') || nameLower.includes('sherwani') || 
                 nameLower.includes('kurta') || nameLower.includes('indo-western');

  let jewelryInstruction = '';

  if (isMale) {
    jewelryInstruction = `MALE FASHION ACCESSORY PROTOCOL:
        - STRICT ACCESSORY LOCK: The model MUST be styled appropriately for menswear.
        - Include: A premium men's wristwatch (leather or metal strap), and perhaps subtle sunglasses or a pocket square if it suits the garment.
        - STRICT PROHIBITION: DO NOT generate any female jewelry, earrings, bindis, or feminine accessories.`;
  } else if (catLower.includes('saree') || catLower.includes('lehenga') || nameLower.includes('saree') || nameLower.includes('lehenga')) {
    const isSilk = fabricLower.includes('silk') || nameLower.includes('silk') || descLower.includes('silk');
    const heavyType = isSilk ? "heavy luxury traditional authentic gold or diamond temple jewelry sets" : "heavy premium traditional Indian Kundan or metal-crafted heavy jewelry set";
    jewelryInstruction = `HEAVY TRADITIONAL JEWELLERY PROTOCOL:
        - Absolute requirement: The model MUST wear heavy, traditional, high-end bridal/festive Indian jewelry.
        - Include: A striking thick heavy necklace/choker, prominent large matching traditional Indian earrings or custom jhumkas, a beautiful classic bindi on her forehead, and multiple matching gold/glass bangles on her arms to complement the rich ${isSilk ? 'silk saree drape' : 'traditional saree draping'}.`;
  } else if (catLower.includes('shirt') || nameLower.includes('shirt') || catLower.includes('pant') || nameLower.includes('pant') || nameLower.includes('pant shirt') || nameLower.includes('pant-shirt')) {
    jewelryInstruction = `ONLY WATCH PROTOCOL:
        - STRICT ACCESSORY LOCK: The model is STRICTLY FORBIDDEN from wearing any style of necklace, collar chains, or dangling fashion/dazzling earrings.
        - The ONLY allowed accessory/jewelry is a single elegant, luxury premium metal-strap or high-end leather-strap analog wristwatch worn cleanly on the wrist.
        - Keep the ears completely bare or adorned with extremely tiny, minimalist, microscopic ear studs only, keeping the professional business-casual/formal silhouette elegant and minimal.`;
  } else if (catLower.includes('co-ord') || catLower.includes('coord') || catLower.includes('codset') || nameLower.includes('co-ord') || nameLower.includes('coord') || nameLower.includes('codset')) {
    jewelryInstruction = `ONLY BANGLES PROTOCOL:
        - STRICT ACCESSORY LOCK: The model is STRICTLY FORBIDDEN from wearing any necklaces, neck chains, forehead accessories, or wristwatches.
        - The ONLY allowed accessories are a beautiful stack of sleek matching fashion bangles styled nicely on one or both wrists that harmonize perfectly with the color theme of the co-ord set.
        - Keep the model's collar and neckline completely bare to highlight the clean-cut coordination of the co-ord outfit set.`;
  } else {
    // defaults to kurties, tops, dresses, etc.
    jewelryInstruction = `VERY LIGHT MINIMALIST JEWELLERY PROTOCOL:
        - Absolute requirement: The model MUST wear very light, delicate, modern, and simple contemporary jewelry.
        - Include: ONLY a single thin premium gold/silver chain with a tiny elegant minimalist pendant, and very small basic metal ball or simple diamond stud earrings.
        - STRICT PROHIBITION: DO NOT generate any heavy traditional Indian collar necklaces, chokers, chunky bangles, or forehead accessories. Keep it extremely light, tasteful, and minimal to match the elegant ${params.garmentCategory || 'Kurti/Dress'} style.`;
  }

  const promptText = `
    VIRTUAL TRY-ON (VTO) MAPPING ENGINE - ULTRA-REALISTIC COMPOSITOR. 
    QUALITY: ${params.imageResolution === 'Print (300 DPI)' ? 'ULTRA-BEYOND 300DPI PRINT RESOLUTION, MICROSCOPIC FIDELITY' : '4K HIGH-DEFINITION, CRYSTAL CLEAR DETAIL, ZERO NOISE'}.
    Scene: ${params.backgroundPrompt}
    Model Appearance Blueprint: ${params.modelPrompt} ${isMale ? '(Ensure the model is male)' : ''}
    ${params.modelImage ? 'IDENTITY REFERENCE (ABSOLUTE PRIORITY): YOU MUST copy the uploaded model image EXACTLY. The face, facial structure, skin tone, hair, and body of the person MUST be 100% indistinguishable from the reference model. DO NOT GENERATE A DIFFERENT MODEL.' : 'IDENTITY GUIDANCE: Generate a unique model strictly following the Appearance Blueprint.'}
    Pose Strategy: Professional High-Fashion Editorial Photoshoot. Pose detail: ${params.pose}
    Requested Aspect Ratio: ${params.aspectRatio || "3:4"}
    
    CRITICAL ANATOMICAL & FRAMING PROTOCOLS:
    - NO AWKWARD CROPPING: The model's complete head, face, hair, and torso MUST be fully visible inside the frame. Do NOT crop off the top of the head or sever limbs unnaturally.
    - FLAWLESS ANATOMY (ABSOLUTE PRIORITY): The model's body, spine, neck, arms, and legs MUST be anatomically perfect. DO NOT generate bent, twisted, broken, distorted, or physically impossible body positions. Prevent extra limbs, missing limbs, or distorted proportions.
    - NATURAL, REALISTIC POSTURE: The model MUST stand completely naturally with elegant, lifelike posture. Prevent any unnatural twisting of the torso or forced poses.
    - PHOTOGRAPHIC REALISM: The final output must look exactly like an unedited raw photograph from a Phase One 100MP medium-format camera. No AI artifacting, no plastic skin, no CGI-looking body structure.
    
    FABRIC & MATERIAL PBR PROPERTIES (PHYSICALLY BASED RENDERING):
    - MATERIAL TYPE: ${params.fabric}
    ${params.fabric.toLowerCase().includes('silk') ? '- SILK PROPERTIES: High specularity, low roughness (0.1-0.2), anisotropic sheen, realistic fabric luster, and smooth surface micro-details.' : ''}
    ${params.fabric.toLowerCase().includes('cotton') ? '- COTTON PROPERTIES: High roughness (0.7-0.9), diffuse reflection, visible fiber weave, matte finish, and realistic fabric weight.' : ''}
    ${params.fabric.toLowerCase().includes('denim') ? '- DENIM PROPERTIES: Moderate roughness (0.5-0.6), twill weave pattern clarity, distinctive indigo depth, white-core thread reveal, and structural rigidity.' : ''}
    ${params.fabric.toLowerCase().includes('satin') ? '- SATIN PROPERTIES: Ultra-smooth surface, directional highlight compression, high gloss, and fluid drape dynamics.' : ''}
    - Micro-Texture: Ensure the ${params.weaveIntensity || 1.0}x weave intensity is visible under macro-inspection. 
    - Specular/Roughness Maps: Simulate a professional PBR material stack where light bounces off the ${params.fabric} naturally based on its physical properties.
    - Fabric Weight: The folds and wrinkles must reflect the density of ${params.fabric}.
    - 4K DETAIL: Render individual threads, fine embroidery stitches, and microscopic fabric fibers.
 
    CONSISTENCY REQUIREMENT (CRITICAL - STATIC ASSET LOCK): 
    - THIS IS A VIRTUAL TRY-ON (VTO) TASK: You are acting as a Virtual Try-On Engine. Your ONLY job is to take the EXACT garment from the provided reference images and map them onto the SUBJECT MODEL with 100% fidelity. 
    - THE GARMENT IS A STATIC OBJECT: The garment (Saree, Dress, Lengha, Kurti, etc.) provided in the reference is a SINGLE PHYSICAL ITEM. It must look EXACTLY the same in every angle, pose, and shot. 
    - NO DESIGN MUTATION: Changing the pattern, embroidery, border width, color shade, or print layout between shots is a TOTAL FAILURE. Every detail must be a 1-to-1 visual twin of the reference.
    - NO DESIGN HALLUCINATION (HIGHEST PRIORITY): You are STRICTLY FORBIDDEN from creating, inventing, or "interpreting" the garment design. The colors, pattern scale, intricate embroidery, thread work (Zari), sequence work, lace borders, prints, and fabric texture MUST NOT CHANGE. ZERO EXTRA DESIGNS: You MUST NOT add any unnecessary designs, embroidery, prints, motifs, text, logos, colored lines, stitched patterns, laces, embellishments, pockets, or textures that do not exist in the source image. The output must be perfectly plain if the source is plain. DO NOT hallucinate any new designs whatsoever. This is a VIRTUAL TRY-ON, not a fashion design task.
    - STERN ANTI-HALLUCINATION GUARD: If the input/original garment image is plain/solid-colored, the draped clothing on the final model MUST be 100% plain and solid-colored with absolutely zero stripes, checks, grids, floral textures, prints, buttons, contrasting stitch lines, lace trim, pockets, graphics, or secondary borders. Do not "beautify" or redesign the garment. If the original garment has a specific pattern or embroidery, place only that exact embroidery or pattern, ensuring no additional lines, patches, different colored fabrics, or ornaments are hallucinated. Purely scan and replicate.
    - PIXEL MATCHING: Extract the exact hex codes of colors and the precise motifs of the patterns. If the reference shows a specific floral print or geometric border, that exact print/border must appear on the final model at the correct scale and position.
    - WORK & EMBROIDERY RETENTION: For sarees and ethnic wear with heavy work, zari, stonework, or borders, you MUST retain 100% of the handwork exactly as seen in the reference. Do not replace ethnic designs with generic patterns. This is the most important rule.
    - FABRIC AUTHENTICITY: Maintain the specific texture of the fabric (e.g., the sheen of silk, the translucency of net/chiffon, the matte finish of cotton, the depth of velvet). Do not alter or simplify the material appearance.
    - IDENTITY LOCK (ABSOLUTE): The MODEL FACE, FEATURES, HAIR, and BODY IDENTITY must be 100% IDENTICAL and a PIXEL-PERFECT CLONE of the "SUBJECT REFERENCE (PERSON/MODEL)" image. No variations. Every facial detail (eyes, nose, mouth structure) must be a PIXEL-PERFECT CLONE. 
    - EXPRESSION (CRITICAL): The model MUST have a gentle, natural, warm smile showing friendly expression in all images. DO NOT generate neutral, serious, or angry resting faces. Model MUST be smiling.
    - JEWELRY PROTOCOL (SERIES LOCK): 
        - If jewelry images are provided, use those EXACT designs. 
        - If NO jewelry is provided, you MUST adapt the jewelry exactly according to this specific garment category instruction:
          ${jewelryInstruction}
        - CRITICAL: Once the jewelry is established in the first pose, it MUST remain 100% IDENTICAL (same design, same placement) in all subsequent poses of the series.
    - GARMENT ROLE HIERARCHY (NON-NEGOTIABLE):
        1. PRIMARY REFERENCE (Garment): This is the CORE piece. It is the base layer.
        2. ENSEMBLE COMPLETION (${params.autoCompleteSet || isKurti ? 'ENABLED' : 'DISABLED'}):
           ${params.autoCompleteSet || isKurti
              ? (isKurti
                  ? 'KURTI SPECIAL PROTOCOL (MANDATORY): You MUST generate a matching or coordinating pair of plain, elegant, simple pyjama (paijam), leggings, or fitted pants/trousers (such as lagins/leggins) that complements the style, color, and fabric of the uploaded Kurti. Keep these pants/leggings solid and completely plain without adding any unnecessary patterns, random embroidery, prints, or heavy decorations, maintaining a clean and slim look for a professional outfit catalogue.'
                  : 'IMPORTANT: Generate a COMPLETE fashion look by adding necessary complementary pieces (like a basic lower body item if only a top is provided). HOWEVER, the core uploaded garment MUST NOT be modified with any extra designs, prints, or embroidery to "match" the new pieces. Keep the core garment perfectly identical to the reference.')
              : 'STRICT LIMIT: Render ONLY the uploaded garment(s) exactly as they are. DO NOT add extra matching pieces unless they are visible in the reference. If only a top is provided, keep the lower body extremely plain/basic without any designs that would draw attention.'}
        3. CONSISTENCY LOCK: The exact shade, fabric texture, embroidery patterns, and lighting response of the garment and jewelry MUST remain perfectly consistent across the whole series.
    - PHOTOSHOOT MODERATION: The final image must look like a professional studio photoshoot. The model should have a confident, sophisticated pose typical of high-end magazines.
    - DRAPING REFERENCE IS NOT A FACE REFERENCE: The person in the "Style and Draping Reference" is an INVISIBLE MANNEQUIN. Do NOT use their face or identity.
    - SAREE & DUPATTA DESIGN FIDELITY (ULTRA CRITICAL FATAL ERROR AVOIDANCE): If the uploaded garment is a saree, lehenga, or includes a dupatta, YOU MUST ACT AS A FOTO-COPIER. Preserve the EXACT design, every single motif, embroidery work (Zari, beadwork, sequence), border thickness, border design, and color. DO NOT CHANGE THE DESIGN IN ANY WAY. DO NOT simplify, alter, hallucinate, or lose any work/design from the saree. DO NOT ADD NEW DESIGNS. If the saree in the reference has specific embroidered flowers or geometric patterns, those EXACT SAME flowers/patterns MUST appear in the exact same proportion. Any modification to the design patterns or handwork is a total failure. If it is a plain saree, it MUST remain a plain saree.
    - SAREE-SPECIFIC PARTIAL ASSET LOGIC (CRITICAL):
        - If the provided reference image ONLY shows the "Pallu" (the ornamental end of the saree), you MUST apply that specific design ONLY to the pallu area of the drape.
        - ABSOLUTE PROHIBITION (PALLU BLEED): DO NOT apply the pallu's heavy embroidery, large motifs, or dense patterns to the blouse (chest/shoulder area) or the main body/pleats of the saree.
        - If the saree body is not shown in the partial reference, use a matching solid color or a very subtle coordinating minor pattern for the body, keeping the pallu as the primary ornamental highlight.
        - The blouse MUST be extremely simple or a solid color, drastically different from the imported pallu design, to prevent design bleed.
    ${params.styleReferenceImage ? '- STYLE & DRAPE REFERENCE (CRITICAL): The overall pose, layout, and how the fabric flows/drapes on the model MUST be an exact replication of the uploaded Style/Drape Reference Image. IMPORTANT: DO NOT COPY THE FACE, IDENTITY, SKIN TONE, CLOTHING DESIGN, COLOR, OR PATTERN FROM THIS STYLE REFERENCE. TREAT THE PERSON IN THIS IMAGE AS AN INVISIBLE MANNEQUIN FOR POSE ONLY.' : ''}
    - JEWELRY LOCK: ${params.jewelryImages && params.jewelryImages.length > 0 
        ? 'Drape the model with the EXACT JEWELRY from the uploaded jewelry references. Maintain design integrity.' 
        : 'Any jewelry (necklaces, earrings, rings, watches) seen in the reference or established in the first shot of this series MUST remain IDENTICAL in this pose.'}
    - ENVIRONMENT LOCK: The BACKGROUND/SCENE (${params.backgroundPrompt}) must be EXACTLY the same environment for the whole series.
    - FRAMING & COMPOSITION (CRITICAL): ZERO MARGIN FRAMING. The model and the garment MUST FILL THE ENTIRE FRAME completely. ABSOLUTELY NO PADDING, NO MARGINS, NO FRAMES, and NO EMPTY WHITE BORDERS around the image. The model's body should stretch to the edges of the canvas. Do not generate zoomed-out shots. Frame tightly to maximize garment detail.
    - EXTREME FABRIC TEXTURE FIDELITY (MANDATORY): You MUST painstakingly replicate the EXACT fabric texture, weight, and material seen in the uploaded garment reference. If it's silk, it must reflect light with a liquid-like sheen. If it's cotton, show the matte cotton weave. If velvet, chiffon, denim, or knit, render the precise light absorption, thickness, and transparency. Do not smooth out or simplify the fabric surface. The material MUST look tangibly real.
    
    LIGHTING & PHOTOGRAPHY (ULTRA-PREMIUM 8K UHD CATALOG GRADE):
    - STYLE: High-end fashion editorial style with realistic, clean natural skin tones and organic color palettes.
    - LIGHTING MASTER: Implement professional Three-Point White Lighting (Key, Fill, and Rim). 
        - KEY LIGHT: Crisp softbox cool-white diffusion to highlight luxurious fabric textures, intricate weave patterns, and material fiber details without harsh highlights.
        - FILL LIGHT: Gentle blue-white illumination to lift shadows on the garment while maintaining depth and form.
        - RIM LIGHT (CRITICAL): Precise pure white backlighting to create a subtle clean glow around the model's silhouette, separating them from the background and highlighting the garment's drape.
    - NEUTRAL STUDIO ILLUMINATION (CRITICAL): The model and garment MUST be illuminated with crisp, pure white, neutral daylight-balanced studio lighting (6000K-6500K cool white) to preserve absolute color accuracy. DO NOT apply environmental golden color casts (e.g., absolutely no golden hour amber, no warm yellow lighting, no warm tungsten glows, or green bounce) to the model or garment. The true authentic colors of the garment MUST be perfectly maintained under bright cool-white studio lights.
    - LIGHTING CONTINUITY (SERIES LOCK): The light source direction (e.g. 45 degrees from top-left) and intensity of the clean white light MUST remain 100% constant across all poses in this session to ensure a professional, cohesive catalog look.
    - STUDIO QUALITY EVERYWHERE: Even in outdoor backgrounds, the model must pop with high-end editorial pure white studio lighting. Ensure the garment remains perfectly under pure white lighting without dark muddy shadows or warm color bleeding. Add subtle crisp catchlights in the eyes to bring the person to life.
    - SHADOW PHYSICS: Every pose MUST have realistic contact shadows (Ambient Occlusion) where the model's feet or body meet the environment. Shadows MUST align perfectly with the background's light sources.
    - POSE MASTER: Elegant, sophisticated, and natural high-fashion photoshoot postures. Ensure graceful hand placement, flattering shoulder alignment, and professional editorial gaze. NO STIFF OR AWKWARD LIMBS.
    - CAMERA: Shot on Phase One XF with a 100MP Trichromatic sensor, 80mm Schneider Kreuznach lens at f/8. Full-frame composition with tack-sharp focus on the garment fibers.
    - Environmental Realism: The subject MUST look like they were physically present in that exact environment. Match the exposure perfectly.
    - Photometric Realism: Use ray-traced shadows, global illumination, and realistic reflections on shiny fabrics (Silk, Satin, Zari). 
    - Resolution & Depth: The image MUST be generated with absolute maximum detail, akin to an 8K uncompressed TIFF. The fabric weaves, jewelry micro-details, and skin texture must have microscopic precision. Use shallow depth-of-field (f/4.0) to provide subtle background separation while keeping the model and garment in tack-sharp focus.
    - Performance: Hyper-realistic skin shaders (micro-pores, natural skin oils, fine vellus hair), and ultra-detailed fabric rendering (visible weave, fiber texture, seam precision). NO BLUR ON THE MODEL. NO NOISE. NO ARTIFACTS.
    - Camera Setup: 85mm telephoto portrait lens, zoomed in extremely tight to eliminate empty background. 8K UHD resolution output, ISO 50 crystal clear RAW precision.
    - Post-Production: High-end editorial retouching, 4K UHD upscaling aesthetic, natural skin preservation, perfect color matching.
    
    CATALOG AESTHETIC:
    - The final image must look like it belongs in a premium luxury brand's official lookbook or flagship e-commerce site.
    - Clean, expensive, and sophisticated vibe.
    
    - GARMENT SPECIFIC RULES (NON-NEGOTIABLE CORE DIRECTIVE):
        - LITERAL PHOTO COPIER MODE: You must act as a literal photo copier for the uploaded garment. The design, print, pattern, and embroidery MUST be a 1-to-1 pixel-perfect match to the reference image.
        - ABSOLUTE SAREE/LEHENGA PRESERVATION: You are strictly forbidden from modifying the saree's design. DO NOT add flowers, DO NOT add geometric shapes, DO NOT add heavy borders if they do not exist. You MUST extract the exact textile pattern from the image and wrap it as a perfect 3D texture without hallucinating new artwork. If the saree is plain, KEEP IT PLAIN. Do not "enhance" the saree.
        - ZERO DESIGN HALLUCINATION: You are STRICTLY FORBIDDEN from adding any geometric designs, prints, lines, borders, trims, lace, custom buttons, stripes, patterns, color blocks, or details of any kind that are not physically present in the uploaded reference garment. Do not "enhance" the design. Do not make it "premium" by adding decorations. If it is simple, render it simple.
        - MAINTAIN EXACT TEXTILE PRINT: The fabric pattern and print is the MOST IMPORTANT part of this entire generation. Any deviation from the reference print is a failure.
        - IDENTITY PRESERVATION (NON-NEGOTIABLE): Ensure the person's face from the SUBJECT REFERENCE (PERSON/MODEL) image is perfectly preserved and identical.

    SAFETY GUIDANCE: Avoid strictly any explicit or sensitive imagery. If generating intimate apparel, undergarments, or if a human model risks triggering safety blocks, STRICTLY use a "ghost mannequin", "invisible mannequin", or "flat lay" presentation. Keep it highly professional and commercial.
  `;

  parts.push({ text: promptText });

  const executeGeneration = async (modelName: string, retryCount = 0): Promise<string> => {
    try {
      const response = await fetchServerGenerateContent({
        model: modelName,
        contents: {
          parts: parts,
        },
        config: {
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ] as any,
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: params.aspectRatio || "3:4",
            ...(params.imageResolution && !modelName.includes('gemini-2.5-flash-image') 
              ? { imageSize: params.imageResolution === 'Print (300 DPI)' ? '4K' : params.imageResolution } 
              : {})
          }
        }
      });

      const resParts = response.candidates?.[0]?.content?.parts || [];
      const finishReason = response.candidates?.[0]?.finishReason;

      for (const part of resParts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      if (finishReason === 'SAFETY' || finishReason === 'IMAGE_OTHER') {
        throw new Error(`Generation rejected by safety filters. Sensitive categories (like undergarments) and realistic faces are strictly regulated by the Gemini API.`);
      }

      console.error('Generate API returned no image. Full response:', JSON.stringify(response));
      throw new Error(`Model returned no image generated. Finish Reason: ${finishReason}`);
    } catch (err: any) {
      const isRetryable = err.status === 'UNAVAILABLE' || err.code === 503 || err.status === 'INTERNAL' || err.code === 500 || String(err).includes('503') || String(err).includes('500') || String(err).includes('Deadline expired') || String(err).includes('Internal error');
      
      console.error("Gemini service execution error:", err);
      throw err;
    }
  };

  let modelChain = ['gemini-2.5-flash-image'];
  if (params.imageResolution === 'Print (300 DPI)') {
     modelChain = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];
  } else if (params.imageResolution === '4K') {
    modelChain = ['gemini-3.1-flash-image', 'gemini-3-pro-image'];
  } else if (params.imageResolution === '2K') {
    modelChain = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
  } else if (params.imageResolution === '1K' || params.imageResolution === 'Fast' || !params.imageResolution) {
    modelChain = ['gemini-2.5-flash-image'];
  }

  let lastError: any = null;
  for (const modelName of modelChain) {
    try {
      console.log(`Attempting generation with model: ${modelName} at ${params.imageResolution || '1K'}`);
      return await executeGeneration(modelName);
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${modelName} failed, trying next in chain...`, err);
      
      const msg = typeof err.message === 'string' ? err.message : String(err);
      // We no longer abort the entire chain on spending cap. 
      // We let it try the next cheaper model in the chain instead.
      if (msg.includes('spending cap') || msg.includes('monthly spending cap')) {
        console.warn(`Model ${modelName} quota exceeded. Falling back...`);
      }
    }
  }

  const finalMsg = typeof lastError?.message === 'string' ? lastError.message : String(lastError);
  if (finalMsg.includes('spending cap') || finalMsg.includes('monthly spending cap')) {
     throw new Error('SPENDING_CAP_EXCEEDED');
  }
  throw lastError || new Error('All image generations failed');
}

export async function generateGarmentDescription(garmentName: string): Promise<string> {
  const prompt = `Create a professional, detailed product description for a fashion catalog for a garment named "${garmentName}". 
  Include technical details about fit, quality, and style. Keep it under 100 words.`;
  
  try {
    const response = await fetchServerGenerateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Error generating description:', error);
    return 'Premium quality garment designed for comfort and style.';
  }
}

export interface GeneratePromoParams {
  assetType: string; // 'logo' | 'advertisement' | 'company-profile' | 'banner-poster' | 'social-media'
  brandName: string;
  tagline: string;
  styleDescription: string;
  creativeDirections: string;
  aspectRatio?: string;
  colorPalette?: string;
  productImageBase64?: string; // Base64 representation of what to advertise
  productImageMimeType?: string; // MimeType, e.g. "image/png" or "image/jpeg"
}

export async function generatePromotionalImage(params: GeneratePromoParams): Promise<string> {
  let visualPrompt = ``;
  
  if (params.productImageBase64) {
    visualPrompt = `You are an elite, professional commercial graphic designer and product stylist.
    Use the uploaded product image (which contains the item to advertise) and seamlessly place this product into an extremely professional, high-fidelity lifestyle or studio setting.
    
    Setting Composition: ${params.creativeDirections}.
    Aesthetic Vibe: ${params.styleDescription}.
    Color Palette: ${params.colorPalette || 'Studio lighting, complementary colors'}.
    
    Requirements:
    1. Seamlessly integrate the product into the scene, calculating realistic soft box lighting, gorgeous shadow drop reflections on the surfaces, and cohesive surrounding styling elements.
    2. Maintain the crisp detail and true shape of the product without distorting it.
    3. Retain beautiful empty negative space for professional typography overlays.
    4. CRITICAL: Do NOT generate mock text or dummy labels inside the image canvas.
    5. Ensure the finished output looks like a high-fashion, high-end design-agency shoot.
    6. SAFETY GUIDANCE: Do not generate sexually explicit content or inappropriate scenes. When producing fashion shots, use commercial standard mannequins, abstract models or flat-lays if human models risk triggering safety filters.`;
  } else if (params.assetType === 'logo') {
    visualPrompt = `A high-end, minimalist luxury brand logo design graphic on a clean dark or neutral white studio background. 
    Subject: A professional iconic brand mark or logomark emblem representing elegance, fashion, and high art. 
    Style: Minimal vector design, thin clean lines, perfect symmetry, flat graphic design, extremely premium look. 
    Colors: ${params.colorPalette || 'Neutral monochrome, rich gold accents'}. 
    CRITICAL: Clean presentation, 0% blur, perfectly sharp vector style, centered framing, no realistic clutter, high-end design-agency quality. 
    Style details: ${params.styleDescription}. 
    Tagline vibe: ${params.tagline}.`;
  } else if (params.assetType === 'advertisement' || params.assetType === 'banner-poster') {
    visualPrompt = `A high-end, premium lifestyle promotional advertisement or catalog poster background. 
    Subject: A professional commercial setup of luxury fashion apparel, lifestyle, or aesthetic items arranged in an art-gallery style or high-fashion editorial set. 
    Style: Clean high-fashion editorial commercial banner, shot on medium-format camera, soft studio softbox lighting, shallow depth of field. 
    Composition: Elegant wide shot or vertical portrait with plenty of negative space for text overlays. 
    Colors: ${params.colorPalette || 'Cohesive cinematic palette'}. 
    Atmosphere: ${params.styleDescription}. 
    Product features: ${params.creativeDirections}. 
    CRITICAL: Do NOT generate mock text inside the image. Keep it purely as a clean, professional, aesthetic product-lifestyle shot that serves as the perfect luxury advertisement canvas.`;
  } else if (params.assetType === 'company-profile') {
    visualPrompt = `A beautiful, majestic high-fashion company banner showcase or designer warehouse interior under dramatic studio lights. 
    Subject: An empty luxury high-fashion atelier, runway dressing room, designer boutique shelf, or clean architectural space with a modern aesthetic. 
    Style: Architectural digest, professional corporate cover layout background, soft cinematic natural lighting. 
    Composition: Perfect horizontal symmetry, luxurious and spacious representation with clean visual lines. 
    Colors: ${params.colorPalette || 'Muted elegant colors'}. 
    Vibe: ${params.styleDescription}. 
    Details: ${params.creativeDirections}. 
    CRITICAL: No awkward elements, extremely polished and professional. No text in image.`;
  } else {
    // Default social/other promo images
    visualPrompt = `Professional social media promotional brand image. 
    Subject: Exquisitely framed high-fashion clothing, editorial flat-lay of apparel accessories, or stunning lifestyle mood shot. 
    Style: Clean instagram-quality aesthetic photography, high-contrast, beautiful textures, clear details. 
    Colors: ${params.colorPalette || 'Vibrant elegant tones'}. 
    Directions: ${params.styleDescription}. ${params.creativeDirections}. 
    CRITICAL: No text in the image background. High detail.`;
  }

  const modelChain = ['gemini-2.5-flash-image'];
  let lastError: any = null;

  for (const modelName of modelChain) {
    try {
      console.log(`Generating promotional image using: ${modelName}`);
      
      const contentsPayload: any = [];
      if (params.productImageBase64) {
        contentsPayload.push({
          inlineData: {
            data: params.productImageBase64.startsWith('data:') 
              ? params.productImageBase64.split(',')[1] 
              : params.productImageBase64,
            mimeType: params.productImageMimeType || "image/jpeg"
          }
        });
      }
      contentsPayload.push({
        text: visualPrompt
      });

      const response = await fetchServerGenerateContent({
        model: modelName,
        contents: { parts: contentsPayload },
        config: {
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ] as any,
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: params.aspectRatio || "1:1",
          }
        }
      });

      const resParts = response.candidates?.[0]?.content?.parts || [];
      const finishReason = response.candidates?.[0]?.finishReason;
      for (const part of resParts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      if (finishReason === 'SAFETY' || finishReason === 'IMAGE_OTHER') {
        throw new Error(`Generation rejected by safety filters.`);
      }

      console.error('Promo API returned no image. Full response:', JSON.stringify(response));
      throw new Error('Image generation failed to return binary data');
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${modelName} failed for promotional generation`, err);
    }
  }

  throw lastError || new Error('All promotional image generation attempts failed');
}
