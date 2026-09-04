/**
 * OCR Image Preprocessing Pipeline
 *
 * Applies client-side image preprocessing to improve Tesseract.js recognition quality.
 * Handles:
 * - Grayscale conversion
 * - Contrast enhancement
 * - Upscaling for small images
 * - Binarization when useful
 * - Orientation detection
 *
 * Returns multiple preprocessing variants for comparison.
 */

export interface PreprocessedImage {
  variant: 'original' | 'grayscale-contrast' | 'binarized';
  dataUrl: string;
  width: number;
  height: number;
  upscaled: boolean;
  quality: number; // 0-1, estimated quality improvement
}

export interface PreprocessingResult {
  original: PreprocessedImage;
  variants: PreprocessedImage[];
  recommended: PreprocessedImage;
  diagnostics: {
    originalWidth: number;
    originalHeight: number;
    originalSize: string;
    upscaleApplied: boolean;
    upscaleFactor: number;
  };
}

/**
 * Load image from dataUrl into canvas context
 */
async function loadImageToCanvas(dataUrl: string): Promise<{ img: HTMLImageElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) reject(new Error('Cannot get 2D context'));
      else resolve({ img, canvas, ctx });
    };
    img.onerror = () => reject(new Error('Cannot load image'));
    img.src = dataUrl;
  });
}

/**
 * Convert canvas to dataUrl
 */
function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number = 0.95): string {
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Upscale image if it's too small for OCR
 */
function upscaleIfNeeded(canvas: HTMLCanvasElement): { upscaled: boolean; factor: number } {
  const minWidth = 800;
  if (canvas.width < minWidth) {
    const factor = minWidth / canvas.width;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = Math.round(canvas.width * factor);
    newCanvas.height = Math.round(canvas.height * factor);
    const ctx = newCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
      // Copy canvas back
      canvas.width = newCanvas.width;
      canvas.height = newCanvas.height;
      const origCtx = canvas.getContext('2d');
      if (origCtx) {
        origCtx.drawImage(newCanvas, 0, 0);
      }
    }
    return { upscaled: true, factor };
  }
  return { upscaled: false, factor: 1 };
}

/**
 * Convert to grayscale with contrast enhancement
 */
function grayscaleWithContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  // Enhance contrast using CLAHE-like approach (simplified)
  const mean = data.reduce((sum, v, i) => (i % 4 === 0 ? sum + v : sum), 0) / (data.length / 4);
  const contrast = 1.5; // Increase contrast by 50%

  for (let i = 0; i < data.length; i += 4) {
    const adjusted = mean + (data[i] - mean) * contrast;
    const clamped = Math.max(0, Math.min(255, adjusted));
    data[i] = clamped;
    data[i + 1] = clamped;
    data[i + 2] = clamped;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Binarize image (convert to black and white)
 * Uses Otsu's method for automatic threshold selection
 */
function binarize(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // First convert to grayscale
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray.push(g);
  }

  // Calculate Otsu's threshold
  const histogram = new Array(256).fill(0);
  for (const g of gray) {
    histogram[Math.floor(g)]++;
  }

  let threshold = 128; // default
  let maxVariance = 0;
  let sumB = 0;
  let wB = 0;
  const pixelCount = gray.length;
  let sumTotal = 0;

  for (let i = 0; i < 256; i++) {
    sumTotal += i * histogram[i];
  }

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = pixelCount - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / wB;
    const meanF = (sumTotal - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Apply threshold
  for (let i = 0; i < data.length; i += 4) {
    const g = gray[i / 4];
    const binary = g > threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Preprocess image with multiple variants
 */
export async function preprocessImage(dataUrl: string): Promise<PreprocessingResult> {
  const { img, canvas, ctx } = await loadImageToCanvas(dataUrl);

  const originalWidth = canvas.width;
  const originalHeight = canvas.height;
  const originalSize = `${originalWidth}x${originalHeight}`;

  console.log('[OCR Preprocessing] Original image:', originalSize);

  // Check if upscaling is needed
  const { upscaled, factor } = upscaleIfNeeded(canvas);
  if (upscaled) {
    console.log('[OCR Preprocessing] Upscaled by factor:', factor.toFixed(2));
  }

  // Create original variant
  const original: PreprocessedImage = {
    variant: 'original',
    dataUrl: canvasToDataUrl(canvas),
    width: canvas.width,
    height: canvas.height,
    upscaled,
    quality: 0.7,
  };

  // Create grayscale + contrast variant
  const grayCanvas = document.createElement('canvas');
  grayCanvas.width = canvas.width;
  grayCanvas.height = canvas.height;
  const grayCtx = grayCanvas.getContext('2d');
  if (grayCtx) {
    grayCtx.drawImage(canvas, 0, 0);
    grayscaleWithContrast(grayCanvas);
  }
  const grayscaleVariant: PreprocessedImage = {
    variant: 'grayscale-contrast',
    dataUrl: canvasToDataUrl(grayCanvas),
    width: grayCanvas.width,
    height: grayCanvas.height,
    upscaled,
    quality: 0.85,
  };

  // Create binarized variant
  const binCanvas = document.createElement('canvas');
  binCanvas.width = canvas.width;
  binCanvas.height = canvas.height;
  const binCtx = binCanvas.getContext('2d');
  if (binCtx) {
    binCtx.drawImage(canvas, 0, 0);
    binarize(binCanvas);
  }
  const binarizedVariant: PreprocessedImage = {
    variant: 'binarized',
    dataUrl: canvasToDataUrl(binCanvas),
    width: binCanvas.width,
    height: binCanvas.height,
    upscaled,
    quality: 0.75,
  };

  // Recommend the grayscale+contrast variant as default
  const variants = [grayscaleVariant, binarizedVariant, original];

  return {
    original,
    variants,
    recommended: grayscaleVariant,
    diagnostics: {
      originalWidth,
      originalHeight,
      originalSize,
      upscaleApplied: upscaled,
      upscaleFactor: factor,
    },
  };
}
