/**
 * Hybrid Extraction Merger — Nirikshak AI
 *
 * Combines OCR and Vision AI extraction candidates using conservative rules.
 * Strategy:
 * 1. Both agree (or one is null/empty) -> use agreed/non-null value, tag as 'ocr+ai'
 * 2. Only OCR has value -> use OCR, tag as 'ocr'
 * 3. Only AI has value -> use AI, tag as 'ai'
 * 4. Both disagree significantly -> leave for manual review, tag as 'manual'
 *
 * Never trust a single source on critical fields like productName, MRP.
 */

import type { InspectionFormData } from '@/types';
import type { VisionExtractionCandidate, FieldExtractionMeta, ExtractionSource } from '@/lib/vision/types';

export interface HybridMergeResult {
  formData: Partial<InspectionFormData>;
  confidence: Record<string, number>;
  sourceMap: Record<string, ExtractionSource>; // Track extraction source per field
  metadata: Record<string, FieldExtractionMeta>; // Detailed extraction metadata
}

/**
 * Conservative similarity checker for string values
 * Returns true if values are "similar enough" (accounting for typos, case, whitespace)
 */
function stringsAgree(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;

  const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  // Exact match
  if (aNorm === bNorm) return true;

  // Check if one contains the other (common for addresses, names)
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
    const longer = aNorm.length > bNorm.length ? aNorm : bNorm;
    const shorter = aNorm.length > bNorm.length ? bNorm : aNorm;
    // If shorter is at least 35% of longer, consider them agreeing
    return shorter.length >= longer.length * 0.35;
  }

  return false;
}

/**
 * Numeric similarity checker (allows 5% tolerance)
 */
function numbersAgree(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;

  const diff = Math.abs(a - b);
  const tolerance = Math.max(Math.abs(a), Math.abs(b)) * 0.05; // 5% tolerance
  return diff <= tolerance;
}

/**
 * Merge OCR and Vision AI extraction candidates
 */
export function mergeExtractions(
  ocrCandidate: Partial<InspectionFormData>,
  ocrConfidence: Record<string, number>,
  aiCandidate: VisionExtractionCandidate,
  aiConfidence: Record<string, number>
): HybridMergeResult {
  const formData: Partial<InspectionFormData> = {};
  const sourceMap: Record<string, ExtractionSource> = {};
  const metadata: Record<string, FieldExtractionMeta> = {};
  const confidence: Record<string, number> = {};

  // Map AI fields to form data structure
  const aiMapped: Partial<InspectionFormData> = {
    productName: aiCandidate.productName || '',
    commonGenericName: aiCandidate.commonGenericName || '',
    brand: aiCandidate.brand || '',
    countryOfOrigin: aiCandidate.countryOfOrigin || '',
    manufactureMonth: aiCandidate.manufactureMonth || '',
    manufactureYear: aiCandidate.manufactureYear || '',
    bestBefore: {
      applicable: true,
      date: '',
      month: aiCandidate.bestBeforeMonth || '',
      year: aiCandidate.bestBeforeYear || '',
    },
    supplementary: {
      batchLot: aiCandidate.batchLot || '',
      barcode: aiCandidate.barcode || '',
      fssaiLicence: aiCandidate.fssaiLicense || '',
      inspectorNotes: '',
    },
    consumerCare: {
      contactName: aiCandidate.consumerCareName || '',
      address: aiCandidate.consumerCareAddress || '',
      phone: aiCandidate.consumerCarePhone || '',
      email: aiCandidate.consumerCareEmail || '',
    },
    manufacturer: {
      name: aiCandidate.manufacturerName || '',
      address: aiCandidate.manufacturerAddress || '',
    },
    importer: {
      name: aiCandidate.importerName || '',
      address: aiCandidate.importerAddress || '',
    },
  };

  // Handle simple string fields
  const stringFields: Array<keyof Omit<InspectionFormData, 'mrp' | 'netQuantity' | 'applicability' | 'bestBefore' | 'dimensions' | 'cosmeticOrigin' | 'visibility' | 'supplementary' | 'consumerCare' | 'manufacturer' | 'importer'>> = [
    'productName',
    'commonGenericName',
    'brand',
    'countryOfOrigin',
    'manufactureMonth',
    'manufactureYear',
  ];

  for (const field of stringFields) {
    const ocrVal = (ocrCandidate[field] as any) || '';
    const aiVal = (aiMapped[field] as any) || '';

    if (stringsAgree(ocrVal, aiVal)) {
      // Both agree or are equivalent
      formData[field] = ocrVal || aiVal;
      sourceMap[field] = 'ocr+ai';
      confidence[field] = Math.min(
        (ocrConfidence[field] || 0) + 10,
        100
      ); // Boost confidence when both agree
      metadata[field] = {
        source: 'ocr+ai',
        confidence: confidence[field],
        ocrValue: ocrVal,
        aiValue: aiVal,
      };
    } else if (ocrVal && aiVal) {
      // Both present but disagree — leave for manual review
      console.warn(`[Hybrid Merger] Field "${field}" disagreement: OCR="${ocrVal}" vs AI="${aiVal}"`);
      // Prefer higher confidence source for prefill, but flag as manual for inspector review
      formData[field] = (aiConfidence[field] || 0) > (ocrConfidence[field] || 0) ? aiVal : ocrVal;
      sourceMap[field] = 'manual';
      confidence[field] = Math.max(ocrConfidence[field] || 0, aiConfidence[field] || 0) - 20; // Lower confidence
      metadata[field] = {
        source: 'manual',
        confidence: confidence[field],
        ocrValue: ocrVal,
        aiValue: aiVal,
      };
    } else if (ocrVal) {
      // Only OCR has value
      formData[field] = ocrVal;
      sourceMap[field] = 'ocr';
      confidence[field] = ocrConfidence[field] || 0;
      metadata[field] = {
        source: 'ocr',
        confidence: confidence[field],
        ocrValue: ocrVal,
      };
    } else if (aiVal) {
      // Only AI has value
      formData[field] = aiVal;
      sourceMap[field] = 'ai';
      confidence[field] = aiConfidence[field] || 0;
      metadata[field] = {
        source: 'ai',
        confidence: confidence[field],
        aiValue: aiVal,
      };
    }
  }

  // Handle MRP (nested object)
  const ocrMrp = ocrCandidate.mrp;
  const aiMrp = aiCandidate.mrp ? { value: aiCandidate.mrp, inclusiveOfAllTaxes: aiCandidate.mrpInclusiveTaxes } : null;

  if (ocrMrp && aiMrp && numbersAgree(ocrMrp.value, aiMrp.value)) {
    formData.mrp = ocrMrp;
    sourceMap['mrp'] = 'ocr+ai';
    confidence['mrp.value'] = Math.min((ocrConfidence['mrp.value'] || 0) + 10, 100);
  } else if (ocrMrp && aiMrp) {
    console.warn(`[Hybrid Merger] MRP disagreement: OCR=${ocrMrp.value} vs AI=${aiMrp.value}`);
    formData.mrp = ocrMrp;
    sourceMap['mrp'] = 'manual';
    confidence['mrp.value'] = Math.max(ocrConfidence['mrp.value'] || 0, aiConfidence['mrp'] || 0) - 20;
  } else if (ocrMrp) {
    formData.mrp = ocrMrp;
    sourceMap['mrp'] = 'ocr';
    confidence['mrp.value'] = ocrConfidence['mrp.value'] || 0;
  } else if (aiMrp) {
    formData.mrp = { ...aiMrp, exemptionDeclared: false, inclusiveOfAllTaxes: aiMrp.inclusiveOfAllTaxes ?? null };
    sourceMap['mrp'] = 'ai';
    confidence['mrp.value'] = aiConfidence['mrp'] || 0;
  }

  // Handle Net Quantity (nested object)
  const ocrQty = ocrCandidate.netQuantity;
  const aiQty = aiCandidate.netQuantity ? { value: aiCandidate.netQuantity, unit: aiCandidate.unit || '' } : null;

  if (ocrQty && aiQty && numbersAgree(ocrQty.value, aiQty.value) && ocrQty.unit === aiQty.unit) {
    formData.netQuantity = ocrQty;
    sourceMap['netQuantity'] = 'ocr+ai';
    confidence['netQuantity.value'] = Math.min((ocrConfidence['netQuantity.value'] || 0) + 10, 100);
  } else if (ocrQty && aiQty) {
    console.warn(`[Hybrid Merger] Quantity disagreement: OCR=${ocrQty.value} ${ocrQty.unit} vs AI=${aiQty.value} ${aiQty.unit}`);
    formData.netQuantity = ocrQty;
    sourceMap['netQuantity'] = 'manual';
    confidence['netQuantity.value'] = Math.max(ocrConfidence['netQuantity.value'] || 0, aiConfidence['netQuantity'] || 0) - 20;
  } else if (ocrQty) {
    formData.netQuantity = ocrQty;
    sourceMap['netQuantity'] = 'ocr';
    confidence['netQuantity.value'] = ocrConfidence['netQuantity.value'] || 0;
  } else if (aiQty) {
    formData.netQuantity = {
      value: aiQty.value,
      unit: aiQty.unit,
      itemCount: null,
      soldByNumber: false,
    };
    sourceMap['netQuantity'] = 'ai';
    confidence['netQuantity.value'] = aiConfidence['netQuantity'] || 0;
  }

  // Handle nested contact objects and supplementary fields
  const contactFields = ['manufacturer', 'importer', 'consumerCare', 'supplementary'] as const;
  for (const contactField of contactFields) {
    const ocrContact = (ocrCandidate[contactField] as any) || {};
    const aiContact = (aiMapped[contactField] as any) || {};

    const mergedContact: any = {};
    let hasOcr = false;
    let hasAi = false;

    const allSubFields = Array.from(new Set([...Object.keys(ocrContact), ...Object.keys(aiContact)]));

    for (const subField of allSubFields) {
      const ocrSubVal = ocrContact[subField] || '';
      const aiSubVal = aiContact[subField] || '';

      if (stringsAgree(ocrSubVal, aiSubVal)) {
        mergedContact[subField] = ocrSubVal || aiSubVal;
      } else if (ocrSubVal && aiSubVal) {
        mergedContact[subField] = ocrSubVal; // Default to OCR
      } else if (ocrSubVal) {
        mergedContact[subField] = ocrSubVal;
      } else if (aiSubVal) {
        mergedContact[subField] = aiSubVal;
      }

      if (ocrSubVal) hasOcr = true;
      if (aiSubVal) hasAi = true;
    }

    if (Object.values(mergedContact).some(v => v)) {
      formData[contactField] = mergedContact;
      sourceMap[contactField] = hasOcr && hasAi ? 'ocr+ai' : hasOcr ? 'ocr' : 'ai';
    }
  }

  // Handle nested Objects containing dates
  const ocrBestBefore = ocrCandidate.bestBefore;
  const aiBestBefore = aiMapped.bestBefore;

  if (ocrBestBefore?.month && aiBestBefore?.month) {
      const mergedBB: any = {applicable: true, date: ''};
      let hasOcrBB = false;
      let hasAiBB = false;

      const bbFields = ['month', 'year'] as const;
      for (const bbField of bbFields) {
          const ocrVal = ocrBestBefore[bbField] || '';
          const aiVal = aiBestBefore[bbField] || '';

          if (ocrVal === aiVal && aiVal !== '') {
             mergedBB[bbField] = aiVal;
          } else if (ocrVal && aiVal) {
             mergedBB[bbField] = ocrVal;
          } else if (ocrVal) {
             mergedBB[bbField] = ocrVal;
          } else if (aiVal) {
             mergedBB[bbField] = aiVal;
          }
           if (ocrVal) hasOcrBB = true;
           if (aiVal) hasAiBB = true;
      }

      formData.bestBefore = mergedBB;
      const srce = hasOcrBB && hasAiBB ? 'ocr+ai' : hasOcrBB ? 'ocr' : 'ai';
      sourceMap['bestBefore'] = srce as any;
      if (mergedBB.month) confidence['bestBefore.month'] = srce === 'ocr+ai' ? 95 : 85;
      if (mergedBB.year) confidence['bestBefore.year'] = srce === 'ocr+ai' ? 95 : 85;

  } else if (ocrBestBefore) {
      formData.bestBefore = ocrBestBefore;
      sourceMap['bestBefore'] = 'ocr';
      if (ocrBestBefore.month) confidence['bestBefore.month'] = ocrConfidence['bestBefore.month'] || 80;
      if (ocrBestBefore.year) confidence['bestBefore.year'] = ocrConfidence['bestBefore.year'] || 80;
  } else if (aiBestBefore && (aiBestBefore.month || aiBestBefore.year)) {
      formData.bestBefore = aiBestBefore;
      sourceMap['bestBefore'] = 'ai';
      if (aiBestBefore.month) confidence['bestBefore.month'] = aiConfidence['bestBeforeMonth'] || 80;
      if (aiBestBefore.year) confidence['bestBefore.year'] = aiConfidence['bestBeforeYear'] || 80;
  }

  return {
    formData,
    confidence,
    sourceMap,
    metadata,
  };
}
