import type {
  InspectionFormData,
  RuleResult,
  RuleResultStatus,
  RuleDefinition,
  InspectionStatus,
  RulesMetadata,
} from '@/types';
import rulesData from '@/rules/rules.json';
import metadataData from '@/rules/metadata.json';

const rules: RuleDefinition[] = rulesData as RuleDefinition[];
const metadata: RulesMetadata = metadataData as RulesMetadata;

const VALID_UNITS = ['g', 'kg', 'ml', 'l', 'cm', 'm', 'pieces', 'nos', 'units'];

export function getRulesMetadata(): RulesMetadata {
  return metadata;
}

export function getRules(): RuleDefinition[] {
  return rules;
}

interface ApplicabilityResult {
  applicable: boolean;
  reason: string;
}

export function checkApplicability(formData: InspectionFormData): ApplicabilityResult {
  const { applicability } = formData;

  if (applicability.isRetailPackage === false) {
    return { applicable: false, reason: 'Not a retail package. Outside prototype scope.' };
  }

  if (applicability.soldDirectlyToConsumer === false) {
    return { applicable: false, reason: 'Not sold directly to consumer. Outside prototype scope.' };
  }

  if (applicability.isIndustrialConsumerPackage || applicability.isInstitutionalConsumerPackage) {
    return {
      applicable: false,
      reason: 'Industrial/institutional-consumer package. Rule 3 exclusion applies.',
    };
  }

  const qtyKg = applicability.quantityKg ?? 0;
  const qtyLitre = applicability.quantityLitre ?? 0;

  if (qtyKg > 25 || qtyLitre > 25) {
    if (
      (applicability.isCement || applicability.isFertiliser || applicability.isAgriculturalFarmProduce) &&
      qtyKg > 50
    ) {
      return {
        applicable: false,
        reason:
          'Cement/fertiliser/agricultural produce in bags above 50 kg. Rule 3 exclusion applies.',
      };
    }
    if (!applicability.isCement && !applicability.isFertiliser && !applicability.isAgriculturalFarmProduce) {
      return {
        applicable: false,
        reason: 'Package exceeds 25 kg/25 litres. Rule 3 exclusion may apply — needs legal review.',
      };
    }
  }

  if (applicability.isRetailPackage === null || applicability.soldDirectlyToConsumer === null) {
    return {
      applicable: true,
      reason: 'Applicability not fully confirmed. Proceeding with checks; review applicability.',
    };
  }

  return { applicable: true, reason: 'Retail package sold directly to consumer. Rules apply.' };
}

function checkManufacturerIdentification(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-a')!;
  let status: RuleResultStatus = 'pass';
  let evidence = '';
  let reason = '';

  if (formData.isImported) {
    if (!formData.importer.name.trim() || !formData.importer.address.trim()) {
      status = 'fail';
      evidence = `Importer: ${formData.importer.name || '(missing)'}, Address: ${formData.importer.address || '(missing)'}`;
      reason = 'Imported package must bear importer name and address.';
    } else {
      evidence = `Importer: ${formData.importer.name}, Address: ${formData.importer.address}`;
      reason = 'Importer identification present.';
    }
  }

  if (!formData.manufacturer.name.trim() && !formData.manufacturer.address.trim()) {
    if (!formData.isImported || status !== 'fail') {
      status = 'fail';
      reason = 'Manufacturer/packer name and address are required.';
    } else {
      reason += ' Manufacturer/packer details also missing.';
    }
    evidence += evidence
      ? ` | Manufacturer: (missing)`
      : `Manufacturer: (missing), Address: (missing)`;
  } else if (!formData.manufacturer.name.trim() || !formData.manufacturer.address.trim()) {
    if (status !== 'fail') status = 'fail';
    evidence += evidence
      ? ` | Manufacturer: ${formData.manufacturer.name || '(missing)'}, Address: ${formData.manufacturer.address || '(missing)'}`
      : `Manufacturer: ${formData.manufacturer.name || '(missing)'}, Address: ${formData.manufacturer.address || '(missing)'}`;
    reason = reason
      ? reason + ' Manufacturer/packer details incomplete.'
      : 'Manufacturer/packer name and address must both be present.';
  } else {
    evidence += evidence
      ? ` | Manufacturer: ${formData.manufacturer.name}, Address: ${formData.manufacturer.address}`
      : `Manufacturer: ${formData.manufacturer.name}, Address: ${formData.manufacturer.address}`;
    if (status !== 'fail') {
      reason = reason || 'Manufacturer/packer identification present.';
    }
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status,
    evidence,
    reason,
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkCountryOfOrigin(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-aa')!;

  if (!formData.isImported) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'not-applicable',
      evidence: 'Domestic product',
      reason: 'Country of origin declaration is required only for imported products.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (!formData.countryOfOrigin.trim()) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: 'Country of origin: (missing)',
      reason: 'Imported package must declare the country of origin.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Country of origin: ${formData.countryOfOrigin}`,
    reason: 'Country of origin declared for imported product.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkGenericName(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-b')!;

  if (!formData.commonGenericName.trim()) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'warning',
      evidence: 'Common/generic name: (missing)',
      reason:
        'Common or generic name of the commodity should be present on the package.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Common/generic name: ${formData.commonGenericName}`,
    reason: 'Common or generic name present.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkNetQuantity(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-c')!;
  const { netQuantity } = formData;

  if (netQuantity.soldByNumber) {
    if (!netQuantity.itemCount || netQuantity.itemCount <= 0) {
      return {
        ruleId: rule.id,
        ruleRef: rule.ruleRef,
        title: rule.title,
        status: 'fail',
        evidence: `Sold by number, item count: ${netQuantity.itemCount ?? '(missing)'}`,
        reason: 'Item count must be declared when commodity is sold by number.',
        sourceReference: rule.sourceReference,
        sourceUrl: rule.sourceUrl,
      };
    }
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'pass',
      evidence: `Item count: ${netQuantity.itemCount}`,
      reason: 'Item count declared for commodity sold by number.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (!netQuantity.value || netQuantity.value <= 0) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: `Net quantity value: ${netQuantity.value ?? '(missing)'}`,
      reason: 'Net quantity value is required.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  const unitLower = netQuantity.unit.toLowerCase().trim();
  if (!unitLower || !VALID_UNITS.includes(unitLower)) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: `Net quantity: ${netQuantity.value} ${netQuantity.unit || '(no unit)'}`,
      reason: `Unit "${netQuantity.unit || ''}" is missing or not a recognised standard unit (${VALID_UNITS.join(', ')}).`,
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Net quantity: ${netQuantity.value} ${netQuantity.unit}`,
    reason: 'Net quantity with valid unit declared.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkMRP(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-e')!;
  const { mrp } = formData;

  if (mrp.exemptionDeclared) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'needs-review',
      evidence: 'MRP exemption declared',
      reason:
        'An exemption has been declared. Verify with applicable notification/order.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (!mrp.value || mrp.value <= 0) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: `MRP: ${mrp.value ?? '(missing)'}`,
      reason: 'Maximum Retail Price (MRP) in Indian currency is required.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (mrp.inclusiveOfAllTaxes !== true) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: `MRP: ₹${mrp.value}, Inclusive of all taxes: ${mrp.inclusiveOfAllTaxes === false ? 'No' : 'Not confirmed'}`,
      reason:
        'MRP must be inclusive of all taxes. Confirmation missing or denied.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `MRP: ₹${mrp.value} (inclusive of all taxes)`,
    reason: 'MRP declared in Indian currency, inclusive of all taxes.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkDimensions(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-f')!;

  if (formData.dimensions.relevant === false || formData.dimensions.relevant === null) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'not-applicable',
      evidence: `Dimensions relevant: ${formData.dimensions.relevant === false ? 'No' : 'Not specified'}`,
      reason:
        'Dimensions are not relevant to this commodity or not specified.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (!formData.dimensions.value.trim()) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: 'Dimensions: (missing)',
      reason: 'Dimensions are relevant but not declared.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Dimensions: ${formData.dimensions.value}`,
    reason: 'Dimensions declared.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkBestBefore(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-1-da')!;

  if (formData.bestBefore.applicable === false) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'not-applicable',
      evidence: 'Product does not become unfit for consumption over time.',
      reason: 'Best-before/use-by date not applicable for this product.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (formData.bestBefore.applicable === null) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'needs-review',
      evidence: 'Applicability not specified',
      reason: 'Determine whether the product may become unfit for consumption.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  // For food, return needs-review instead of fail
  if (formData.category === 'food') {
    const hasDate = formData.bestBefore.month.trim() && formData.bestBefore.year.trim();
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'needs-review',
      evidence: hasDate
        ? `Best before: ${formData.bestBefore.month}/${formData.bestBefore.year}`
        : 'Best-before date details may be incomplete.',
      reason:
        'Needs Review — food products are governed by food-specific requirements (FSSAI). This Legal Metrology check does not determine full food-labelling compliance.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (!formData.bestBefore.month.trim() || !formData.bestBefore.year.trim()) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'fail',
      evidence: `Best before: ${formData.bestBefore.date || '-'}/${formData.bestBefore.month || '-'}/${formData.bestBefore.year || '-'}`,
      reason: 'Best-before/use-by month and year are required.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Best before: ${formData.bestBefore.date ? formData.bestBefore.date + '/' : ''}${formData.bestBefore.month}/${formData.bestBefore.year}`,
    reason: 'Best-before/use-by date declared.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkConsumerCare(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-2')!;
  const { consumerCare } = formData;
  const missing: string[] = [];

  if (!consumerCare.contactName.trim()) missing.push('contact name');
  if (!consumerCare.address.trim()) missing.push('address');
  if (!consumerCare.phone.trim()) missing.push('telephone');
  if (!consumerCare.email.trim()) missing.push('email');

  if (missing.length === 4) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'warning',
      evidence: 'Consumer care details: (all missing)',
      reason: 'Consumer care contact details should be present on the package.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (missing.length > 0) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'warning',
      evidence: `Consumer care — missing: ${missing.join(', ')}`,
      reason: `Consumer care details incomplete. Missing: ${missing.join(', ')}.`,
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Contact: ${consumerCare.contactName}, Phone: ${consumerCare.phone}, Email: ${consumerCare.email}`,
    reason: 'Consumer care details present.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkCosmeticOrigin(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-8')!;

  if (formData.category !== 'cosmetics') {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'not-applicable',
      evidence: `Category: ${formData.category}`,
      reason: 'Cosmetics origin symbol check applies only to cosmetic products.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (formData.cosmeticOrigin.symbolDeclared === null) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'warning',
      evidence: 'Origin symbol declaration: not confirmed',
      reason:
        'Needs Review — cosmetics must display vegetarian/non-vegetarian origin symbol on principal display panel. Cosmetics-specific regulation may also apply.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  if (formData.cosmeticOrigin.symbolDeclared === false) {
    return {
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status: 'warning',
      evidence: `Origin type: ${formData.cosmeticOrigin.isVegetarian ? 'Vegetarian' : formData.cosmeticOrigin.isVegetarian === false ? 'Non-vegetarian' : 'Not specified'}, Symbol declared: No`,
      reason:
        'Missing vegetarian/non-vegetarian origin symbol. Needs Review — cosmetics-specific regulation may also apply.',
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    };
  }

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: 'pass',
    evidence: `Origin: ${formData.cosmeticOrigin.isVegetarian ? 'Vegetarian (green dot)' : 'Non-vegetarian (red/brown dot)'}, Symbol declared: Yes`,
    reason: 'Cosmetics origin symbol declared on principal display panel.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkBarcode(formData: InspectionFormData): RuleResult {
  const rule = rules.find((r) => r.id === 'LMPC-R6-4A')!;

  return {
    ruleId: rule.id,
    ruleRef: rule.ruleRef,
    title: rule.title,
    status: formData.supplementary.barcode.trim() ? 'pass' : 'not-applicable',
    evidence: formData.supplementary.barcode.trim()
      ? `Barcode/GTIN: ${formData.supplementary.barcode}`
      : 'No barcode/GTIN/QR declared (optional)',
    reason: formData.supplementary.barcode.trim()
      ? 'Barcode/GTIN/QR code present (supplementary information).'
      : 'Barcode/GTIN/QR code is optional supplementary information. Not required for compliance.',
    sourceReference: rule.sourceReference,
    sourceUrl: rule.sourceUrl,
  };
}

function checkVisibility(formData: InspectionFormData): RuleResult[] {
  const results: RuleResult[] = [];
  const visChecks: { id: string; field: boolean | null; label: string }[] = [
    {
      id: 'LMPC-VIS-AFFIXED',
      field: formData.visibility.securelyAffixed,
      label: 'securely affixed',
    },
    {
      id: 'LMPC-VIS-LEGIBLE',
      field: formData.visibility.plainDefiniteConspicuousLegible,
      label: 'plain, definite, conspicuous, and legible',
    },
    {
      id: 'LMPC-VIS-PANEL',
      field: formData.visibility.onPrincipalDisplayPanel,
      label: 'on principal display panel or visibly placed',
    },
  ];

  for (const check of visChecks) {
    const rule = rules.find((r) => r.id === check.id)!;
    let status: RuleResultStatus;
    let evidence: string;
    let reason: string;

    if (check.field === true) {
      status = 'pass';
      evidence = `Inspector confirmed: ${check.label}`;
      reason = `Declaration confirmed as ${check.label} by inspector.`;
    } else if (check.field === false) {
      status = 'needs-review';
      evidence = `Inspector noted: declaration NOT ${check.label}`;
      reason = `Inspector indicated declaration is not ${check.label}. Needs review — this prototype does not have OCR/AI to independently verify.`;
    } else {
      status = 'needs-review';
      evidence = `Inspector has not confirmed: ${check.label}`;
      reason = `Inspector confirmation pending for whether declaration is ${check.label}.`;
    }

    results.push({
      ruleId: rule.id,
      ruleRef: rule.ruleRef,
      title: rule.title,
      status,
      evidence,
      reason,
      sourceReference: rule.sourceReference,
      sourceUrl: rule.sourceUrl,
    });
  }

  return results;
}

export function runInspection(formData: InspectionFormData): {
  results: RuleResult[];
  overallStatus: InspectionStatus;
  complianceScore: number;
  applicabilityResult: ApplicabilityResult;
} {
  const applicabilityResult = checkApplicability(formData);

  if (!applicabilityResult.applicable) {
    return {
      results: [],
      overallStatus: 'not-applicable',
      complianceScore: 0,
      applicabilityResult,
    };
  }

  const results: RuleResult[] = [
    checkManufacturerIdentification(formData),
    checkCountryOfOrigin(formData),
    checkGenericName(formData),
    checkNetQuantity(formData),
    checkMRP(formData),
    checkDimensions(formData),
    checkBestBefore(formData),
    checkConsumerCare(formData),
    checkCosmeticOrigin(formData),
    checkBarcode(formData),
    ...checkVisibility(formData),
  ];

  // Add category-specific warnings
  if (formData.category === 'food') {
    results.push({
      ruleId: 'CAT-FOOD',
      ruleRef: 'Category Notice',
      title: 'Food-Specific Regulatory Review Required',
      status: 'needs-review',
      evidence: `Category: Food`,
      reason:
        'Food products are subject to FSSAI regulations and food-specific labelling requirements that are not determined by this Legal Metrology rule engine. A separate food-regulatory review is required.',
      sourceReference: 'FSSAI Act, 2006 / Food Safety and Standards (Packaging and Labelling) Regulations',
      sourceUrl: 'https://www.fssai.gov.in',
    });
  }

  if (formData.category === 'cosmetics') {
    results.push({
      ruleId: 'CAT-COSMETICS',
      ruleRef: 'Category Notice',
      title: 'Cosmetics-Specific Regulatory Notice',
      status: 'needs-review',
      evidence: `Category: Cosmetics`,
      reason:
        'Cosmetic products may be subject to additional requirements under the Drugs and Cosmetics Act, 1940 and Rules, 1945. This Legal Metrology check does not determine full cosmetics regulatory compliance.',
      sourceReference: 'Drugs and Cosmetics Act, 1940',
      sourceUrl: 'https://cdsco.gov.in',
    });
  }

  // Calculate compliance score
  const complianceScore = calculateScore(results);
  const overallStatus = determineOverallStatus(results);

  return { results, overallStatus, complianceScore, applicabilityResult };
}

function calculateScore(results: RuleResult[]): number {
  if (results.length === 0) return 0;

  // Only score applicable, non-supplementary results
  const scorable = results.filter(
    (r) => r.status !== 'not-applicable' && r.ruleId !== 'LMPC-R6-4A'
  );

  if (scorable.length === 0) return 100;

  let totalPoints = 0;
  let earnedPoints = 0;

  for (const result of scorable) {
    const weight = result.ruleId.startsWith('CAT-') ? 0 : 1; // Category notices don't affect score
    if (weight === 0) continue;

    totalPoints += weight;
    switch (result.status) {
      case 'pass':
        earnedPoints += weight;
        break;
      case 'warning':
        earnedPoints += weight * 0.7;
        break;
      case 'needs-review':
        earnedPoints += weight * 0.5;
        break;
      case 'fail':
        earnedPoints += 0;
        break;
    }
  }

  if (totalPoints === 0) return 100;
  return Math.round((earnedPoints / totalPoints) * 100);
}

function determineOverallStatus(results: RuleResult[]): InspectionStatus {
  const hasFail = results.some((r) => r.status === 'fail');
  const hasNeedsReview = results.some(
    (r) => r.status === 'needs-review' && !r.ruleId.startsWith('CAT-')
  );
  const hasWarning = results.some((r) => r.status === 'warning');

  if (hasFail) return 'potential-non-compliance';
  if (hasNeedsReview) return 'needs-review';
  if (hasWarning) return 'needs-review';
  return 'compliant';
}
