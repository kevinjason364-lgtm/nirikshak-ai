import type { ImageQualityResult } from '@/types';

/**
 * Lightweight client-side image quality assessment.
 *
 * Analyses an image via <canvas> for:
 * - Brightness (average luminance)
 * - Blur (edge variance / Laplacian approximation)
 * - Framing (content coverage)
 *
 * These are simple heuristics, not AI. Results are non-blocking warnings.
 */
export async function assessImageQuality(
  dataUrl: string
): Promise<ImageQualityResult> {
  const warnings: string[] = [];

  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { score: 50, status: 'needs-review', warnings: ['Cannot analyse image quality.'] };
    }

    // Scale down for performance
    const maxDim = 300;
    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Brightness check
    let totalLuminance = 0;
    const pixelCount = canvas.width * canvas.height;
    for (let i = 0; i < pixels.length; i += 4) {
      totalLuminance += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    }
    const avgBrightness = totalLuminance / pixelCount;

    if (avgBrightness < 40) {
      warnings.push('Image appears too dark — low-light conditions detected.');
    } else if (avgBrightness > 230) {
      warnings.push('Image appears overexposed — too bright.');
    }

    // Blur check (simple Laplacian variance)
    const grey = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const pi = i * 4;
      grey[i] = 0.299 * pixels[pi] + 0.587 * pixels[pi + 1] + 0.114 * pixels[pi + 2];
    }

    let laplacianVariance = 0;
    const w = canvas.width;
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const lap =
          grey[idx - w] + grey[idx + w] + grey[idx - 1] + grey[idx + 1] - 4 * grey[idx];
        laplacianVariance += lap * lap;
      }
    }
    laplacianVariance /= (canvas.width - 2) * (canvas.height - 2);

    if (laplacianVariance < 50) {
      warnings.push('Image may be blurry — consider retaking with steady hands.');
    }

    // Framing check (edge content)
    const edgeMargin = Math.floor(Math.min(canvas.width, canvas.height) * 0.1);
    let edgePixels = 0;
    let edgeBright = 0;
    // Check borders
    for (let x = 0; x < canvas.width; x++) {
      for (let m = 0; m < edgeMargin; m++) {
        edgePixels += 2;
        edgeBright += grey[m * w + x] + grey[(canvas.height - 1 - m) * w + x];
      }
    }
    const avgEdgeBrightness = edgeBright / edgePixels;
    const centerBrightness = avgBrightness;
    if (Math.abs(avgEdgeBrightness - centerBrightness) < 5 && avgBrightness > 200) {
      warnings.push('Label may not fill the frame — try capturing closer.');
    }

    // Calculate score
    let score = 100;
    if (avgBrightness < 40 || avgBrightness > 230) score -= 30;
    if (laplacianVariance < 50) score -= 35;
    if (warnings.length === 0) score = Math.max(score, 80);

    score = Math.max(0, Math.min(100, score));

    let status: ImageQualityResult['status'] = 'good';
    if (score < 40) status = 'retake-recommended';
    else if (score < 70) status = 'needs-review';

    return { score, status, warnings };
  } catch {
    return {
      score: 50,
      status: 'needs-review',
      warnings: ['Could not analyse image quality.'],
    };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
