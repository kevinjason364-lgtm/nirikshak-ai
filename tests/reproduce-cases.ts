import fs from 'fs';
import path from 'path';

// Load .env.local
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { createWorker } from 'tesseract.js';
import { parseOcrText } from '../src/lib/ocr-parser';
import { mergeExtractions } from '../src/lib/hybrid-merger';
import { getVisionProvider } from '../src/lib/vision/provider';
import type { VisionImageInput } from '../src/lib/vision/types';

const DOWNLOADS_DIR = 'C:\\Users\\kevin\\Downloads';

function fileToDataUrl(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const buf = fs.readFileSync(filePath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function runTestCase(name: string, images: { file: string; label: string }[]) {
  console.log(`\n================================================================`);
  console.log(`TEST CASE: ${name}`);
  console.log(`================================================================`);

  const visionInputs: VisionImageInput[] = [];
  const ocrImages: { dataUrl: string; label: string }[] = [];

  for (const { file, label } of images) {
    const fullPath = path.join(DOWNLOADS_DIR, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`FAIL: Image not found at ${fullPath}`);
      return;
    }
    const dataUrl = fileToDataUrl(fullPath);
    visionInputs.push({ dataUrl, label: label as any });
    ocrImages.push({ dataUrl, label });
  }

  console.log(`[1] Running Vision AI...`);
  const provider = getVisionProvider();
  let visionCandidate: any = null;
  let visionConfidence: any = null;
  if (provider) {
    const startTime = Date.now();
    const visionResponse = await provider.extract(visionInputs);
    const elapsed = Date.now() - startTime;
    console.log(`    Vision AI API time: ${elapsed}ms`);
    console.log(`    Success: ${visionResponse.success}`);

    if (visionResponse.success) {
        visionCandidate = visionResponse.candidate;
        visionConfidence = visionResponse.confidence;
        const keys = Object.keys(visionCandidate).filter(k => visionCandidate[k]);
        console.log(`    Extracted Fields: ${keys.length} → ${keys.join(', ')}`);
    } else {
        console.error(`    Vision API Error: `, visionResponse.error?.substring(0, 150));
    }
  } else {
    console.error(`    Vision Provider not available!`);
  }

  console.log(`\n[2] Running OCR...`);
  let ocrFullText = '';
  try {
    const worker = await createWorker('eng', 1, {
        logger: () => {},
    });
    for (const img of ocrImages) {
      const buf = Buffer.from(img.dataUrl.split(',')[1], 'base64');
      const ocrRes = await worker.recognize(buf);
      ocrFullText += `\n=== ${img.label.toUpperCase()} LABEL ===\n` + ocrRes.data.text;
    }
    await worker.terminate();
  } catch (err: any) {
    console.error('    OCR Error:', err?.message);
  }

  const ocrParsed = parseOcrText(ocrFullText);
  const ocrKeys = Object.keys(ocrParsed.formData).filter(k =>
      ocrParsed.formData[k as keyof typeof ocrParsed.formData] !== null &&
      ocrParsed.formData[k as keyof typeof ocrParsed.formData] !== undefined &&
      ocrParsed.formData[k as keyof typeof ocrParsed.formData] !== ''
  );
  console.log(`    OCR Parsed Fields (${ocrKeys.length}): ${ocrKeys.join(', ')}`);

  console.log(`\n[3] Running Hybrid Merger...`);
  if (!visionCandidate) {
      console.log(`    Skipping hybrid merger due to Vision AI failure.`);
      return;
  }

  const mergeResult = mergeExtractions(
    ocrParsed.formData,
    ocrParsed.confidence,
    visionCandidate,
    visionConfidence
  );
  const mergeKeys = Object.keys(mergeResult.formData).filter(k => {
        const val = mergeResult.formData[k as keyof typeof mergeResult.formData];
        if (!val) return false;
        if (typeof val === 'object') return Object.values(val).some(v => v);
        return true;
  });
  console.log(`    Merged Fields (${mergeKeys.length}): ${mergeKeys.join(', ')}`);

  // UI Logic representation
  const hasOcr = ocrParsed.quality.usefulFieldsFound > 0;
  const hasVision = Object.keys(visionCandidate).some(k => visionCandidate[k]);

  let method = '';
  let msg = '';
  if (mergeKeys.length > 0) {
      method = 'vision-lm';
      msg = `Hybrid extraction: ${mergeKeys.length} fields detected.`;
  } else if (!hasVision && !hasOcr) {
      method = 'vision-lm';
      msg = 'Both Vision AI and OCR processed the images, but could not confidently identify label fields. Please review and enter details manually.';
  } else if (!hasVision) {
      method = 'ocr';
      msg = 'Vision failure. OCR only.';
  }
  console.log(`\n    UI STATE: method="${method}", message="${msg}"`);
}

async function main() {
    const greenTeaImages = [
        { file: 'green tea front.jpeg', label: 'front' },
        { file: 'green tea back.jpeg', label: 'back' },
        { file: 'green tea side.jpeg', label: 'side-other' },
    ];

    const redLabelImages = [
        { file: 'red label f.jpeg', label: 'front' },
        { file: 'redlabel side.jpeg', label: 'side' },
        { file: 'red label side2.jpeg', label: 'side-other' },
    ];

    await runTestCase('CASE A - Green Tea (1st Run)', greenTeaImages);

    // Simulate immediate sequential execution to test rate limits
    console.log(`\n    [Waiting 1 second before Case B to simulate user flow...]`);
    await new Promise(r => setTimeout(r, 1000));
    await runTestCase('CASE B - Green Tea (2nd Run, testing caching/rate limits)', greenTeaImages);

    console.log(`\n    [Waiting 1 second before Case C to simulate user flow...]`);
    await new Promise(r => setTimeout(r, 1000));
    await runTestCase('CASE C - Red Label (Different packaging, checking parsing)', redLabelImages);
}

main().catch(console.error);
