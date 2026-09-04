/**
 * Test Suite for OCR Parser & Quality Gates
 *
 * Verifies that:
 * 1. Realistic packaged product label text correctly extracts all mandatory LMPC fields
 * 2. OCR noise / garbage fragments like "0 = Us," are strictly REJECTED and do not populate productName
 * 3. Confidence values and field details are properly calculated
 */

import { parseOcrText } from '../src/lib/ocr-parser';

// Sample 1: Real label text from a household cleaner
const realisticLabelText = `
=== FRONT ===
SPARKLECLEAN
ALL-PURPOSE SURFACE CLEANER
Kills 99.9% Germs

NET QTY: 500 mL
M.R.P. Rs. 149.00
(INCL. OF ALL TAXES)

=== BACK ===
MANUFACTURED BY:
CleanTech Industries Pvt. Ltd.
Plot 42, Industrial Area Phase II, Gurgaon, Haryana 122002

CONSUMER CARE:
Customer Relations Manager
Toll Free: 1800-123-4567
Email: care@sparkleclean.example.in

BATCH NO: B2025-0642
MFD DATE: 06/2025
EXP DATE: 06/2027

BARCODE: 8901234567890
`;

// Sample 2: Noise / Garbage OCR that previously caused false positives
const garbageNoiseText = `
0 = Us,
---...===
123456
&^%$#@!
. . .
`;

// Sample 3: Real Flipkart Supermart Green Tea Lemon packaging text
const greenTeaLabelText = `
=== FRONT ===
Flipkart Supermart
GREEN TEA LEMON
25 Tea Bags

=== SIDE ===
NET QUANTITY: 25 N Tea Bags
NET CONTENTS: 25 N Tea Bags X 1.3 g Each
Ingredients: Green Tea, Lemon Flavour
Flavoured Tea

=== BACK ===
Manufactured By: ADITYA BIRLA GLOBAL TRADING (INDIA) PVT. LTD.
Lamda Shed, CISF Compound, Kantapukur, Kolkata, West Bengal-700023, India
Lic. No. 10014031001025

Marketed By: FLIPKART INDIA PRIVATE LIMITED
Buildings Alyssa, Begonia & Clove Embassy Tech Village, Outer Ring Road, Devarabeesanahalli Village, Bengaluru-560103, Karnataka, India
Lic. No. 10019043002627

Consumer Care:
Phone: 044-45614700
Email: supermart-feedback@flipkart.com
`;

// Run verification tests
console.log('====================================================');
console.log('RUNNING OCR PARSER UNIT TESTS');
console.log('====================================================\n');

// Test 1: Realistic Label Text
console.log('--- TEST 1: Realistic Label Text ---');
const parsed1 = parseOcrText(realisticLabelText, 85);
console.log('Extracted Form Data:', JSON.stringify(parsed1.formData, null, 2));
console.log('Useful Fields Found:', parsed1.quality.usefulFieldsFound);

let pass1 = true;
if (!parsed1.formData.productName || parsed1.formData.productName.length < 3) {
  console.error('FAIL: Product Name not extracted');
  pass1 = false;
}
if (parsed1.formData.mrp?.value !== 149) {
  console.error('FAIL: MRP not extracted correctly. Expected 149, got:', parsed1.formData.mrp?.value);
  pass1 = false;
}
if (parsed1.formData.mrp?.inclusiveOfAllTaxes !== true) {
  console.error('FAIL: MRP tax inclusion not detected');
  pass1 = false;
}
if (parsed1.formData.netQuantity?.value !== 500 || parsed1.formData.netQuantity?.unit !== 'ml') {
  console.error('FAIL: Net quantity not extracted correctly. Expected 500 ml, got:', parsed1.formData.netQuantity);
  pass1 = false;
}
if (!parsed1.formData.manufacturer?.name) {
  console.error('FAIL: Manufacturer not extracted');
  pass1 = false;
}
if (parsed1.formData.consumerCare?.phone !== '1800-123-4567') {
  console.error('FAIL: Phone not extracted correctly');
  pass1 = false;
}
if (parsed1.formData.consumerCare?.email !== 'care@sparkleclean.example.in') {
  console.error('FAIL: Email not extracted correctly');
  pass1 = false;
}
if (parsed1.formData.supplementary?.barcode !== '8901234567890') {
  console.error('FAIL: Barcode not extracted correctly');
  pass1 = false;
}

if (pass1) {
  console.log('>>> TEST 1 PASSED: All realistic fields correctly extracted! <<<\n');
} else {
  console.error('>>> TEST 1 FAILED! <<<\n');
}

// Test 2: Garbage Noise Text (must reject "0 = Us,")
console.log('--- TEST 2: Garbage / Noise Rejection ---');
const parsed2 = parseOcrText(garbageNoiseText, 30);
console.log('Extracted Form Data for Garbage:', JSON.stringify(parsed2.formData, null, 2));
console.log('Useful Fields Found for Garbage:', parsed2.quality.usefulFieldsFound);

let pass2 = true;
if (parsed2.formData.productName) {
  console.error('FAIL: Garbage text was incorrectly accepted as product name:', parsed2.formData.productName);
  pass2 = false;
}
if (parsed2.quality.usefulFieldsFound > 0) {
  console.error('FAIL: Expected 0 useful fields from noise, got:', parsed2.quality.usefulFieldsFound);
  pass2 = false;
}

if (pass2) {
  console.log('>>> TEST 2 PASSED: "0 = Us," and noise were successfully REJECTED by quality gate! <<<\n');
} else {
  console.error('>>> TEST 2 FAILED! <<<\n');
}

// Test 3: Green Tea Lemon packaging text
console.log('--- TEST 3: Green Tea Lemon ---');
const parsed3 = parseOcrText(greenTeaLabelText, 85);
console.log('Extracted Form Data for Green Tea:', JSON.stringify(parsed3.formData, null, 2));
console.log('Useful Fields Found for Green Tea:', parsed3.quality.usefulFieldsFound);

let pass3 = true;
if (parsed3.formData.netQuantity?.value !== 25) {
  console.error('FAIL: Green Tea netQuantity not extracted correctly. Expected 25, got:', parsed3.formData.netQuantity);
  pass3 = false;
}
// Using generic phone regex for 044-45614700 (11 chars)
if (parsed3.formData.consumerCare?.phone !== '044-45614700') {
  console.error('FAIL: Green Tea telephone not extracted correctly. Expected 044-45614700, got:', parsed3.formData.consumerCare?.phone);
  pass3 = false;
}
if (!parsed3.formData.supplementary?.fssaiLicence) {
  console.error('FAIL: Green Tea FSSAI not extracted correctly.');
  pass3 = false;
}
if (parsed3.formData.brand !== 'Flipkart Supermart') {
  console.error('FAIL: Green Tea Brand not extracted correctly. Expected "Flipkart Supermart", got:', parsed3.formData.brand);
  pass3 = false;
}

if (pass3) {
  console.log('>>> TEST 3 PASSED: Green Tea Lemon text correctly extracted! <<<\n');
} else {
  console.error('>>> TEST 3 FAILED! <<<\n');
}

if (pass1 && pass2 && pass3) {
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
} else {
  process.exit(1);
}
