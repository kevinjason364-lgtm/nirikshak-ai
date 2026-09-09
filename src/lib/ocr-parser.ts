/**
 * Enhanced OCR Parser for Legal Metrology Packaged Commodities Labels
 *
 * Key improvements:
 * 1. Product Name extraction uses strict contextual heuristics & quality gates
 * 2. Every field has a validation check before being populated
 * 3. Rejects OCR garbage (e.g. "0 = Us,", punctuation, barcode-like noise)
 * 4. Tolerant of common OCR misreadings for mandatory LMPC declarations
 * 5. Multi-image contextual parsing
 */

import type { InspectionFormData } from '@/types';

export interface OCRField {
  value: string | number | boolean | null;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-100
  source: string; // What text was matched
  sourceLine?: string; // The line it came from
  sourceSide?: 'front' | 'back' | 'side-other' | 'unknown';
}

export interface ParsedOcrResult {
  formData: Partial<InspectionFormData>;
  confidence: Record<string, number>; // Field-level confidence 0-100
  fieldDetails: Record<string, OCRField>; // Diagnostic info
  rawText: string;
  textLength: number;
  quality: {
    textDetected: boolean;
    usefulFieldsFound: number;
    averageConfidence: number;
  };
}

interface ExtractionCandidate {
  value: string | number;
  confidence: number;
  source: string;
  sourceSide?: 'front' | 'back' | 'side-other' | 'unknown';
}

// Validation functions to prevent garbage data
const validators = {
  productName: (candidate: string): boolean => {
    if (!candidate || typeof candidate !== 'string') return false;
    const clean = candidate.trim();
    // Reject if too short
    if (clean.length < 4) return false;

    // Count alpha letters vs total non-space characters
    const nonSpace = clean.replace(/\s/g, '');
    const alphaChars = clean.replace(/[^a-zA-Z]/g, '');
    if (alphaChars.length < 3) return false;

    // Must be at least 60% alphabetic letters
    const alphaRatio = alphaChars.length / nonSpace.length;
    if (alphaRatio < 0.6) return false;

    // Reject if starts with noise symbols or digits
    if (/^[0-9=_\-+*#@!~`%^&()[\]{}|\\:;"'<>,.?/]/.test(clean)) return false;

    // Reject if contains noisy symbols like '=', '~', '^', '|', '$'
    if (/[=~^|$_{}\\]/.test(clean)) return false;

    // Reject if looks like an address or company entity
    if (/\b(?:plot|phase|industrial|area|road|street|pvt|ltd|floor|block|lane|nagar|dist|district|state|pin|sector|estate|bldg|building|complex|haryana|delhi|mumbai|bangalore|pune|gujarat|india)\b/i.test(clean)) {
      return false;
    }

    // Reject if matches known metadata anchor headers
    if (/\b(?:mrp|m\.r\.p|mfd|mfg|exp|batch|pkd|packed|net\s*qty|net\s*wt|fssai|barcode|toll\s*free|consumer\s*care|customer\s*care|phone|email|website|ingredients|nutrition)\b/i.test(clean)) {
      return false;
    }

    // Reject if it's just numbers and punctuation
    if (/^[0-9\s=.,-]+$/.test(clean)) return false;

    // Reject if composed only of very short word fragments (e.g., "st oo", "a b")
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every(w => w.length < 3)) return false;
    if (words.length === 1 && words[0].length < 3) return false;

    return true;
  },

  brand: (candidate: string): boolean => {
    if (!candidate || candidate.length < 2) return false;
    const clean = candidate.trim();
    if (/[=~^|$_{}\\]/.test(clean)) return false;
    if (/^[0-9=_\-+*#@!~`%^&()[\]{}|\\:;"'<>,.?/]/.test(clean)) return false;
    if (/^[0-9\s=.,-]+$/.test(clean)) return false;
    const nonSpaceLength = clean.replace(/\s/g, '').length;
    if (nonSpaceLength === 0) return false;
    const alpha = candidate.replace(/[^a-zA-Z]/g, '');
    if (alpha.length < 2 || (alpha.length / nonSpaceLength <= 0.5)) return false;

    // Reject if all words are tiny fragments
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every(w => w.length < 3)) return false;

    return true;
  },

  genericName: (candidate: string): boolean => {
    if (!candidate || candidate.length < 3) return false;
    return /[a-zA-Z]{3,}/.test(candidate);
  },

  manufacturerName: (candidate: string): boolean => {
    if (!candidate || candidate.length < 3) return false;
    const alpha = candidate.replace(/[^a-zA-Z]/g, '');
    return alpha.length >= 3;
  },

  mrp: (value: number): boolean => {
    return typeof value === 'number' && value > 0 && value < 1000000 && Number.isFinite(value);
  },

  quantity: (value: number): boolean => {
    return typeof value === 'number' && value > 0 && value < 1000000 && Number.isFinite(value);
  },

  phone: (candidate: string): boolean => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 13;
  },

  email: (candidate: string): boolean => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(candidate);
  },

  barcode: (candidate: string): boolean => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length === 12 || digits.length === 13;
  },

  fssai: (candidate: string): boolean => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length === 14;
  },
};

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function findSourceSide(text: string, matchIndex: number): 'front' | 'back' | 'side-other' | 'unknown' {
  if (matchIndex < 0) return 'unknown';
  const frontIdx = text.lastIndexOf('=== FRONT ===', matchIndex);
  const backIdx = text.lastIndexOf('=== BACK ===', matchIndex);
  const sideIdx = text.lastIndexOf('=== SIDE', matchIndex);

  const maxIdx = Math.max(frontIdx, backIdx, sideIdx);
  if (maxIdx === -1) return 'unknown';
  if (maxIdx === frontIdx) return 'front';
  if (maxIdx === backIdx) return 'back';
  if (maxIdx === sideIdx) return 'side-other';
  return 'unknown';
}

/**
 * Extract product name with contextual heuristics
 */
function extractProductName(rawText: string, tesseractConfidence: number): ExtractionCandidate | null {
  const lines = rawText.split('\n').map(l => l.trim());
  let currentSide: 'front' | 'back' | 'side-other' | 'unknown' = 'unknown';

  // 1. First look for explicit anchors like "Product Name:", "Commodity:", "Item:"
  const explicitAnchors = [
    /(?:product\s*name|commodity|product|item\s*name)\s*[:.-]?\s*([^\n]+)/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('=== FRONT ===')) { currentSide = 'front'; continue; }
    if (line.includes('=== BACK ===')) { currentSide = 'back'; continue; }
    if (line.includes('=== SIDE')) { currentSide = 'side-other'; continue; }

    for (const anchor of explicitAnchors) {
      const match = line.match(anchor);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (validators.productName(candidate)) {
          return {
            value: candidate,
            confidence: Math.round(Math.min(90, tesseractConfidence * 0.95)),
            source: `Explicit anchor: "${line}"`,
            sourceSide: currentSide
          };
        }
      }
    }
  }

  // 2. Look for the prominent title line near top of Front label
  // Find lines in the front section before other metadata declarations
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('=== FRONT ===')) { currentSide = 'front'; continue; }
    if (line.includes('=== BACK ===')) { currentSide = 'back'; continue; }
    if (line.includes('=== SIDE')) { currentSide = 'side-other'; continue; }

    // Only search in Front or Unknown
    if (currentSide !== 'front' && currentSide !== 'unknown') continue;

    if (validators.productName(line)) {
      return {
        value: line,
        confidence: Math.round(Math.min(80, tesseractConfidence * 0.85)),
        source: `Prominent title line: "${line}"`,
        sourceSide: currentSide
      };
    }
  }

  return null;
}

/**
 * Extract MRP with contextual anchors
 */
function extractMRP(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const mrpRegex = /(?:M\.?R\.?P\.?|MRP|PRICE|MAXIMUM\s*RETAIL\s*PRICE)\s*[:.\-]?\s*(?:RS\.?|INR|₹)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i;

  const match = text.match(mrpRegex);
  if (match && match[1] && match.index !== undefined) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (validators.mrp(val)) {
      const confidence = Math.round(Math.min(90, tesseractConfidence * 0.95));
      const sourceSide = findSourceSide(text, match.index);
      return { value: val, confidence, source: match[0], sourceSide };
    }
  }

  return null;
}

/**
 * Extract tax inclusion declaration
 */
function extractTaxInclusion(text: string): ExtractionCandidate | null {
  const match = text.match(/(?:INCL(?:USIVE)?\.?\s*OF\s*(?:ALL\s*)?TAXES|INCL(?:USIVE)?\.?\s*TAXES|TAXES?\s*INCLUDED|\(INCL\.\s*OF\s*ALL\s*TAXES\))/i);
  if (match && match.index !== undefined) {
    const sourceSide = findSourceSide(text, match.index);
    return { value: true as any, confidence: 95, source: match[0], sourceSide };
  }
  return null;
}

/**
 * Extract net quantity with unit
 */
function extractNetQuantity(
  text: string,
  tesseractConfidence: number
): { qty: ExtractionCandidate | null; unit: ExtractionCandidate | null } {
  const qtyRegex = /(?:NET\s*(?:QTY|QUANTITY|WT|WEIGHT|CONTENT|CONTENTS)?\s*[:.\-]?\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(g|gm|gms|grams|kg|kgs|kilograms|ml|millilitres|l|ltr|ltrs|litres|litre|pcs|pieces|units|nos|n(?:\s+[a-z\s]{1,10})?|tea\s*bags|bags|sachets|packs)\b/i;

  const match = text.match(qtyRegex);
  if (match && match[1] && match[2] && match.index !== undefined) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (validators.quantity(val)) {
      let unit = match[2].toLowerCase();
      // Normalize unit
      if (['gm', 'gms', 'grams'].includes(unit)) unit = 'g';
      if (['kgs', 'kilograms'].includes(unit)) unit = 'kg';
      if (['millilitres'].includes(unit)) unit = 'ml';
      if (['ltr', 'ltrs', 'litres', 'litre'].includes(unit)) unit = 'L';

      const confidence = Math.round(Math.min(85, tesseractConfidence * 0.9));
      const sourceSide = findSourceSide(text, match.index);
      return {
        qty: { value: val, confidence, source: match[0], sourceSide },
        unit: { value: unit, confidence, source: `Unit: ${unit}`, sourceSide },
      };
    }
  }

  return { qty: null, unit: null };
}

/**
 * Extract manufacturer/packer info
 */
function extractManufacturer(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const mfgRegex = /(?:MANUFACTURED|MFD|PACKED|PACKER|MARKETED)\s*(?:BY|&?\s*MARKETED\s*BY)?\s*[:.\-]?\s*([^\n]+(?:\n[^\n]+){0,2})/i;
  const match = text.match(mfgRegex);

  if (match && match[1] && match.index !== undefined) {
    const lines = match[1].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && validators.manufacturerName(lines[0])) {
      const confidence = Math.round(Math.min(80, tesseractConfidence * 0.85));
      const sourceSide = findSourceSide(text, match.index);
      return { value: lines[0], confidence, source: lines[0], sourceSide };
    }
  }

  return null;
}

/**
 * Extract importer info
 */
function extractImporter(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const impRegex = /(?:IMPORTED|IMPORTER)\s*(?:BY)?\s*[:.\-]?\s*([^\n]+(?:\n[^\n]+){0,2})/i;
  const match = text.match(impRegex);

  if (match && match[1] && match.index !== undefined) {
    const lines = match[1].split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && validators.manufacturerName(lines[0])) {
      const confidence = Math.round(Math.min(80, tesseractConfidence * 0.85));
      const sourceSide = findSourceSide(text, match.index);
      return { value: lines[0], confidence, source: lines[0], sourceSide };
    }
  }

  return null;
}

/**
 * Extract Country of Origin
 */
function extractCountryOfOrigin(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const originRegex = /(?:COUNTRY\s*OF\s*ORIGIN|MADE\s*IN|PRODUCED\s*IN)\s*[:.\-]?\s*([A-Za-z\s]+)/i;
  const match = text.match(originRegex);

  if (match && match[1] && match.index !== undefined) {
    const country = match[1].trim().split('\n')[0];
    if (country.length > 2 && /^[a-zA-Z\s]+$/.test(country)) {
      const confidence = Math.round(Math.min(85, tesseractConfidence * 0.9));
      const sourceSide = findSourceSide(text, match.index);
      return { value: country, confidence, source: match[0], sourceSide };
    }
  }

  return null;
}

/**
 * Extract Manufacture & Best Before Dates
 */
function extractDates(text: string, tesseractConfidence: number): {
  mfgMonth?: string;
  mfgYear?: string;
  expMonth?: string;
  expYear?: string;
  sourceSide?: 'front' | 'back' | 'side-other' | 'unknown';
} {
  const dates: { mfgMonth?: string; mfgYear?: string; expMonth?: string; expYear?: string; sourceSide?: 'front' | 'back' | 'side-other' | 'unknown' } = {};

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // Manufacture Date
  const mfgRegex = /(?:MFG|MFD|MANUFACTURED|PACKED|PKD)\.?\s*(?:DATE)?\s*[:.\-]?\s*(?:([0-9]{1,2})[\/\.-])?([0-9]{1,2}|[A-Za-z]{3,9})[\/\.-]([0-9]{2,4})/i;
  const mfgMatch = text.match(mfgRegex);
  if (mfgMatch && mfgMatch.index !== undefined) {
    let month = mfgMatch[2];
    const mIdx = monthNames.findIndex(m => month.toLowerCase().startsWith(m));
    if (mIdx !== -1) {
      month = String(mIdx + 1).padStart(2, '0');
    } else if (month.length === 1) {
      month = month.padStart(2, '0');
    }

    let year = mfgMatch[3];
    if (year.length === 2) year = '20' + year;

    dates.mfgMonth = month;
    dates.mfgYear = year;
    dates.sourceSide = findSourceSide(text, mfgMatch.index);
  }

  // Best Before / Expiry
  const expRegex = /(?:EXP(?:IRY)?|USE\s*BY|BEST\s*BEFORE)\.?\s*(?:DATE)?\s*[:.\-]?\s*(?:([0-9]{1,2})[\/\.-])?([0-9]{1,2}|[A-Za-z]{3,9})[\/\.-]([0-9]{2,4})/i;
  const expMatch = text.match(expRegex);
  if (expMatch && expMatch.index !== undefined) {
    let month = expMatch[2];
    const mIdx = monthNames.findIndex(m => month.toLowerCase().startsWith(m));
    if (mIdx !== -1) {
      month = String(mIdx + 1).padStart(2, '0');
    } else if (month.length === 1) {
      month = month.padStart(2, '0');
    }

    let year = expMatch[3];
    if (year.length === 2) year = '20' + year;

    dates.expMonth = month;
    dates.expYear = year;
    if (!dates.sourceSide) {
      dates.sourceSide = findSourceSide(text, expMatch.index);
    }
  }

  return dates;
}

/**
 * Extract phone with validation
 */
function extractPhone(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const phoneRegex = /(?:TOLL\s*FREE|HELPLINE|CALL|TEL|PHONE|CARE|CONTACT|CUSTOMER\s*CARE|CONSUMER\s*CARE|PH\.?)\.?\s*[:.\-]?\s*([0-9\-\s\(\)]{8,18})/i;
  const match = text.match(phoneRegex);

  if (match && match[1] && match.index !== undefined && validators.phone(match[1])) {
    const confidence = Math.round(Math.min(85, tesseractConfidence * 0.9));
    const sourceSide = findSourceSide(text, match.index);
    return { value: match[1].trim(), confidence, source: match[0], sourceSide };
  }

  return null;
}

/**
 * Extract email with validation
 */
function extractEmail(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const match = text.match(emailRegex);

  if (match && match[1] && match.index !== undefined && validators.email(match[1])) {
    const confidence = Math.round(Math.min(95, tesseractConfidence * 0.98));
    const sourceSide = findSourceSide(text, match.index);
    return { value: match[1], confidence, source: match[1], sourceSide };
  }

  return null;
}

/**
 * Extract batch / lot
 */
function extractBatchLot(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const batchRegex = /(?:BATCH|LOT)\.?\s*(?:NO\.?|NUMBER)?\s*[:.\-]?\s*([A-Za-z0-9\/-]+)/i;
  const match = text.match(batchRegex);

  if (match && match[1] && match[1].length >= 3 && match.index !== undefined) {
    const confidence = Math.round(Math.min(85, tesseractConfidence * 0.9));
    const sourceSide = findSourceSide(text, match.index);
    return { value: match[1].trim(), confidence, source: match[0], sourceSide };
  }

  return null;
}

/**
 * Extract barcode with validation
 */
function extractBarcode(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const barcodeRegex = /\b([0-9]{12,13})\b/;
  const match = text.match(barcodeRegex);

  if (match && match[1] && match.index !== undefined && validators.barcode(match[1])) {
    const confidence = Math.round(Math.min(80, tesseractConfidence * 0.9));
    const sourceSide = findSourceSide(text, match.index);
    return { value: match[1], confidence, source: match[1], sourceSide };
  }

  return null;
}

/**
 * Extract FSSAI License with validation
 */
function extractFSSAI(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const fssaiRegex = /(?:FSSAI|LICENSE|LIC\.?|LIC\.?\s*NO\.?|FSSAI\s*LIC\.?\s*NO\.?)\s*[:.\-]?\s*([0-9]{14})/i;
  const match = text.match(fssaiRegex);

  if (match && match[1] && match.index !== undefined && validators.fssai(match[1])) {
    const confidence = Math.round(Math.min(95, tesseractConfidence * 0.98));
    const sourceSide = findSourceSide(text, match.index);
    return { value: match[1], confidence, source: match[1], sourceSide };
  }

  return null;
}

/**
 * Extract Brand Name
 */
function extractBrand(text: string, tesseractConfidence: number): ExtractionCandidate | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Look for prominent brand lines (shorter, fully uppercase or title case) near the top
  const frontIndex = lines.findIndex(l => l.includes('=== FRONT ==='));
  let searchLines = lines;

  if (frontIndex !== -1) {
    // Only search in Front section for brand if available
    const endIndex = lines.findIndex((l, i) => i > frontIndex && l.startsWith('==='));
    searchLines = lines.slice(frontIndex + 1, endIndex !== -1 ? endIndex : undefined);
  }

  for (const line of searchLines) {
    // Brand is often 1-3 words, mostly alphabetic, and distinct
    if (line.length >= 3 && line.length <= 25 && validators.brand(line)) {
      // Must not match standard anchors
      if (!/\b(?:product|price|mrp|weight|qty|net|mfg|exp|batch)\b/i.test(line)) {
        const confidence = Math.round(Math.min(75, tesseractConfidence * 0.8));
        const idx = text.indexOf(line);
        const sourceSide = idx >= 0 ? findSourceSide(text, idx) : (frontIndex !== -1 ? 'front' : 'unknown');
        return { value: line, confidence, source: `Brand candidate: "${line}"`, sourceSide };
      }
    }
  }

  return null;
}

/**
 * Main parsing function
 */
export function parseOcrText(rawText: string, tesseractConfidence: number = 75): ParsedOcrResult {
  const text = rawText.replace(/\r/g, '\n');
  const formData: Partial<InspectionFormData> = {};
  const confidence: Record<string, number> = {};
  const fieldDetails: Record<string, OCRField> = {};

  let usefulFieldsFound = 0;
  let totalConfidenceSum = 0;
  let fieldsExtracted = 0;

  console.group('[OCR Parser] Parsing results');
  console.log('[OCR Parser] Text length:', text.length, 'chars');
  console.log('[OCR Parser] Tesseract confidence:', tesseractConfidence);

  // 1. Product Name (Quality Gate)
  const productNameCandidate = extractProductName(text, tesseractConfidence);
  if (productNameCandidate && validators.productName(productNameCandidate.value as string)) {
    formData.productName = productNameCandidate.value as string;
    confidence['productName'] = productNameCandidate.confidence;
    fieldDetails['productName'] = {
      value: productNameCandidate.value,
      confidence: getConfidenceLevel(productNameCandidate.confidence),
      confidenceScore: productNameCandidate.confidence,
      source: productNameCandidate.source,
      sourceSide: productNameCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += productNameCandidate.confidence;
    console.log('[OCR Parser] ✓ Product Name:', formData.productName);
  } else {
    console.log('[OCR Parser] ✗ Product Name: No confident match (rejected noise/unmatched)');
  }

  // 1.5 Brand
  const brandCandidate = extractBrand(text, tesseractConfidence);
  if (brandCandidate && validators.brand(brandCandidate.value as string)) {
    formData.brand = brandCandidate.value as string;
    confidence['brand'] = brandCandidate.confidence;
    fieldDetails['brand'] = {
      value: brandCandidate.value,
      confidence: getConfidenceLevel(brandCandidate.confidence),
      confidenceScore: brandCandidate.confidence,
      source: brandCandidate.source,
      sourceSide: brandCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += brandCandidate.confidence;
    console.log('[OCR Parser] ✓ Brand:', formData.brand);
  } else {
    console.log('[OCR Parser] ✗ Brand: No confident match');
  }

  // 2. MRP
  const mrpCandidate = extractMRP(text, tesseractConfidence);
  if (mrpCandidate && validators.mrp(mrpCandidate.value as number)) {
    formData.mrp = { value: mrpCandidate.value as number, inclusiveOfAllTaxes: null, exemptionDeclared: false };
    confidence['mrp.value'] = mrpCandidate.confidence;
    fieldDetails['mrp.value'] = {
      value: mrpCandidate.value,
      confidence: getConfidenceLevel(mrpCandidate.confidence),
      confidenceScore: mrpCandidate.confidence,
      source: mrpCandidate.source,
      sourceSide: mrpCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += mrpCandidate.confidence;
    console.log('[OCR Parser] ✓ MRP:', formData.mrp.value);
  }

  // 3. Tax Inclusion
  const taxCandidate = extractTaxInclusion(text);
  if (taxCandidate) {
    if (!formData.mrp) formData.mrp = { value: null, inclusiveOfAllTaxes: null, exemptionDeclared: false };
    formData.mrp.inclusiveOfAllTaxes = taxCandidate.value as boolean;
    confidence['mrp.inclusiveOfAllTaxes'] = taxCandidate.confidence;
    fieldDetails['mrp.inclusiveOfAllTaxes'] = {
      value: taxCandidate.value,
      confidence: getConfidenceLevel(taxCandidate.confidence),
      confidenceScore: taxCandidate.confidence,
      source: taxCandidate.source,
      sourceSide: taxCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += taxCandidate.confidence;
    console.log('[OCR Parser] ✓ Tax inclusive detected');
  }

  // 4. Net Quantity
  const qtyResult = extractNetQuantity(text, tesseractConfidence);
  if (qtyResult.qty && qtyResult.unit) {
    formData.netQuantity = {
      value: qtyResult.qty.value as number,
      unit: qtyResult.unit.value as string,
      itemCount: null,
      soldByNumber: false,
    };
    confidence['netQuantity.value'] = qtyResult.qty.confidence;
    confidence['netQuantity.unit'] = qtyResult.unit.confidence;
    fieldDetails['netQuantity.value'] = {
      value: qtyResult.qty.value,
      confidence: getConfidenceLevel(qtyResult.qty.confidence),
      confidenceScore: qtyResult.qty.confidence,
      source: qtyResult.qty.source,
      sourceSide: qtyResult.qty.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted += 2;
    totalConfidenceSum += qtyResult.qty.confidence + qtyResult.unit.confidence;
    console.log('[OCR Parser] ✓ Net Quantity:', formData.netQuantity.value, formData.netQuantity.unit);
  }

  // 5. Manufacturer
  const mfgCandidate = extractManufacturer(text, tesseractConfidence);
  if (mfgCandidate && validators.manufacturerName(mfgCandidate.value as string)) {
    formData.manufacturer = { name: mfgCandidate.value as string, address: '' };
    confidence['manufacturer.name'] = mfgCandidate.confidence;
    fieldDetails['manufacturer.name'] = {
      value: mfgCandidate.value,
      confidence: getConfidenceLevel(mfgCandidate.confidence),
      confidenceScore: mfgCandidate.confidence,
      source: mfgCandidate.source,
      sourceSide: mfgCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += mfgCandidate.confidence;
    console.log('[OCR Parser] ✓ Manufacturer:', formData.manufacturer.name);
  }

  // 6. Importer & Country of Origin
  const impCandidate = extractImporter(text, tesseractConfidence);
  if (impCandidate) {
    formData.importer = { name: impCandidate.value as string, address: '' };
    confidence['importer.name'] = impCandidate.confidence;
    fieldDetails['importer.name'] = {
      value: impCandidate.value,
      confidence: getConfidenceLevel(impCandidate.confidence),
      confidenceScore: impCandidate.confidence,
      source: impCandidate.source,
      sourceSide: impCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += impCandidate.confidence;
  }

  const originCandidate = extractCountryOfOrigin(text, tesseractConfidence);
  if (originCandidate) {
    formData.countryOfOrigin = originCandidate.value as string;
    confidence['countryOfOrigin'] = originCandidate.confidence;
    fieldDetails['countryOfOrigin'] = {
      value: originCandidate.value,
      confidence: getConfidenceLevel(originCandidate.confidence),
      confidenceScore: originCandidate.confidence,
      source: originCandidate.source,
      sourceSide: originCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += originCandidate.confidence;
  }

  // 7. Dates (Manufacture & Expiry)
  const dates = extractDates(text, tesseractConfidence);
  if (dates.mfgMonth && dates.mfgYear) {
    formData.manufactureMonth = dates.mfgMonth;
    formData.manufactureYear = dates.mfgYear;
    confidence['manufactureMonth'] = 80;
    confidence['manufactureYear'] = 80;
    fieldDetails['manufactureMonth'] = {
      value: dates.mfgMonth,
      confidence: 'high',
      confidenceScore: 80,
      source: `Month: ${dates.mfgMonth}`,
      sourceSide: dates.sourceSide || 'unknown',
    };
    fieldDetails['manufactureYear'] = {
      value: dates.mfgYear,
      confidence: 'high',
      confidenceScore: 80,
      source: `Year: ${dates.mfgYear}`,
      sourceSide: dates.sourceSide || 'unknown',
    };
    usefulFieldsFound += 2;
    fieldsExtracted += 2;
    totalConfidenceSum += 160;
  }

  if (dates.expMonth && dates.expYear) {
    formData.bestBefore = {
      applicable: true,
      date: '',
      month: dates.expMonth,
      year: dates.expYear,
    };
    confidence['bestBefore.month'] = 80;
    confidence['bestBefore.year'] = 80;
    fieldDetails['bestBefore.month'] = {
      value: dates.expMonth,
      confidence: 'high',
      confidenceScore: 80,
      source: `Month: ${dates.expMonth}`,
      sourceSide: dates.sourceSide || 'unknown',
    };
    fieldDetails['bestBefore.year'] = {
      value: dates.expYear,
      confidence: 'high',
      confidenceScore: 80,
      source: `Year: ${dates.expYear}`,
      sourceSide: dates.sourceSide || 'unknown',
    };
    usefulFieldsFound += 2;
    fieldsExtracted += 2;
    totalConfidenceSum += 160;
  }

  // 8. Phone
  const phoneCandidate = extractPhone(text, tesseractConfidence);
  if (phoneCandidate) {
    if (!formData.consumerCare) formData.consumerCare = { contactName: '', address: '', phone: '', email: '' };
    formData.consumerCare.phone = phoneCandidate.value as string;
    confidence['consumerCare.phone'] = phoneCandidate.confidence;
    fieldDetails['consumerCare.phone'] = {
      value: phoneCandidate.value,
      confidence: getConfidenceLevel(phoneCandidate.confidence),
      confidenceScore: phoneCandidate.confidence,
      source: phoneCandidate.source,
      sourceSide: phoneCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += phoneCandidate.confidence;
    console.log('[OCR Parser] ✓ Phone:', formData.consumerCare.phone);
  }

  // 9. Email
  const emailCandidate = extractEmail(text, tesseractConfidence);
  if (emailCandidate) {
    if (!formData.consumerCare) formData.consumerCare = { contactName: '', address: '', phone: '', email: '' };
    formData.consumerCare.email = emailCandidate.value as string;
    confidence['consumerCare.email'] = emailCandidate.confidence;
    fieldDetails['consumerCare.email'] = {
      value: emailCandidate.value,
      confidence: getConfidenceLevel(emailCandidate.confidence),
      confidenceScore: emailCandidate.confidence,
      source: emailCandidate.source,
      sourceSide: emailCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += emailCandidate.confidence;
    console.log('[OCR Parser] ✓ Email:', formData.consumerCare.email);
  }

  // 10. Batch / Lot
  const batchCandidate = extractBatchLot(text, tesseractConfidence);
  if (batchCandidate) {
    if (!formData.supplementary) formData.supplementary = { batchLot: '', barcode: '', fssaiLicence: '', inspectorNotes: '' };
    formData.supplementary.batchLot = batchCandidate.value as string;
    confidence['supplementary.batchLot'] = batchCandidate.confidence;
    fieldDetails['supplementary.batchLot'] = {
      value: batchCandidate.value,
      confidence: getConfidenceLevel(batchCandidate.confidence),
      confidenceScore: batchCandidate.confidence,
      source: batchCandidate.source,
      sourceSide: batchCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += batchCandidate.confidence;
  }

  // 11. Barcode
  const barcodeCandidate = extractBarcode(text, tesseractConfidence);
  if (barcodeCandidate) {
    if (!formData.supplementary) formData.supplementary = { batchLot: '', barcode: '', fssaiLicence: '', inspectorNotes: '' };
    formData.supplementary.barcode = barcodeCandidate.value as string;
    confidence['supplementary.barcode'] = barcodeCandidate.confidence;
    fieldDetails['supplementary.barcode'] = {
      value: barcodeCandidate.value,
      confidence: getConfidenceLevel(barcodeCandidate.confidence),
      confidenceScore: barcodeCandidate.confidence,
      source: barcodeCandidate.source,
      sourceSide: barcodeCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += barcodeCandidate.confidence;
    console.log('[OCR Parser] ✓ Barcode:', formData.supplementary.barcode);
  }

  // 12. FSSAI
  const fssaiCandidate = extractFSSAI(text, tesseractConfidence);
  if (fssaiCandidate) {
    if (!formData.supplementary) formData.supplementary = { batchLot: '', barcode: '', fssaiLicence: '', inspectorNotes: '' };
    formData.supplementary.fssaiLicence = fssaiCandidate.value as string;
    confidence['supplementary.fssaiLicence'] = fssaiCandidate.confidence;
    fieldDetails['supplementary.fssaiLicence'] = {
      value: fssaiCandidate.value,
      confidence: getConfidenceLevel(fssaiCandidate.confidence),
      confidenceScore: fssaiCandidate.confidence,
      source: fssaiCandidate.source,
      sourceSide: fssaiCandidate.sourceSide || 'unknown',
    };
    usefulFieldsFound++;
    fieldsExtracted++;
    totalConfidenceSum += fssaiCandidate.confidence;
    console.log('[OCR Parser] ✓ FSSAI:', formData.supplementary.fssaiLicence);
  }

  const averageConfidence = fieldsExtracted > 0 ? totalConfidenceSum / fieldsExtracted : 0;

  console.log('[OCR Parser] Summary: Found', usefulFieldsFound, 'useful fields');
  console.log('[OCR Parser] Average confidence:', averageConfidence.toFixed(1));
  console.groupEnd();

  return {
    formData,
    confidence,
    fieldDetails,
    rawText: text,
    textLength: text.length,
    quality: {
      textDetected: text.length > 30,
      usefulFieldsFound,
      averageConfidence: Math.round(averageConfidence),
    },
  };
}
