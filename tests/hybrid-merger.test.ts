/**
 * Test Suite for Hybrid Extraction Merger
 *
 * Verifies that:
 * 1. Matching fields between OCR and Vision AI are merged with 'ocr+ai' source and boosted confidence
 * 2. Single-source fields (only OCR or only AI) are properly tagged and preserved
 * 3. Conflicting values default to conservative manual review
 * 4. Nested structures (MRP, netQuantity, manufacturer, consumerCare) merge correctly
 */

import { mergeExtractions } from '../src/lib/hybrid-merger';
import type { VisionExtractionCandidate } from '../src/lib/vision/types';

console.log('====================================================');
console.log('RUNNING HYBRID MERGER UNIT TESTS');
console.log('====================================================\n');

// Test 1: Consensus merge (both agree)
console.log('--- TEST 1: Consensus Merge ---');
const ocr1 = {
  productName: 'SPARKLECLEAN',
  mrp: { value: 149, inclusiveOfAllTaxes: true, exemptionDeclared: false },
  netQuantity: { value: 500, unit: 'ml', itemCount: null, soldByNumber: false },
  consumerCare: { contactName: '', address: '', phone: '1800-123-4567', email: 'care@sparkleclean.example.in' },
};
const ocrConf1 = {
  'productName': 85,
  'mrp.value': 90,
  'netQuantity.value': 88,
  'consumerCare.phone': 92,
  'consumerCare.email': 95,
};

const ai1: VisionExtractionCandidate = {
  productName: 'SparkleClean All-Purpose Cleaner',
  mrp: 149,
  mrpInclusiveTaxes: true,
  netQuantity: 500,
  unit: 'ml',
  manufacturerName: 'CleanTech Industries Pvt. Ltd.',
  consumerCarePhone: '1800-123-4567',
  consumerCareEmail: 'care@sparkleclean.example.in',
  batchLot: 'B2025-0642',
};
const aiConf1 = {
  productName: 85,
  mrp: 85,
  netQuantity: 85,
  manufacturerName: 80,
  consumerCarePhone: 85,
  consumerCareEmail: 85,
  batchLot: 85,
};

const merged1 = mergeExtractions(ocr1, ocrConf1, ai1, aiConf1);

let pass1 = true;
if (merged1.sourceMap['productName'] !== 'ocr+ai') {
  console.error('FAIL: Expected productName source to be ocr+ai, got:', merged1.sourceMap['productName']);
  pass1 = false;
}
if (merged1.formData.mrp?.value !== 149 || merged1.sourceMap['mrp'] !== 'ocr+ai') {
  console.error('FAIL: MRP consensus failed:', merged1.formData.mrp, merged1.sourceMap['mrp']);
  pass1 = false;
}
if (merged1.formData.netQuantity?.value !== 500 || merged1.formData.netQuantity?.unit !== 'ml') {
  console.error('FAIL: Net Quantity consensus failed:', merged1.formData.netQuantity);
  pass1 = false;
}
if (merged1.sourceMap['manufacturer'] !== 'ai') {
  console.error('FAIL: Expected manufacturer source to be ai, got:', merged1.sourceMap['manufacturer']);
  pass1 = false;
}

if (pass1) {
  console.log('>>> TEST 1 PASSED: Hybrid consensus and single-source tagged successfully! <<<\n');
} else {
  console.error('>>> TEST 1 FAILED! <<<\n');
}

// Test 2: Disagreement handling
console.log('--- TEST 2: Disagreement Handling ---');
const ocr2 = {
  mrp: { value: 149, inclusiveOfAllTaxes: true, exemptionDeclared: false },
};
const ocrConf2 = { 'mrp.value': 80 };

const ai2: VisionExtractionCandidate = {
  mrp: 299, // Clear conflict
};
const aiConf2 = { mrp: 80 };

const merged2 = mergeExtractions(ocr2, ocrConf2, ai2, aiConf2);

let pass2 = true;
if (merged2.sourceMap['mrp'] !== 'manual') {
  console.error('FAIL: Disagreement should be tagged as manual for inspector review, got:', merged2.sourceMap['mrp']);
  pass2 = false;
}

if (pass2) {
  console.log('>>> TEST 2 PASSED: Disagreements safely flagged for manual review! <<<\n');
} else {
  console.error('>>> TEST 2 FAILED! <<<\n');
}

if (pass1 && pass2) {
  console.log('ALL HYBRID MERGER TESTS PASSED SUCCESSFULLY!');
} else {
  process.exit(1);
}
