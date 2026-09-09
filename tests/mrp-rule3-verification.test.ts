/**
 * Verification Test: MRP Count Rejection and Rule 3 Applicability Assessment
 *
 * Verifies:
 * 1. Counts like "25 N Tea Bags" or "25 N" are not misclassified as MRP values.
 * 2. Real MRP values with "M.R.P. Rs. 149.00" or "MRP ₹ 250" are accurately extracted.
 * 3. deriveApplicability calculates normalized weights and extracts retail/industrial flags.
 * 4. checkApplicability deterministically returns APPLICABLE, NOT_APPLICABLE, or NEEDS_REVIEW.
 */

import { parseOcrText } from '../src/lib/ocr-parser';
import { deriveApplicability, checkApplicability } from '../src/lib/rule-engine';
import type { InspectionFormData } from '../src/types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('RUNNING MRP FIX & RULE 3 APPLICABILITY TEST SUITE');
console.log('================================================================\n');

// 1. MRP Rejection of Counts
console.log('--- TEST 1: MRP vs. Count Disambiguation ---');

const countLabel1 = `
Flipkart Supermart Green Tea Lemon
NET QUANTITY: 25 N Tea Bags
NET CONTENTS: 25 N Tea Bags X 1.3 g Each
Ingredients: Green Tea
`;
const parsedCount1 = parseOcrText(countLabel1, 85);
assert(parsedCount1.formData.mrp === undefined || parsedCount1.formData.mrp?.value === undefined, 'Does NOT extract MRP from "25 N Tea Bags"');
assert(parsedCount1.formData.netQuantity?.value === 25, 'Correctly extracts netQuantity count as 25');

const mrpWithCountLabel = `
Brand: Premium Tea
NET QUANTITY: 25 N Tea Bags
M.R.P. Rs. 120.00 (INCL. OF ALL TAXES)
`;
const parsedMrpWithCount = parseOcrText(mrpWithCountLabel, 85);
assert(parsedMrpWithCount.formData.mrp?.value === 120, 'Correctly extracts MRP 120 despite presence of "25 N Tea Bags"');
assert(parsedMrpWithCount.formData.netQuantity?.value === 25, 'Correctly extracts netQuantity 25 alongside MRP 120');

// 2. Rule 3 Applicability Derivation
console.log('\n--- TEST 2: Rule 3 Applicability Derivation ---');

const retailForm: Partial<InspectionFormData> = {
  productName: 'SparkleClean Surface Cleaner',
  netQuantity: { value: 500, unit: 'ml', itemCount: null, soldByNumber: false },
};
const appRetail = deriveApplicability(retailForm);
assert(appRetail.isRetailPackage === true, 'Identifies retail package by default');
assert(appRetail.soldDirectlyToConsumer === true, 'Identifies consumer sale');
assert(appRetail.quantityLitre === 0.5, 'Normalizes 500 ml to 0.5 Litres');

const industrialForm: Partial<InspectionFormData> = {
  productName: 'Heavy Lubricant Oil',
  netQuantity: { value: 50, unit: 'l', itemCount: null, soldByNumber: false },
};
const appIndustrial = deriveApplicability(industrialForm, 'For Industrial Consumer Use Only. Not for retail sale.');
assert(appIndustrial.isIndustrialConsumerPackage === true, 'Extracts Industrial Consumer declaration from text');
assert(appIndustrial.isRetailPackage === false, 'Tags as non-retail package');
assert(appIndustrial.quantityLitre === 50, 'Normalizes 50 L to 50 Litres');

// 3. Rule 3 checkApplicability 3-State Evaluation
console.log('\n--- TEST 3: Rule 3 checkApplicability Verification ---');

const fullRetailForm = {
  ...retailForm,
  applicability: appRetail,
} as InspectionFormData;
const resRetail = checkApplicability(fullRetailForm);
assert(resRetail.status === 'APPLICABLE', 'Standard retail product is APPLICABLE');

const fullIndustrialForm = {
  ...industrialForm,
  applicability: appIndustrial,
} as InspectionFormData;
const resIndustrial = checkApplicability(fullIndustrialForm);
assert(resIndustrial.status === 'NOT_APPLICABLE', 'Industrial package is NOT_APPLICABLE');

const bulkForm: Partial<InspectionFormData> = {
  productName: 'Commercial Wheat Flour',
  netQuantity: { value: 30, unit: 'kg', itemCount: null, soldByNumber: false },
};
const appBulk = deriveApplicability(bulkForm);
const fullBulkForm = {
  ...bulkForm,
  applicability: appBulk,
} as InspectionFormData;
const resBulk = checkApplicability(fullBulkForm);
assert(resBulk.status === 'NEEDS_REVIEW', 'Bulk package > 25 kg triggers NEEDS_REVIEW');

console.log(`\n================================================================`);
console.log(`TEST SUITE RESULTS: ${passCount} Passed, ${failCount} Failed.`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
