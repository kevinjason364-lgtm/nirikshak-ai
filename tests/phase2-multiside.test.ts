/**
 * Phase 2 Test: Multi-Side Provenance Merging
 *
 * Verifies that the hybrid merger handles different source sides (front/back)
 * correctly and merges identical values while retaining spatial provenance.
 */

import { mergeExtractions } from '../src/lib/hybrid-merger';
import { VisionExtractionCandidate } from '../src/lib/vision/types';

console.log('--- PHASE 2: Multi-Side Merging Test ---');

// Test Case: Identical product name found on front and back
const ocrCandidateFront = { productName: 'SparkleClean' };
const ocrConfFront = { productName: 90 };
const ocrFieldDetails = {
    productName: {
        value: 'SparkleClean',
        confidence: 'high' as const,
        confidenceScore: 90,
        source: 'SparkleClean',
        sourceLine: 'SparkleClean',
        sourceSide: 'front' as 'front',
    }
};

const aiCandidate: VisionExtractionCandidate = {
    productName: 'SparkleClean',
    brand: 'Sparkle',
};
const aiConf = { productName: 85, brand: 85 };

const result = mergeExtractions(ocrCandidateFront, ocrConfFront, aiCandidate, aiConf, ocrFieldDetails);

if (result.formData.productName === 'SparkleClean' && result.metadata['productName']?.sourceSide === 'front') {
    console.log('✅ PASS: Product Name merged and sourceSide preserved');
} else {
    console.error('❌ FAIL: Product Name merge mismatch', result.formData.productName, result.metadata['productName']);
    process.exit(1);
}
