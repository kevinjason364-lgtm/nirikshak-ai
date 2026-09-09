/**
 * Vision AI Types — Nirikshak AI
 *
 * Type definitions for Vision AI extraction system.
 */

import type { InspectionFormData } from '@/types';

/**
 * Vision extraction candidate — structured output from Vision AI model
 */
export interface VisionExtractionCandidate {
  productName?: string;
  commonGenericName?: string;
  brand?: string;
  mrp?: number;
  mrpInclusiveTaxes?: boolean;
  netQuantity?: number;
  unit?: string;
  manufacturerName?: string;
  manufacturerAddress?: string;
  importerName?: string;
  importerAddress?: string;
  countryOfOrigin?: string;
  manufactureMonth?: string;
  manufactureYear?: string;
  bestBeforeMonth?: string;
  bestBeforeYear?: string;
  consumerCareName?: string;
  consumerCareAddress?: string;
  consumerCarePhone?: string;
  consumerCareEmail?: string;
  batchLot?: string;
  barcode?: string;
  fssaiLicense?: string;
}

/**
 * Vision provider response
 */
export interface VisionProviderResponse {
  success: boolean;
  candidate: VisionExtractionCandidate;
  rawResponse?: any;
  error?: string;
  confidence: Record<string, number>;
  isRateLimit?: boolean;
}

/**
 * Vision provider interface
 */
export interface VisionProvider {
  name: string;
  extract(images: VisionImageInput[]): Promise<VisionProviderResponse>;
}

/**
 * Image input for vision providers
 */
export interface VisionImageInput {
  dataUrl: string;
  label: string;
  mimeType?: string;
}

/**
 * Extraction source tags
 */
export type ExtractionSource = 'ocr' | 'ai' | 'ocr+ai' | 'manual';

/**
 * Qualitative confidence tiers
 */
export type QualitativeConfidence = 'High' | 'Medium' | 'Low' | 'Needs Review';

/**
 * Field-level extraction metadata
 */
export interface FieldExtractionMeta {
  source: ExtractionSource;
  confidence: number;
  qualitativeConfidence?: QualitativeConfidence;
  sourceSide?: string;
  ocrValue?: string;
  aiValue?: string;
  ocrEvidenceSnippet?: string;
  aiEvidenceSnippet?: string;
}
