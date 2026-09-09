/**
 * Phase 2 Test: Disagreement & Review Gating
 *
 * Verifies that conflicting extractions (different values for same field)
 * are correctly identified, flagged as 'manual' (Needs Review),
 * and do not automatically pass as confident consensus.
 */

import { mergeExtractions } from '../src/lib/hybrid-merger';
import { VisionExtractionCandidate } from '../src/lib/vision/types';

console.log('--- PHASE 2: Disagreement Handling ---');

// Disagreement Test: Different MRP
const ocrCandidate = {
  mrp: { value: 149, inclusiveOfAllTaxes: true, exemptionDeclared: false },
};
const ocrConf = { 'mrp.value': 90 };

const aiCandidate: VisionExtractionCandidate = {
  mrp: 199, // Conflicting value
};
const aiConf = { mrp: 95 };

const result = mergeExtractions(ocrCandidate, ocrConf, aiCandidate, aiConf);

if (result.sourceMap['mrp'] === 'manual') {
  console.log('✅ PASS: Disagreement flagged as manual review');
  console.log('   Confidence tier for MRP (manual):', result.metadata['mrp']?.qualitativeConfidence);
} else {
  console.error('❌ FAIL: Disagreement NOT flagged as manual. Source map is:', result.sourceMap['mrp']);
  process.exit(1);
}
