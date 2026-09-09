/**
 * Hybrid Extraction Merger — Nirikshak AI
 *
 * Combines OCR and Vision AI extraction candidates using conservative, explainable rules.
 * Strategy:
 * 1. Both agree -> use agreed value, tag as 'ocr+ai', qualitative confidence 'High'
 * 2. Only OCR has value -> use OCR, tag as 'ocr', derive qualitative tier from confidence
 * 3. Only AI has value -> use AI, tag as 'ai', derive qualitative tier from confidence
 * 4. Both disagree significantly -> leave for manual review, tag as 'manual', qualitative confidence 'Needs Review'
 *
 * Tracks spatial provenance (sourceSide) and verbatim evidence snippets for auditability.
 * Never trust a single source uncritically on mandatory legal metrology fields.
 */

import type { InspectionFormData } from '@/types';
import type {
  VisionExtractionCandidate,
  FieldExtractionMeta,
  ExtractionSource,
  QualitativeConfidence,
} from '@/lib/vision/types';
import type { OCRField } from '@/lib/ocr-parser';

export interface HybridMergeResult {
  formData: Partial<InspectionFormData>;
  confidence: Record<string, number>;
  sourceMap: Record<string, ExtractionSource>;
  metadata: Record<string, FieldExtractionMeta>;
}

/**
 * Determine qualitative confidence tier from source and numerical score
 */
export function getQualitativeConfidence(
  source: ExtractionSource,
  score: number
): QualitativeConfidence {
  if (source === 'manual') return 'Needs Review';
  if (source === 'ocr+ai') return 'High';
  if (score >= 80) return 'High';
  if (score >= 60) return 'Medium';
  return 'Low';
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
 * Normalize and compare month/year strings
 */
function datesAgree(
  m1?: string | null,
  y1?: string | null,
  m2?: string | null,
  y2?: string | null
): boolean {
  if (!m1 && !y1 && !m2 && !y2) return true;
  const normM1 = m1 ? m1.padStart(2, '0') : '';
  const normM2 = m2 ? m2.padStart(2, '0') : '';
  const normY1 = y1 ? (y1.length === 2 ? '20' + y1 : y1) : '';
  const normY2 = y2 ? (y2.length === 2 ? '20' + y2 : y2) : '';

  const monthMatch = !normM1 || !normM2 || normM1 === normM2;
  const yearMatch = !normY1 || !normY2 || normY1 === normY2;

  return monthMatch && yearMatch && Boolean((normM1 && normM2) || (normY1 && normY2));
}

/**
 * Merge OCR and Vision AI extraction candidates with explainability and spatial provenance
 */
export function mergeExtractions(
  ocrCandidate: Partial<InspectionFormData>,
  ocrConfidence: Record<string, number>,
  aiCandidate: VisionExtractionCandidate,
  aiConfidence: Record<string, number>,
  ocrFieldDetails?: Record<string, OCRField>
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

  // Helper to record field meta
  const recordFieldMeta = (
    fieldKey: string,
    source: ExtractionSource,
    score: number,
    ocrVal?: any,
    aiVal?: any,
    fieldDetailKey?: string
  ) => {
    const detailKey = fieldDetailKey || fieldKey;
    const ocrDetail = ocrFieldDetails?.[detailKey];
    const sourceSide = ocrDetail?.sourceSide || 'unknown';
    const ocrEvidence = ocrDetail?.sourceLine || ocrDetail?.source;
    const aiEvidence = aiVal ? String(aiVal) : undefined;

    confidence[fieldKey] = score;
    sourceMap[fieldKey] = source;
    metadata[fieldKey] = {
      source,
      confidence: score,
      qualitativeConfidence: getQualitativeConfidence(source, score),
      sourceSide: source === 'ai' ? 'unknown' : sourceSide,
      ocrValue: ocrVal ? String(ocrVal) : undefined,
      aiValue: aiVal ? String(aiVal) : undefined,
      ocrEvidenceSnippet: ocrEvidence,
      aiEvidenceSnippet: aiEvidence,
    };
  };

  // 1. Handle simple string fields
  const stringFields: Array<keyof Omit<
    InspectionFormData,
    | 'mrp'
    | 'netQuantity'
    | 'applicability'
    | 'bestBefore'
    | 'dimensions'
    | 'cosmeticOrigin'
    | 'visibility'
    | 'supplementary'
    | 'consumerCare'
    | 'manufacturer'
    | 'importer'
  >> = [
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
      // Agreement
      formData[field] = ocrVal || aiVal;
      const score = Math.min((ocrConfidence[field] || 0) + 10, 100);
      recordFieldMeta(field, 'ocr+ai', score, ocrVal, aiVal);
    } else if (ocrVal && aiVal) {
      // Disagreement -> Manual review
      formData[field] = (aiConfidence[field] || 0) > (ocrConfidence[field] || 0) ? aiVal : ocrVal;
      const score = Math.max(ocrConfidence[field] || 0, aiConfidence[field] || 0) - 20;
      recordFieldMeta(field, 'manual', score, ocrVal, aiVal);
    } else if (ocrVal) {
      formData[field] = ocrVal;
      const score = ocrConfidence[field] || 0;
      recordFieldMeta(field, 'ocr', score, ocrVal, undefined);
    } else if (aiVal) {
      formData[field] = aiVal;
      const score = aiConfidence[field] || 0;
      recordFieldMeta(field, 'ai', score, undefined, aiVal);
    }
  }

  // 2. Handle MRP
  const ocrMrp = ocrCandidate.mrp;
  const aiMrp = aiCandidate.mrp
    ? { value: aiCandidate.mrp, inclusiveOfAllTaxes: aiCandidate.mrpInclusiveTaxes }
    : null;

  if (ocrMrp && aiMrp && numbersAgree(ocrMrp.value, aiMrp.value)) {
    formData.mrp = {
      value: ocrMrp.value ?? aiMrp.value,
      inclusiveOfAllTaxes: ocrMrp.inclusiveOfAllTaxes ?? aiMrp.inclusiveOfAllTaxes ?? true,
      exemptionDeclared: false,
    };
    const score = Math.min((ocrConfidence['mrp.value'] || 0) + 10, 100);
    recordFieldMeta('mrp', 'ocr+ai', score, ocrMrp.value, aiMrp.value, 'mrp.value');
  } else if (ocrMrp && aiMrp) {
    // Conflict on MRP
    formData.mrp = ocrMrp;
    const score = Math.max(ocrConfidence['mrp.value'] || 0, aiConfidence['mrp'] || 0) - 20;
    recordFieldMeta('mrp', 'manual', score, ocrMrp.value, aiMrp.value, 'mrp.value');
  } else if (ocrMrp) {
    formData.mrp = ocrMrp;
    const score = ocrConfidence['mrp.value'] || 0;
    recordFieldMeta('mrp', 'ocr', score, ocrMrp.value, undefined, 'mrp.value');
  } else if (aiMrp) {
    formData.mrp = {
      value: aiMrp.value,
      inclusiveOfAllTaxes: aiMrp.inclusiveOfAllTaxes ?? null,
      exemptionDeclared: false,
    };
    const score = aiConfidence['mrp'] || 0;
    recordFieldMeta('mrp', 'ai', score, undefined, aiMrp.value);
  }

  // 3. Handle Net Quantity
  const ocrQty = ocrCandidate.netQuantity;
  const aiQty = aiCandidate.netQuantity
    ? { value: aiCandidate.netQuantity, unit: aiCandidate.unit || '' }
    : null;

  if (
    ocrQty &&
    aiQty &&
    numbersAgree(ocrQty.value, aiQty.value) &&
    (!ocrQty.unit || !aiQty.unit || ocrQty.unit.toLowerCase() === aiQty.unit.toLowerCase())
  ) {
    formData.netQuantity = {
      value: ocrQty.value ?? aiQty.value,
      unit: ocrQty.unit || aiQty.unit,
      itemCount: ocrQty.itemCount || null,
      soldByNumber: ocrQty.soldByNumber || false,
    };
    const score = Math.min((ocrConfidence['netQuantity.value'] || 0) + 10, 100);
    recordFieldMeta(
      'netQuantity',
      'ocr+ai',
      score,
      `${ocrQty.value} ${ocrQty.unit}`,
      `${aiQty.value} ${aiQty.unit}`,
      'netQuantity.value'
    );
  } else if (ocrQty && aiQty) {
    // Conflict on Net Quantity
    formData.netQuantity = ocrQty;
    const score = Math.max(ocrConfidence['netQuantity.value'] || 0, aiConfidence['netQuantity'] || 0) - 20;
    recordFieldMeta(
      'netQuantity',
      'manual',
      score,
      `${ocrQty.value} ${ocrQty.unit}`,
      `${aiQty.value} ${aiQty.unit}`,
      'netQuantity.value'
    );
  } else if (ocrQty) {
    formData.netQuantity = ocrQty;
    const score = ocrConfidence['netQuantity.value'] || 0;
    recordFieldMeta('netQuantity', 'ocr', score, `${ocrQty.value} ${ocrQty.unit}`, undefined, 'netQuantity.value');
  } else if (aiQty) {
    formData.netQuantity = {
      value: aiQty.value,
      unit: aiQty.unit,
      itemCount: null,
      soldByNumber: false,
    };
    const score = aiConfidence['netQuantity'] || 0;
    recordFieldMeta('netQuantity', 'ai', score, undefined, `${aiQty.value} ${aiQty.unit}`);
  }

  // 4. Handle nested contact objects (manufacturer, importer, consumerCare, supplementary)
  const contactSections = [
    { key: 'manufacturer', ocrPrefix: 'manufacturer.', aiPrefix: 'manufacturer' },
    { key: 'importer', ocrPrefix: 'importer.', aiPrefix: 'importer' },
    { key: 'consumerCare', ocrPrefix: 'consumerCare.', aiPrefix: 'consumerCare' },
    { key: 'supplementary', ocrPrefix: 'supplementary.', aiPrefix: '' },
  ] as const;

  for (const section of contactSections) {
    const ocrObj = (ocrCandidate[section.key as keyof InspectionFormData] as any) || {};
    const aiObj = (aiMapped[section.key as keyof InspectionFormData] as any) || {};

    const mergedObj: any = {};
    let sectionHasOcr = false;
    let sectionHasAi = false;
    let hasDisagreement = false;

    const subFields = Array.from(new Set([...Object.keys(ocrObj), ...Object.keys(aiObj)]));

    for (const sub of subFields) {
      const ocrSub = ocrObj[sub] || '';
      const aiSub = aiObj[sub] || '';
      const fieldKey = `${section.key}.${sub}`;

      if (stringsAgree(ocrSub, aiSub)) {
        mergedObj[sub] = ocrSub || aiSub;
        sectionHasOcr = sectionHasOcr || Boolean(ocrSub);
        sectionHasAi = sectionHasAi || Boolean(aiSub);
        const score = Math.min((ocrConfidence[fieldKey] || 80) + 10, 100);
        recordFieldMeta(fieldKey, 'ocr+ai', score, ocrSub, aiSub, fieldKey);
      } else if (ocrSub && aiSub) {
        // Disagreement on sub-field
        hasDisagreement = true;
        mergedObj[sub] = ocrSub;
        sectionHasOcr = true;
        sectionHasAi = true;
        const score = 50;
        recordFieldMeta(fieldKey, 'manual', score, ocrSub, aiSub, fieldKey);
      } else if (ocrSub) {
        mergedObj[sub] = ocrSub;
        sectionHasOcr = true;
        const score = ocrConfidence[fieldKey] || 75;
        recordFieldMeta(fieldKey, 'ocr', score, ocrSub, undefined, fieldKey);
      } else if (aiSub) {
        mergedObj[sub] = aiSub;
        sectionHasAi = true;
        const score = 75;
        recordFieldMeta(fieldKey, 'ai', score, undefined, aiSub, fieldKey);
      }
    }

    if (Object.values(mergedObj).some(v => v)) {
      (formData as any)[section.key] = mergedObj;
      const sectionSource: ExtractionSource = hasDisagreement
        ? 'manual'
        : sectionHasOcr && sectionHasAi
        ? 'ocr+ai'
        : sectionHasOcr
        ? 'ocr'
        : 'ai';
      sourceMap[section.key] = sectionSource;
    }
  }

  // 5. Handle Best Before Dates
  const ocrBB = ocrCandidate.bestBefore;
  const aiBB = aiMapped.bestBefore;

  if (ocrBB?.month && aiBB?.month) {
    const agree = datesAgree(ocrBB.month, ocrBB.year, aiBB.month, aiBB.year);
    formData.bestBefore = {
      applicable: true,
      date: ocrBB.date || aiBB.date || '',
      month: ocrBB.month || aiBB.month || '',
      year: ocrBB.year || aiBB.year || '',
    };
    const src: ExtractionSource = agree ? 'ocr+ai' : 'manual';
    const score = agree ? 95 : 55;
    sourceMap['bestBefore'] = src;
    recordFieldMeta('bestBefore.month', src, score, ocrBB.month, aiBB.month, 'bestBefore.month');
    recordFieldMeta('bestBefore.year', src, score, ocrBB.year, aiBB.year, 'bestBefore.year');
  } else if (ocrBB && (ocrBB.month || ocrBB.year)) {
    formData.bestBefore = ocrBB;
    sourceMap['bestBefore'] = 'ocr';
    if (ocrBB.month) recordFieldMeta('bestBefore.month', 'ocr', ocrConfidence['bestBefore.month'] || 80, ocrBB.month, undefined, 'bestBefore.month');
    if (ocrBB.year) recordFieldMeta('bestBefore.year', 'ocr', ocrConfidence['bestBefore.year'] || 80, ocrBB.year, undefined, 'bestBefore.year');
  } else if (aiBB && (aiBB.month || aiBB.year)) {
    formData.bestBefore = aiBB;
    sourceMap['bestBefore'] = 'ai';
    if (aiBB.month) recordFieldMeta('bestBefore.month', 'ai', aiConfidence['bestBeforeMonth'] || 80, undefined, aiBB.month);
    if (aiBB.year) recordFieldMeta('bestBefore.year', 'ai', aiConfidence['bestBeforeYear'] || 80, undefined, aiBB.year);
  }

  return {
    formData,
    confidence,
    sourceMap,
    metadata,
  };
}
