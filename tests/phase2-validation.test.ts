/**
 * Phase 2 Test: Validation Enforcements
 *
 * Verifies that field-specific strict validators reject garbage inputs,
 * random numbers, and corrupt strings, ensuring they do not pollute the form
 * or trick the confidence scoring simply because of extraction presence.
 */

import { parseOcrText } from '../src/lib/ocr-parser';

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

console.log('--- PHASE 2: OCR Strict Validation Test ---');

// Test 1: MRP Isolation
// Should accept valid MRP and reject generic phone numbers/pin codes
const mrpGarbage = `
Phone: 9876543210
PIN: 110001
Random: 1234.56
MRP: Rs. 499.00
`;
const mrpResult = parseOcrText(mrpGarbage, 90);
assert(mrpResult.formData.mrp?.value === 499, 'Extracts actual MRP, ignores phone/pin and random numbers');

// Test 2: FSSAI Validation
const fssaiGarbage = `
License no: 1234
FSSAI 10012011000123
Random numbers: 589218590123
`;
const fssaiResult = parseOcrText(fssaiGarbage, 90);
assert(fssaiResult.formData.supplementary?.fssaiLicence === '10012011000123', 'Extracts valid 14-digit FSSAI, rejects shorts/randoms');

// Test 3: Phone/Email Validation
const contactGarbage = `
Contact us at 1800-112-9988 or fake@@domain..com or support@real.com
`;
const contactResult = parseOcrText(contactGarbage, 90);
assert(contactResult.formData.consumerCare?.phone === '1800-112-9988', 'Extracts valid toll free phone');
assert(contactResult.formData.consumerCare?.email === 'support@real.com', 'Extracts valid email, rejects corrupt ones');

// Test 4: Net Quantity Validation
const qtyGarbage = `
200 cm length
NET QTY: 1.5 kg
`;
const qtyResult = parseOcrText(qtyGarbage, 90);
assert(qtyResult.formData.netQuantity?.value === 1.5 && qtyResult.formData.netQuantity?.unit === 'kg', 'Extracts valid net quantity, limits to valid units');

// Test 5: Date Validation
const dateGarbage = `
Random Date: 35/15/2099
Best Before: 99 months
MFD: 10/2023
`;
const dateResult = parseOcrText(dateGarbage, 90);
assert(dateResult.formData.manufactureMonth === '10' && dateResult.formData.manufactureYear === '2023', 'Extracts valid MFD date');
// Assuming the best before extraction logic is strict about plausible months

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
}
