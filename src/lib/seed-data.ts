import { storage } from './storage';
import { runInspection } from './rule-engine';
import { getDemoSample, getDemoSampleKeys } from './extraction';
import type { InspectionReport, CapturedImage } from '@/types';
import { getEmptyFormData } from '@/types';

const SEED_FLAG = 'nirikshak_seeded';

export async function seedDemoData(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SEED_FLAG)) return;

  const keys = getDemoSampleKeys();

  for (const key of keys) {
    const sample = getDemoSample(key);
    const formData = { ...getEmptyFormData(), ...sample };
    const inspection = runInspection(formData);

    const report: InspectionReport = {
      id: `demo-${key}`,
      createdAt: Date.now() - Math.floor(Math.random() * 86400000),
      updatedAt: Date.now(),
      productName: formData.productName,
      brand: formData.brand,
      category: formData.category,
      overallStatus: inspection.overallStatus,
      complianceScore: inspection.complianceScore,
      results: inspection.results,
      formData,
      images: [] as CapturedImage[],
      disclaimer:
        'This is an inspection-assistance prototype. It does not constitute a final legal determination or legal advice. Refer to authorized Legal Metrology officers for official enforcement decisions.',
    };

    storage.saveReport(report);
  }

  localStorage.setItem(SEED_FLAG, 'true');
}
