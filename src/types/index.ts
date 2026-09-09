/** Core types for Nirikshak AI inspection system */

export type InspectionStatus = 'compliant' | 'needs-review' | 'potential-non-compliance' | 'not-applicable';

export type RuleResultStatus = 'pass' | 'warning' | 'fail' | 'needs-review' | 'not-applicable';

export type ProductCategory =
  | 'food'
  | 'cosmetics'
  | 'garments'
  | 'household'
  | 'electronics'
  | 'general';

export interface ApplicabilityInfo {
  isRetailPackage: boolean | null;
  soldDirectlyToConsumer: boolean | null;
  quantityKg: number | null;
  quantityLitre: number | null;
  isCement: boolean;
  isFertiliser: boolean;
  isAgriculturalFarmProduce: boolean;
  isIndustrialConsumerPackage: boolean;
  isInstitutionalConsumerPackage: boolean;
}

export interface ManufacturerInfo {
  name: string;
  address: string;
}

export interface ImporterInfo {
  name: string;
  address: string;
}

export interface ConsumerCareInfo {
  contactName: string;
  address: string;
  phone: string;
  email: string;
}

export interface NetQuantityInfo {
  value: number | null;
  unit: string;
  itemCount: number | null;
  soldByNumber: boolean;
}

export interface MRPInfo {
  value: number | null;
  inclusiveOfAllTaxes: boolean | null;
  exemptionDeclared: boolean;
}

export interface BestBeforeInfo {
  applicable: boolean | null;
  date: string;
  month: string;
  year: string;
  text?: string;
}

export interface DimensionsInfo {
  relevant: boolean | null;
  value: string;
}

export interface CosmeticOriginInfo {
  applicable: boolean;
  isVegetarian: boolean | null;
  symbolDeclared: boolean | null;
}

export interface VisibilityChecks {
  securelyAffixed: boolean | null;
  plainDefiniteConspicuousLegible: boolean | null;
  onPrincipalDisplayPanel: boolean | null;
}

export interface SupplementaryFields {
  batchLot: string;
  barcode: string;
  fssaiLicence: string;
  inspectorNotes: string;
}

export interface InspectionFormData {
  // Basic product info
  productName: string;
  commonGenericName: string;
  brand: string;
  category: ProductCategory;

  // Import status
  isImported: boolean;

  // Applicability
  applicability: ApplicabilityInfo;

  // MRP
  mrp: MRPInfo;

  // Net quantity
  netQuantity: NetQuantityInfo;

  // Manufacturer / Packer
  manufacturer: ManufacturerInfo;

  // Importer (only for imported products)
  importer: ImporterInfo;

  // Country of origin
  countryOfOrigin: string;

  // Manufacture date
  manufactureMonth: string;
  manufactureYear: string;

  // Best-before / use-by
  bestBefore: BestBeforeInfo;

  // Consumer care
  consumerCare: ConsumerCareInfo;

  // Dimensions
  dimensions: DimensionsInfo;

  // Cosmetic origin symbol
  cosmeticOrigin: CosmeticOriginInfo;

  // Visibility checks
  visibility: VisibilityChecks;

  // Supplementary
  supplementary: SupplementaryFields;
}

export interface CapturedImage {
  id: string;
  dataUrl: string; // thumbnail for display
  blobKey: string; // IndexedDB key for full image
  timestamp: number;
  qualityScore: number | null;
  qualityWarnings: string[];
  // Internal metadata for provenance tracking (not user-facing)
  _internalIndex?: number; // Image sequence number for system tracking
}

export interface ImageQualityResult {
  score: number; // 0-100
  status: 'good' | 'needs-review' | 'retake-recommended';
  warnings: string[];
}

export interface RuleDefinition {
  id: string;
  ruleRef: string;
  title: string;
  description: string;
  severity: 'mandatory' | 'recommended' | 'supplementary';
  sourceReference: string;
  sourceUrl: string;
  applicableCategories: ProductCategory[] | 'all';
  requiresImported?: boolean;
}

export interface RuleResult {
  ruleId: string;
  ruleRef: string;
  title: string;
  status: RuleResultStatus;
  evidence: string;
  reason: string;
  sourceReference: string;
  sourceUrl: string;
}

export interface InspectionReport {
  id: string;
  createdAt: number;
  updatedAt: number;
  productName: string;
  brand: string;
  category: ProductCategory;
  overallStatus: InspectionStatus;
  complianceScore: number;
  results: RuleResult[];
  formData: InspectionFormData;
  images: CapturedImage[];
  disclaimer: string;
}

export interface InspectionHistoryEntry {
  id: string;
  productName: string;
  brand: string;
  category: ProductCategory;
  overallStatus: InspectionStatus;
  complianceScore: number;
  createdAt: number;
  resultCounts: {
    pass: number;
    warning: number;
    fail: number;
    needsReview: number;
    notApplicable: number;
  };
}

export interface RulesMetadata {
  sourceTitle: string;
  sourceUrl: string;
  sourceReviewedDate: string;
  effectiveDate: string;
  amendmentNotes: string;
  version: string;
  lastManuallyVerifiedDate: string;
  disclaimer: string;
}

/** Extraction adapter interface for future AI integration */
export interface ExtractionResult {
  formData: Partial<InspectionFormData>;
  confidence: Record<string, number>; // Field-level confidence scores
  method: 'manual' | 'demo' | 'ocr' | 'vision-lm';
}

export interface ExtractionAdapter {
  name: string;
  description: string;
  extract(
    images: CapturedImage[],
    onProgress?: (statusMessage: string) => void
  ): Promise<ExtractionResult>;
}

export function getEmptyFormData(): InspectionFormData {
  return {
    productName: '',
    commonGenericName: '',
    brand: '',
    category: 'general',
    isImported: false,
    applicability: {
      isRetailPackage: null,
      soldDirectlyToConsumer: null,
      quantityKg: null,
      quantityLitre: null,
      isCement: false,
      isFertiliser: false,
      isAgriculturalFarmProduce: false,
      isIndustrialConsumerPackage: false,
      isInstitutionalConsumerPackage: false,
    },
    mrp: {
      value: null,
      inclusiveOfAllTaxes: null,
      exemptionDeclared: false,
    },
    netQuantity: {
      value: null,
      unit: '',
      itemCount: null,
      soldByNumber: false,
    },
    manufacturer: { name: '', address: '' },
    importer: { name: '', address: '' },
    countryOfOrigin: '',
    manufactureMonth: '',
    manufactureYear: '',
    bestBefore: {
      applicable: null,
      date: '',
      month: '',
      year: '',
      text: '',
    },
    consumerCare: {
      contactName: '',
      address: '',
      phone: '',
      email: '',
    },
    dimensions: {
      relevant: null,
      value: '',
    },
    cosmeticOrigin: {
      applicable: false,
      isVegetarian: null,
      symbolDeclared: null,
    },
    visibility: {
      securelyAffixed: null,
      plainDefiniteConspicuousLegible: null,
      onPrincipalDisplayPanel: null,
    },
    supplementary: {
      batchLot: '',
      barcode: '',
      fssaiLicence: '',
      inspectorNotes: '',
    },
  };
}
