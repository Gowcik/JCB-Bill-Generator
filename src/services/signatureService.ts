/**
 * Signature Service for JCB Bill Generator
 * Handles automatic handwritten signature detection, bounding-box cropping,
 * background neutralization/transparency, and storage.
 */

export const SIGNATURE_STORAGE_KEY = 'jcb_owner_signature';
export const SHOW_SIGNATURE_STORAGE_KEY = 'jcb_show_signature';

/**
 * Local storage helpers for "Show Authorized Signature on Bill" toggle setting (Default: true)
 */
export const getStoredShowSignature = (userId?: string | null): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const key = userId ? `${SHOW_SIGNATURE_STORAGE_KEY}_${userId}` : SHOW_SIGNATURE_STORAGE_KEY;
    const val = localStorage.getItem(key) ?? localStorage.getItem(SHOW_SIGNATURE_STORAGE_KEY);
    if (val === null) return true; // Default ON
    return val === 'true';
  } catch {
    return true;
  }
};

export const setStoredShowSignature = (show: boolean, userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${SHOW_SIGNATURE_STORAGE_KEY}_${userId}` : SHOW_SIGNATURE_STORAGE_KEY;
    localStorage.setItem(key, String(show));
    localStorage.setItem(SHOW_SIGNATURE_STORAGE_KEY, String(show));
  } catch (err) {
    console.warn('[signatureService] Failed to cache show signature setting in localStorage:', err);
  }
};

/**
 * Retrieve cached signature Data URL from localStorage
 */
export const getStoredSignature = (userId?: string | null): string | null => {
  try {
    if (userId) {
      const userItem = localStorage.getItem(`${SIGNATURE_STORAGE_KEY}_${userId}`);
      if (userItem && userItem.startsWith('data:image/')) return userItem;
    }
    const globalItem = localStorage.getItem(SIGNATURE_STORAGE_KEY);
    if (globalItem && globalItem.startsWith('data:image/')) return globalItem;
    return null;
  } catch {
    return null;
  }
};

/**
 * Persist processed signature Data URL to localStorage
 */
export const setStoredSignature = (dataUrl: string, userId?: string | null): void => {
  try {
    if (userId) {
      localStorage.setItem(`${SIGNATURE_STORAGE_KEY}_${userId}`, dataUrl);
    }
    localStorage.setItem(SIGNATURE_STORAGE_KEY, dataUrl);
  } catch (err) {
    console.warn('[signatureService] Failed to cache signature in localStorage:', err);
  }
};

/**
 * Remove cached signature from localStorage
 */
export const removeStoredSignature = (userId?: string | null): void => {
  try {
    if (userId) {
      localStorage.removeItem(`${SIGNATURE_STORAGE_KEY}_${userId}`);
    }
    localStorage.removeItem(SIGNATURE_STORAGE_KEY);
  } catch (err) {
    console.warn('[signatureService] Failed to remove signature from localStorage:', err);
  }
};

/**
 * Process an uploaded signature file (PNG, JPG, JPEG):
 * 1. Validates image type.
 * 2. Scales down to a safe processing resolution.
 * 3. Uses block-based adaptive luminance analysis to handle paper shadows/lighting.
 * 4. Detects handwritten ink bounds via horizontal & vertical projection histograms.
 * 5. Crops tightly around the signature with comfortable padding.
 * 6. Converts paper background to clean transparency with smooth anti-aliased ink strokes.
 * 7. Returns crisp, high-resolution PNG Data URL.
 */
export const processSignatureImageFile = async (file: File): Promise<string> => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(png|jpe?g|webp)$/i)) {
    throw new Error('Unsupported image format. Please upload a PNG, JPG, or JPEG photo of your signature.');
  }

  // 1. Read file as Data URL
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  // 2. Load into HTMLImageElement
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image data.'));
    image.src = rawDataUrl;
  });

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  if (origW < 10 || origH < 10) {
    throw new Error('Image dimensions are too small.');
  }

  // Scale down for processing if oversized (max 1400px to maintain high resolution while saving memory)
  const maxDim = 1400;
  let procW = origW;
  let procH = origH;
  if (procW > maxDim || procH > maxDim) {
    if (procW > procH) {
      procH = Math.round((procH * maxDim) / procW);
      procW = maxDim;
    } else {
      procW = Math.round((procW * maxDim) / procH);
      procH = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = procW;
  canvas.height = procH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context.');
  }

  ctx.drawImage(img, 0, 0, procW, procH);
  const imgData = ctx.getImageData(0, 0, procW, procH);
  const data = imgData.data;

  // 3. Compute Luminance map: Y = 0.299R + 0.587G + 0.114B
  const lum = new Uint8ClampedArray(procW * procH);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // 4. Adaptive block-based background estimation to handle shadows / uneven paper lighting
  const blockSize = 32;
  const blocksX = Math.ceil(procW / blockSize);
  const blocksY = Math.ceil(procH / blockSize);
  const blockBg = new Float32Array(blocksX * blocksY);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const startX = bx * blockSize;
      const endX = Math.min(procW, startX + blockSize);
      const startY = by * blockSize;
      const endY = Math.min(procH, startY + blockSize);

      // Collect luminosities in this block
      const samples: number[] = [];
      for (let y = startY; y < endY; y += 2) {
        const rowOffset = y * procW;
        for (let x = startX; x < endX; x += 2) {
          samples.push(lum[rowOffset + x]);
        }
      }

      if (samples.length > 0) {
        samples.sort((a, b) => a - b);
        // Use 85th percentile as paper surface luminance (ignoring dark strokes)
        const p85Index = Math.min(samples.length - 1, Math.floor(samples.length * 0.85));
        blockBg[by * blocksX + bx] = samples[p85Index];
      } else {
        blockBg[by * blocksX + bx] = 240;
      }
    }
  }

  // 5. Detect ink pixels: pixel is ink if luminance is sufficiently darker than local paper background
  const inkMask = new Uint8Array(procW * procH);
  const rowInkCounts = new Int32Array(procH);
  const colInkCounts = new Int32Array(procW);

  // Ignore outer 1% border to avoid shadows/edges of photo
  const marginX = Math.max(3, Math.floor(procW * 0.015));
  const marginY = Math.max(3, Math.floor(procH * 0.015));

  for (let y = marginY; y < procH - marginY; y++) {
    const by = Math.min(blocksY - 1, Math.floor(y / blockSize));
    const rowOffset = y * procW;

    for (let x = marginX; x < procW - marginX; x++) {
      const bx = Math.min(blocksX - 1, Math.floor(x / blockSize));
      const localPaper = blockBg[by * blocksX + bx];
      const p = rowOffset + x;
      const pixelLum = lum[p];

      // Difference threshold: pixel must be at least 32 levels darker than paper background
      // and absolute luminance must not be ultra-bright
      const diff = localPaper - pixelLum;
      if (diff >= 30 && pixelLum < 210) {
        inkMask[p] = 1;
        rowInkCounts[y]++;
        colInkCounts[x]++;
      }
    }
  }

  // 6. Find Bounding Box of signature ink using projection thresholds (filters noise)
  const minInkPerRow = Math.max(2, Math.floor(procW * 0.003));
  const minInkPerCol = Math.max(2, Math.floor(procH * 0.003));

  let minY = -1;
  let maxY = -1;
  for (let y = marginY; y < procH - marginY; y++) {
    if (rowInkCounts[y] >= minInkPerRow) {
      if (minY === -1) minY = y;
      maxY = y;
    }
  }

  let minX = -1;
  let maxX = -1;
  for (let x = marginX; x < procW - marginX; x++) {
    if (colInkCounts[x] >= minInkPerCol) {
      if (minX === -1) minX = x;
      maxX = x;
    }
  }

  // If no clear signature region was detected, fallback to full image
  if (minX === -1 || minY === -1 || maxX <= minX || maxY <= minY) {
    minX = marginX;
    minY = marginY;
    maxX = procW - marginX;
    maxY = procH - marginY;
  }

  // Add comfortable padding around the detected signature bounds (6% horizontal, 8% vertical)
  const sigW = maxX - minX + 1;
  const sigH = maxY - minY + 1;
  const padX = Math.round(sigW * 0.06) + 12;
  const padY = Math.round(sigH * 0.08) + 10;

  const cropX = Math.max(0, minX - padX);
  const cropY = Math.max(0, minY - padY);
  const cropW = Math.min(procW - cropX, sigW + padX * 2);
  const cropH = Math.min(procH - cropY, sigH + padY * 2);

  // 7. Render cropped signature onto final canvas with clean transparent background
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    throw new Error('Could not initialize crop canvas context.');
  }

  // Extract source crop ImageData
  const cropImgData = ctx.getImageData(cropX, cropY, cropW, cropH);
  const cropPixels = cropImgData.data;

  // Process every pixel for transparency and ink contrast:
  // - High luminance (paper) -> Alpha = 0 (Transparent)
  // - Deep ink -> Alpha = 255 (Opaque)
  // - Midtones -> Smooth anti-aliasing preserving thin strokes
  for (let cy = 0; cy < cropH; cy++) {
    const srcY = cropY + cy;
    const by = Math.min(blocksY - 1, Math.floor(srcY / blockSize));

    for (let cx = 0; cx < cropW; cx++) {
      const srcX = cropX + cx;
      const bx = Math.min(blocksX - 1, Math.floor(srcX / blockSize));
      const localPaper = blockBg[by * blocksX + bx];

      const cropIndex = (cy * cropW + cx) * 4;
      const r = cropPixels[cropIndex];
      const g = cropPixels[cropIndex + 1];
      const b = cropPixels[cropIndex + 2];
      const pixelLum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      const paperThreshold = Math.max(160, localPaper - 14);
      const solidInkThreshold = Math.min(130, localPaper - 65);

      if (pixelLum >= paperThreshold) {
        // Pure background paper -> Fully transparent
        cropPixels[cropIndex + 3] = 0;
      } else if (pixelLum <= solidInkThreshold) {
        // Deep handwritten ink -> Fully opaque dark ink
        // Preserve subtle blue/black hue or normalize to deep elegant charcoal
        cropPixels[cropIndex] = Math.min(r, 30);
        cropPixels[cropIndex + 1] = Math.min(g, 41);
        cropPixels[cropIndex + 2] = Math.min(b, 59);
        cropPixels[cropIndex + 3] = 255;
      } else {
        // Anti-aliased stroke edge -> Smooth alpha gradient
        const factor = (paperThreshold - pixelLum) / (paperThreshold - solidInkThreshold);
        const alpha = Math.round(255 * Math.max(0, Math.min(1, factor)));
        cropPixels[cropIndex] = Math.min(r, 30);
        cropPixels[cropIndex + 1] = Math.min(g, 41);
        cropPixels[cropIndex + 2] = Math.min(b, 59);
        cropPixels[cropIndex + 3] = alpha;
      }
    }
  }

  cropCtx.putImageData(cropImgData, 0, 0);

  // 8. If crop canvas is larger than 800px, scale down smoothly for storage efficiency
  let finalCanvas = cropCanvas;
  if (cropW > 800) {
    const targetW = 800;
    const targetH = Math.round((cropH * targetW) / cropW);
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = targetW;
    scaledCanvas.height = targetH;
    const sCtx = scaledCanvas.getContext('2d');
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(cropCanvas, 0, 0, targetW, targetH);
      finalCanvas = scaledCanvas;
    }
  }

  return finalCanvas.toDataURL('image/png', 0.95);
};
