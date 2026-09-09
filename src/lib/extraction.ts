/**
 * Extraction Adapter — Nirikshak AI
 *
 * This module defines the extraction interface and provides multiple implementations:
 *
 * 1. `manualExtraction` — Returns empty form data for the inspector to fill in manually (fallback).
 * 2. `demoExtraction` — Returns pre-filled demo data for hackathon demonstrations.
 * 3. `ocrExtraction` — Uses Tesseract.js (client-side OCR) to extract text from label images,
 *    then parses structured fields using regex/heuristics. Returns pre-filled form with
 *    field-level confidence scores. Inspector reviews and corrects before submission.
 *
 * FUTURE VISION-LM INTEGRATION POINT:
 * For blurred or low-quality images where plain OCR fails, implement a `visionLmExtraction`
 * adapter that uses a vision-language model (e.g., multimodal LLM) to interpret label images
 * directly without relying solely on OCR text extraction:
 *
 *   export const visionLmExtraction: ExtractionAdapter = {
 *     name: 'vision-lm',
 *     description: 'Vision-language model extraction for low-quality/blurred images',
 *     async extract(images: CapturedImage[], onProgress?: (msg: string) => void): Promise<ExtractionResult> {
 *       // 1. Send images to vision-LM API (e.g., GPT-4 Vision, Claude 3, etc.)
 *       // 2. Request structured JSON output matching InspectionFormData schema
 *       // 3. Parse and validate the response
 *       // 4. Return with confidence scores per field
 *       // This approach handles cases where text is unreadable by OCR but visible to human/LM.
 *     },
 *   };
 *
 * The adapter pattern ensures the UI and rule engine remain unchanged when new extraction
 * methods are added. Simply implement the ExtractionAdapter interface and swap the adapter
 * in the inspection flow.
 */

import type {
  ExtractionAdapter,
  ExtractionResult,
  InspectionFormData,
  CapturedImage,
} from '@/types';
import { getEmptyFormData } from '@/types';
import { createWorker } from 'tesseract.js';
import { parseOcrText } from './ocr-parser';
import { preprocessImage } from './ocr-preprocessing';

// Shared Tesseract worker to avoid cold-start delays across image analyses
let sharedWorker: any = null;

async function getSharedWorker(onProgress?: (msg: string) => void) {
  if (!sharedWorker) {
    onProgress?.('Initializing OCR engine...');
    sharedWorker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
          onProgress?.('Loading OCR core...');
        } else if (m.status === 'loading language traineddata') {
          onProgress?.('Loading language models...');
        } else if (m.status === 'initializing api') {
          onProgress?.('Initializing OCR API...');
        } else if (m.status === 'recognizing text') {
          // Prevent spammy progress events, only if we pass a distinct parsing string later
        }
      },
    });
  }
  return sharedWorker;
}

export async function terminateSharedWorker() {
  if (sharedWorker) {
    try {
      await sharedWorker.terminate();
    } catch (e) {
      console.warn('Failed to terminate shared worker', e);
    }
    sharedWorker = null;
  }
}

/** Manual extraction — inspector fills in all fields */
export const manualExtraction: ExtractionAdapter = {
  name: 'manual',
  description: 'Manual field entry by the inspecting officer',
  async extract(_images: CapturedImage[]): Promise<ExtractionResult> {
    return {
      formData: getEmptyFormData(),
      confidence: {},
      method: 'manual',
    };
  },
};

/** Demo data samples */
const demoSamples: Record<string, Partial<InspectionFormData>> = {
  'compliant-household': {
    productName: 'SparkleClean All-Purpose Surface Cleaner',
    commonGenericName: 'All-Purpose Household Surface Cleaner',
    brand: 'SparkleClean',
    category: 'household',
    isImported: false,
    applicability: {
      isRetailPackage: true,
      soldDirectlyToConsumer: true,
      quantityKg: null,
      quantityLitre: 0.5,
      isCement: false,
      isFertiliser: false,
      isAgriculturalFarmProduce: false,
      isIndustrialConsumerPackage: false,
      isInstitutionalConsumerPackage: false,
    },
    mrp: {
      value: 149,
      inclusiveOfAllTaxes: true,
      exemptionDeclared: false,
    },
    netQuantity: {
      value: 500,
      unit: 'ml',
      itemCount: null,
      soldByNumber: false,
    },
    manufacturer: {
      name: 'CleanTech Industries Pvt. Ltd.',
      address: 'Plot 42, Industrial Area Phase II, Gurgaon, Haryana 122002',
    },
    importer: { name: '', address: '' },
    countryOfOrigin: '',
    manufactureMonth: '06',
    manufactureYear: '2025',
    bestBefore: {
      applicable: true,
      date: '',
      month: '06',
      year: '2027',
    },
    consumerCare: {
      contactName: 'Customer Service - CleanTech Industries',
      address: 'Plot 42, Industrial Area Phase II, Gurgaon, Haryana 122002',
      phone: '1800-123-4567',
      email: 'care@sparkleclean.example.in',
    },
    dimensions: { relevant: false, value: '' },
    cosmeticOrigin: { applicable: false, isVegetarian: null, symbolDeclared: null },
    visibility: {
      securelyAffixed: true,
      plainDefiniteConspicuousLegible: true,
      onPrincipalDisplayPanel: true,
    },
    supplementary: {
      batchLot: 'B2025-0642',
      barcode: '8901234567890',
      fssaiLicence: '',
      inspectorNotes: 'Demo: Compliant domestic household cleaner sample.',
    },
  },

  'non-compliant-cosmetic': {
    productName: 'Luxe Glow Radiance Face Cream',
    commonGenericName: 'Moisturising Face Cream',
    brand: 'Luxe Glow',
    category: 'cosmetics',
    isImported: true,
    applicability: {
      isRetailPackage: true,
      soldDirectlyToConsumer: true,
      quantityKg: 0.05,
      quantityLitre: null,
      isCement: false,
      isFertiliser: false,
      isAgriculturalFarmProduce: false,
      isIndustrialConsumerPackage: false,
      isInstitutionalConsumerPackage: false,
    },
    mrp: {
      value: 899,
      inclusiveOfAllTaxes: true,
      exemptionDeclared: false,
    },
    netQuantity: {
      value: 50,
      unit: 'g',
      itemCount: null,
      soldByNumber: false,
    },
    manufacturer: {
      name: 'Beauté Mondiale S.A.',
      address: '12 Rue de la Cosmétique, Paris, France',
    },
    importer: { name: '', address: '' }, // Missing importer address — deliberate non-compliance
    countryOfOrigin: '', // Missing country of origin — deliberate non-compliance
    manufactureMonth: '03',
    manufactureYear: '2025',
    bestBefore: {
      applicable: true,
      date: '',
      month: '03',
      year: '2027',
    },
    consumerCare: {
      contactName: 'Luxe Glow India Customer Care',
      address: '',
      phone: '011-2345-6789',
      email: 'india@luxeglow.example.com',
    },
    dimensions: { relevant: false, value: '' },
    cosmeticOrigin: {
      applicable: true,
      isVegetarian: true,
      symbolDeclared: false, // Missing origin symbol — deliberate
    },
    visibility: {
      securelyAffixed: true,
      plainDefiniteConspicuousLegible: true,
      onPrincipalDisplayPanel: true,
    },
    supplementary: {
      batchLot: 'LG-2025-FR-0312',
      barcode: '3700123456789',
      fssaiLicence: '',
      inspectorNotes: 'Demo: Imported cosmetic with missing importer address, country of origin, and origin symbol.',
    },
  },

  'food-review': {
    productName: 'NutriCrunch Masala Oats',
    commonGenericName: 'Instant Flavoured Oats',
    brand: 'NutriCrunch',
    category: 'food',
    isImported: false,
    applicability: {
      isRetailPackage: true,
      soldDirectlyToConsumer: true,
      quantityKg: 0.4,
      quantityLitre: null,
      isCement: false,
      isFertiliser: false,
      isAgriculturalFarmProduce: false,
      isIndustrialConsumerPackage: false,
      isInstitutionalConsumerPackage: false,
    },
    mrp: {
      value: 120,
      inclusiveOfAllTaxes: true,
      exemptionDeclared: false,
    },
    netQuantity: {
      value: 400,
      unit: 'g',
      itemCount: null,
      soldByNumber: false,
    },
    manufacturer: {
      name: 'NutriCrunch Foods India Ltd.',
      address: '8-B, Food Processing Zone, MIDC, Pune, Maharashtra 411057',
    },
    importer: { name: '', address: '' },
    countryOfOrigin: '',
    manufactureMonth: '07',
    manufactureYear: '2025',
    bestBefore: {
      applicable: true,
      date: '',
      month: '01',
      year: '2026',
    },
    consumerCare: {
      contactName: 'NutriCrunch Consumer Relations',
      address: '8-B, Food Processing Zone, MIDC, Pune, Maharashtra 411057',
      phone: '1800-222-3344',
      email: 'care@nutricrunch.example.in',
    },
    dimensions: { relevant: false, value: '' },
    cosmeticOrigin: { applicable: false, isVegetarian: null, symbolDeclared: null },
    visibility: {
      securelyAffixed: true,
      plainDefiniteConspicuousLegible: true,
      onPrincipalDisplayPanel: true,
    },
    supplementary: {
      batchLot: 'NC-PUN-2025-0718',
      barcode: '8904567890123',
      fssaiLicence: '10025048000123',
      inspectorNotes: 'Demo: Food item — core Legal Metrology fields present but food-specific FSSAI review required.',
    },
  },
};

export type DemoSampleKey = keyof typeof demoSamples;

export function getDemoSampleKeys(): DemoSampleKey[] {
  return Object.keys(demoSamples) as DemoSampleKey[];
}

export function getDemoSampleLabel(key: DemoSampleKey): string {
  const labels: Record<string, string> = {
    'compliant-household': '✅ Compliant Household Cleaner',
    'non-compliant-cosmetic': '⚠️ Imported Cosmetic (Non-Compliant)',
    'food-review': '🔍 Packaged Food (Needs Review)',
  };
  return labels[key as string] || key as string;
}

const demoConfidences: Record<string, Record<string, number>> = {
  'compliant-household': {
    'mrp.value': 95,
    'mrp.inclusiveOfAllTaxes': 92,
    'netQuantity.value': 88,
    'netQuantity.unit': 90,
    'manufacturer.name': 85,
    'manufacturer.address': 82,
    'manufactureMonth': 80,
    'manufactureYear': 80,
    'bestBefore.month': 85,
    'bestBefore.year': 85,
    'consumerCare.phone': 92,
    'consumerCare.email': 96,
    'consumerCare.contactName': 75,
    'consumerCare.address': 78,
    'supplementary.batchLot': 90,
    'supplementary.barcode': 94,
  },
  'non-compliant-cosmetic': {
    'mrp.value': 88,
    'mrp.inclusiveOfAllTaxes': 85,
    'netQuantity.value': 78,
    'netQuantity.unit': 80,
    'manufacturer.name': 45, // Low confidence — OCR misread, demonstrates inspector correction
    'manufacturer.address': 50,
    'manufactureMonth': 70,
    'manufactureYear': 70,
    'bestBefore.month': 75,
    'bestBefore.year': 75,
    'consumerCare.phone': 80,
    'consumerCare.email': 88,
    'supplementary.batchLot': 82,
    'supplementary.barcode': 85,
  },
  'food-review': {
    'mrp.value': 90,
    'mrp.inclusiveOfAllTaxes': 88,
    'netQuantity.value': 85,
    'netQuantity.unit': 87,
    'manufacturer.name': 80,
    'manufacturer.address': 78,
    'manufactureMonth': 75,
    'manufactureYear': 75,
    'bestBefore.month': 82,
    'bestBefore.year': 82,
    'consumerCare.phone': 89,
    'consumerCare.email': 94,
    'supplementary.batchLot': 88,
    'supplementary.barcode': 92,
    'supplementary.fssaiLicence': 95,
  },
};

export function getDemoConfidence(key: DemoSampleKey): Record<string, number> {
  return demoConfidences[key] || {};
}

export function getDemoSample(key: DemoSampleKey): Partial<InspectionFormData> {
  return demoSamples[key] || {};
}

/** Demo extraction — returns pre-filled sample data */
export const demoExtraction: ExtractionAdapter = {
  name: 'demo',
  description: 'Pre-filled demo data for hackathon demonstration',
  async extract(_images: CapturedImage[]): Promise<ExtractionResult> {
    // Default to compliant household cleaner
    const sample = demoSamples['compliant-household'];
    if (!sample) {
      return {
        formData: getEmptyFormData(),
        confidence: {},
        method: 'demo',
      };
    }

    return {
      formData: sample,
      confidence: Object.fromEntries(
        Object.keys(sample).map((k) => [k, 1.0])
      ),
      method: 'demo',
    };
  },
};

/** OCR extraction — uses Tesseract.js to extract text from images and parse fields */
export const ocrExtraction: ExtractionAdapter = {
  name: 'ocr',
  description: 'Client-side OCR using Tesseract.js with heuristic field parsing',
  async extract(images: CapturedImage[], onProgress?: (msg: string) => void): Promise<ExtractionResult> {
    console.group('[OCR Extraction] ========== OCR PIPELINE START ==========');
    console.log('[OCR Extraction] Images to process:', images.length);

    if (images.length === 0) {
      console.log('[OCR Extraction] No images provided');
      console.groupEnd();
      return {
        formData: getEmptyFormData(),
        confidence: {},
        method: 'ocr',
        extractionStatus: 'no-images',
      } as any;
    }

    let worker;
    try {
      console.log('[OCR Extraction] Getting Tesseract worker...');
      worker = await getSharedWorker(onProgress);
      console.log('[OCR Extraction] ✓ Worker ready');
    } catch (workerError: any) {
      console.error('[OCR Extraction] ✗ Worker creation failed:', workerError);
      console.groupEnd();
      return {
        formData: getEmptyFormData(),
        confidence: {},
        method: 'ocr',
        extractionStatus: 'init-failed',
        error: workerError?.message || String(workerError),
      } as any;
    }

    const allResults: Array<{
      label: string;
      text: string;
      confidence: number;
      wordCount: number;
      avgWordConf: number;
      topWords: Array<{ word: string; confidence: number }>;
      preprocessed: boolean;
    }> = [];

    try {
      for (let i = 0; i < images.length; i++) { const img = images[i];
        onProgress?.(`Analyzing image ${i + 1} of ${images.length} (${img.label.toUpperCase()})...`);
        console.group(`[OCR Extraction] Processing: ${img.label.toUpperCase()}`);
        console.log('[OCR Extraction] Image ID:', img.id);
        console.log('[OCR Extraction] Timestamp:', new Date(img.timestamp).toISOString());

        // Log image info
        const imgInfo = await getImageInfo(img.dataUrl);
        console.log('[OCR Extraction] Image dimensions:', imgInfo.width, 'x', imgInfo.height);
        console.log('[OCR Extraction] Image size:', imgInfo.size);

        // Preprocess image
        console.log('[OCR Extraction] Preprocessing image...');
        const preprocessed = await preprocessImage(img.dataUrl);
        console.log('[OCR Extraction] Preprocessing:', preprocessed.diagnostics);

        // Use recommended preprocessing variant
        const imageData = preprocessed.recommended.dataUrl;
        console.log('[OCR Extraction] Using variant:', preprocessed.recommended.variant);

        // Run OCR
        console.log('[OCR Extraction] Running Tesseract recognition...');
        const { data } = await worker.recognize(imageData);

        console.log('[OCR Extraction] ✓ Recognition complete');
        console.log('[OCR Extraction] Raw text length:', data.text.length, 'chars');
        console.log('[OCR Extraction] Tesseract confidence:', data.confidence?.toFixed(1) || 'N/A');

        // Extract word-level data for better diagnostics
        const words = (data as any).words || [];
        const wordCount = words.length;
        const avgWordConf = words.length > 0
          ? words.reduce((sum: number, w: any) => sum + (w.confidence || 0), 0) / words.length
          : 0;

        // Top 10 words by confidence
        const topWords = words
          .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
          .slice(0, 10)
          .map((w: any) => ({ word: w.text, confidence: w.confidence || 0 }));

        console.log('[OCR Extraction] Word count:', wordCount);
        console.log('[OCR Extraction] Avg word confidence:', avgWordConf.toFixed(1));
        console.log('[OCR Extraction] Top words:', topWords.slice(0, 5).map((w: any) => w.word).join(', '));

        // Log raw text preview
        const preview = data.text.substring(0, 500).replace(/\n/g, '↵\n');
        console.log('[OCR Extraction] Raw text preview:\n', preview);

        allResults.push({
          label: img.label,
          text: data.text,
          confidence: data.confidence || 0,
          wordCount,
          avgWordConf,
          topWords,
          preprocessed: true,
        });

        console.groupEnd();
      }

      // NO LONGER TERMINATING HERE: Reuse the worker for next extraction
      console.log('[OCR Extraction] ✓ Recognition complete for all images, leaving worker active');

      // Combine text from all images
      const combinedText = allResults.map(r => `=== ${r.label.toUpperCase()} ===\n${r.text}`).join('\n\n');
      const avgConfidence = allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length;
      const totalWords = allResults.reduce((sum, r) => sum + r.wordCount, 0);

      console.log('[OCR Extraction] Combined text length:', combinedText.length);
      console.log('[OCR Extraction] Total words recognized:', totalWords);
      console.log('[OCR Extraction] Average OCR confidence:', avgConfidence.toFixed(1));

      // Check if we have meaningful text
      if (combinedText.trim().length < 50) {
        console.log('[OCR Extraction] ✗ Insufficient text detected');
        console.groupEnd();
        return {
          formData: getEmptyFormData(),
          confidence: {},
          method: 'ocr',
          extractionStatus: 'no-text',
          rawTextPreview: combinedText.substring(0, 200),
        } as any;
      }

      // Parse the combined text
      console.log('[OCR Extraction] Parsing extracted text...');
      const parsed = parseOcrText(combinedText, avgConfidence);

      console.log('[OCR Extraction] ✓ Parsing complete');
      console.log('[OCR Extraction] Useful fields found:', parsed.quality.usefulFieldsFound);
      console.log('[OCR Extraction] Fields populated:', Object.keys(parsed.formData).join(', ') || 'None');

      const result = {
        formData: parsed.formData,
        confidence: parsed.confidence,
        method: 'ocr',
        extractionStatus: parsed.quality.usefulFieldsFound > 0 ? 'success' : 'no-useful-fields',
        fieldCount: parsed.quality.usefulFieldsFound,
        rawText: combinedText,
        diagnostics: {
          textLength: combinedText.length,
          wordCount: totalWords,
          avgConfidence: Math.round(avgConfidence),
          fieldsExtracted: Object.keys(parsed.formData),
          imageResults: allResults.map(r => ({
            label: r.label,
            textLength: r.text.length,
            wordCount: r.wordCount,
            confidence: Math.round(r.confidence),
          })),
        },
      };

      console.log('[OCR Extraction] Final result:', {
        status: result.extractionStatus,
        fields: result.fieldCount,
        formData: result.formData,
      });
      console.groupEnd();

      return result as any;

    } catch (error: any) {
      console.error('[OCR Extraction] ✗ OCR recognition failed:', error);
      // If a specific image recognition fails, we might need to reset.
      // For now, let's just log and return error status.
      // We don't terminate here so shared worker survives if possible.
      console.groupEnd();
      return {
        formData: getEmptyFormData(),
        confidence: {},
        method: 'ocr',
        extractionStatus: 'recognition-failed',
        error: error?.message || String(error),
      } as any;
    }
  },
};

/**
 * Get image information for diagnostics
 */
async function getImageInfo(dataUrl: string): Promise<{ width: number; height: number; size: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = dataUrl.length * 0.75; // Approximate bytes from base64
      const sizeStr = size > 1024 * 1024
        ? `${(size / (1024 * 1024)).toFixed(2)} MB`
        : `${(size / 1024).toFixed(2)} KB`;
      resolve({ width: img.width, height: img.height, size: sizeStr });
    };
    img.onerror = () => resolve({ width: 0, height: 0, size: 'unknown' });
    img.src = dataUrl;
  });
}

/**
 * Hybrid Extraction Adapter — combines OCR and Vision AI
 *
 * Flow:
 * 1. Try Vision AI extraction via /api/extract
 * 2. Run Tesseract OCR in parallel or as fallback
 * 3. Merge results using conservative hybrid merger
 * 4. Return combined extraction with source tags
 */
export const hybridExtraction: ExtractionAdapter = {
  name: 'hybrid',
  description: 'Hybrid extraction using Vision AI + Tesseract OCR with conservative merging',
  async extract(images: CapturedImage[], onProgress?: (statusMessage: string) => void): Promise<ExtractionResult> {
    console.group('[Hybrid Extraction] ========== HYBRID PIPELINE START ==========');
    console.log('[Hybrid Extraction] Images to process:', images.length);

    if (images.length === 0) {
      console.log('[Hybrid Extraction] No images provided');
      console.groupEnd();
      return {
        formData: getEmptyFormData(),
        confidence: {},
        method: 'manual',
        extractionStatus: 'no-images',
      } as any;
    }

    // Prepare results
    let ocrResult: any = null;
    let visionResult: any = null;
    let visionError: string | null = null;

    // Run OCR and Vision AI in parallel
    const [ocrPromise, visionPromise] = await Promise.allSettled([
      // OCR extraction
      (async () => {
        console.log('[Hybrid Extraction] Starting Tesseract OCR...');
        return await ocrExtraction.extract(images, onProgress);
      })(),
      // Vision AI extraction
      (async () => {
        console.log('[Hybrid Extraction] Starting Vision AI...');
        onProgress?.('Extracting text with Vision AI...');
        const response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: images.map(img => ({
              dataUrl: img.dataUrl,
              label: img.label,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Vision API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      })(),
    ]);

    // Process OCR result
    if (ocrPromise.status === 'fulfilled') {
      ocrResult = ocrPromise.value;
      console.log('[Hybrid Extraction] OCR completed, fields:', ocrResult?.fieldCount || 0);
    } else {
      console.warn('[Hybrid Extraction] OCR failed:', ocrPromise.reason);
    }

    // Process Vision AI result
    if (visionPromise.status === 'fulfilled') {
      const visionData = visionPromise.value;
      if (visionData.success) {
        visionResult = visionData.extraction;
        console.log('[Hybrid Extraction] Vision AI completed, fields:', Object.keys(visionResult.candidate).filter(k => visionResult.candidate[k]).length);
      } else {
        visionError = visionData.error;
        console.warn('[Hybrid Extraction] Vision AI returned error:', visionError);
      }
    } else {
      visionError = visionPromise.reason?.message || String(visionPromise.reason);
      console.warn('[Hybrid Extraction] Vision AI failed:', visionError);
    }

    // Determine extraction mode
    const hasOcr = ocrResult && ocrResult.fieldCount > 0;
    const hasVision = visionResult && Object.keys(visionResult.candidate).some(k => visionResult.candidate[k]);

    if (!hasOcr && !hasVision) {
      console.log('[Hybrid Extraction] Both OCR and Vision AI failed or found nothing');
      console.groupEnd();
      return {
        formData: getEmptyFormData(),
        confidence: {},
        method: 'manual',
        extractionStatus: 'no-useful-fields',
        error: visionError || 'No fields could be extracted',
      } as any;
    }

    // If only one source available, use it directly
    if (!hasVision) {
      console.log('[Hybrid Extraction] Using OCR-only mode (Vision AI unavailable)');
      console.groupEnd();
      return {
        ...ocrResult,
        method: 'ocr',
      };
    }

    if (!hasOcr) {
      console.log('[Hybrid Extraction] Using Vision AI-only mode (OCR found nothing)');
      // Convert Vision AI candidate to form data
      const formData: Partial<InspectionFormData> = {
        productName: visionResult.candidate.productName || '',
        commonGenericName: visionResult.candidate.commonGenericName || '',
        brand: visionResult.candidate.brand || '',
        countryOfOrigin: visionResult.candidate.countryOfOrigin || '',
        manufactureMonth: visionResult.candidate.manufactureMonth || '',
        manufactureYear: visionResult.candidate.manufactureYear || '',
        manufacturer: {
          name: visionResult.candidate.manufacturerName || '',
          address: visionResult.candidate.manufacturerAddress || '',
        },
        importer: {
          name: visionResult.candidate.importerName || '',
          address: visionResult.candidate.importerAddress || '',
        },
        consumerCare: {
          contactName: visionResult.candidate.consumerCareName || '',
          address: visionResult.candidate.consumerCareAddress || '',
          phone: visionResult.candidate.consumerCarePhone || '',
          email: visionResult.candidate.consumerCareEmail || '',
        },
        supplementary: {
          batchLot: visionResult.candidate.batchLot || '',
          barcode: visionResult.candidate.barcode || '',
          fssaiLicence: visionResult.candidate.fssaiLicense || '',
          inspectorNotes: '',
        },
      };

      if (visionResult.candidate.mrp) {
        formData.mrp = {
          value: visionResult.candidate.mrp,
          inclusiveOfAllTaxes: visionResult.candidate.mrpInclusiveTaxes || null,
          exemptionDeclared: false,
        };
      }

      if (visionResult.candidate.netQuantity) {
        formData.netQuantity = {
          value: visionResult.candidate.netQuantity,
          unit: visionResult.candidate.unit || '',
          itemCount: null,
          soldByNumber: false,
        };
      }

      console.groupEnd();
      return {
        formData,
        confidence: visionResult.confidence,
        method: 'vision-lm',
        extractionStatus: 'success',
        fieldCount: Object.keys(formData).filter(k => formData[k as keyof typeof formData]).length,
      } as any;
    }

    // Hybrid merge: combine OCR and Vision AI
    console.log('[Hybrid Extraction] Merging OCR and Vision AI results...');
    onProgress?.('Merging OCR and Vision AI results...');
    const { mergeExtractions } = await import('./hybrid-merger');
    const merged = mergeExtractions(
      ocrResult.formData,
      ocrResult.confidence,
      visionResult.candidate,
      visionResult.confidence,
      ocrResult.fieldDetails
    );

    console.log('[Hybrid Extraction] Merge complete, fields:', Object.keys(merged.formData).filter(k => merged.formData[k as keyof typeof merged.formData]));
    console.log('[Hybrid Extraction] Source map:', merged.sourceMap);
    console.groupEnd();

    return {
      formData: merged.formData,
      confidence: merged.confidence,
      method: 'vision-lm', // Indicate AI was used
      extractionStatus: 'success',
      fieldCount: Object.keys(merged.formData).filter(k => {
        const val = merged.formData[k as keyof typeof merged.formData];
        if (!val) return false;
        if (typeof val === 'object') return Object.values(val).some(v => v);
        return true;
      }).length,
      sourceMap: merged.sourceMap,
      metadata: merged.metadata,
    } as any;
  },
};

/** Get the appropriate extraction adapter */
export function getExtractionAdapter(mode: 'manual' | 'demo' | 'ocr' | 'hybrid'): ExtractionAdapter {
  switch (mode) {
    case 'hybrid':
      return hybridExtraction;
    case 'ocr':
      return ocrExtraction;
    case 'demo':
      return demoExtraction;
    case 'manual':
    default:
      return manualExtraction;
  }
}
