'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CameraCapture } from '@/components/inspection/CameraCapture';
import { InspectionForm } from '@/components/inspection/InspectionForm';
import { InspectionReportView } from '@/components/inspection/InspectionReport';
import { runInspection } from '@/lib/rule-engine';
import { storage } from '@/lib/storage';
import { getDemoSampleKeys, getDemoSampleLabel, getDemoSample, DemoSampleKey, ocrExtraction, hybridExtraction, getDemoConfidence } from '@/lib/extraction';
import type { InspectionFormData, InspectionReport, CapturedImage } from '@/types';
import { getEmptyFormData } from '@/types';

type Step = 'images' | 'form' | 'report';
type ExtractionMode = 'manual' | 'demo' | 'ocr' | 'vision-lm';

export default function InspectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('images');
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [formData, setFormData] = useState<InspectionFormData>(getEmptyFormData());
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMode>('manual');
  const [sourceMap, setSourceMap] = useState<Record<string, string>>({});
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [extractionDiagnostics, setExtractionDiagnostics] = useState<any>(null);
  const [extractionStatusMessage, setExtractionStatusMessage] = useState<string>('');
  const [visionAIAvailable, setVisionAIAvailable] = useState<boolean>(true);

  const handleLoadDemo = (sampleKey: string) => {
    const sample = getDemoSample(sampleKey as DemoSampleKey);
    const demoConf = getDemoConfidence(sampleKey as DemoSampleKey);
    setFormData({ ...getEmptyFormData(), ...sample });
    setConfidence(demoConf);
    setExtractionMethod('demo');
  };

  // Helper to deep merge form data (preserve nested objects, only update non-empty values)
  const mergeFormData = (existing: any, extracted: any): any => {
    const result = { ...existing };

    for (const key of Object.keys(extracted)) {
      const extractedValue = extracted[key];
      if (extractedValue === null || extractedValue === undefined) continue;

      if (typeof extractedValue === 'object' && !Array.isArray(extractedValue)) {
        // Recursively merge nested objects, preserving existing non-empty properties
        if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          result[key] = mergeFormData(result[key], extractedValue);
        } else {
          result[key] = extractedValue;
        }
      } else {
        // Handle primitives - only overwrite if non-empty
        if (extractedValue !== '' && extractedValue !== null && extractedValue !== undefined) {
          result[key] = extractedValue;
        }
      }
    }

    return result;
  };

  // Check Vision AI availability
  useEffect(() => {
    const checkVisionAI = async () => {
      try {
        const response = await fetch('/api/extract', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          setVisionAIAvailable(Boolean(data.available));
          console.log('[Vision AI] Status:', data.available ? `Enabled (${data.provider})` : 'Disabled (using OCR fallback)');
        } else {
          setVisionAIAvailable(false);
        }
      } catch (error) {
        console.log('[Vision AI] Not available:', error);
        setVisionAIAvailable(false);
      }
    };
    checkVisionAI();
  }, []);

  const handleContinueToForm = async () => {
    if (isProcessingRef.current) return;

    if (images.length > 0) {
      isProcessingRef.current = true;
      setIsProcessing(true);
      setExtractionDiagnostics(null);
      setExtractionStatusMessage(visionAIAvailable
        ? 'Running Vision AI + OCR hybrid extraction...'
        : 'Extracting text via OCR...');
      try {
        console.log('[Inspect Page] Starting extraction...');

        // Use hybrid extraction if Vision AI is available, otherwise OCR-only
        const extractionAdapter = visionAIAvailable ? hybridExtraction : ocrExtraction;
        const result: any = await extractionAdapter.extract(images);
        console.log('[Inspect Page] Extraction result:', result);

        setExtractionDiagnostics(result.diagnostics || null);

        // Always merge new extraction onto a fresh empty form to prevent cross-inspection contamination
        const newFormData = mergeFormData(getEmptyFormData(), result.formData);
        setFormData(newFormData);
        setConfidence(result.confidence || {});
        setSourceMap(result.sourceMap || {});

        const status = result.extractionStatus;
        const fieldCount = result.fieldCount || 0;

        // Determine extraction method based on result
        let method: ExtractionMode = 'manual';
        let message = '';

        if (status === 'success' && fieldCount > 0) {
          method = result.method || (visionAIAvailable ? 'vision-lm' : 'ocr');

          if (visionAIAvailable && result.sourceMap) {
            const sourceCounts: Record<string, number> = {};
            Object.values(result.sourceMap).forEach((val: any) => {
              sourceCounts[val] = (sourceCounts[val] || 0) + 1;
            });
            const sources = Object.entries(sourceCounts)
              .map(([src, count]) => `${src}(${count})`)
              .join(', ');
            message = `Hybrid extraction: ${fieldCount} fields from ${sources}. Please review before continuing.`;
          } else if (visionAIAvailable) {
            message = `Vision AI extraction: ${fieldCount} fields detected. Please review before continuing.`;
          } else {
            message = `OCR extraction: ${fieldCount} fields detected. Please review before continuing.`;
          }
        } else if (status === 'no-useful-fields' || (status === 'success' && fieldCount === 0)) {
          method = visionAIAvailable ? 'vision-lm' : 'ocr';
          message = visionAIAvailable
            ? 'Both Vision AI and OCR processed the images, but could not confidently identify label fields. Please review and enter details manually.'
            : 'OCR detected text, but could not confidently identify label fields. Please review the label and enter details manually.';
        } else if (status === 'no-text') {
          method = 'manual';
          message = visionAIAvailable
            ? 'Vision AI and OCR detected little or no readable text from the images. Please enter details manually.'
            : 'OCR detected little or no readable text from the image. Please enter details manually.';
        } else if (status === 'init-failed') {
          method = 'manual';
          message = 'Extraction initialization failed. Please check resources/connectivity or continue manually.';
        } else {
          method = 'manual';
          message = 'Could not process the label images. Please enter details manually.';
        }

        setExtractionMethod(method);
        setExtractionStatusMessage(message);

      } catch (err: any) {
        console.error('Extraction failed:', err);
        setExtractionMethod('manual');
        setExtractionStatusMessage('Could not process the label images. Please enter details manually.');
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
        setStep('form');
      }
    } else {
      setFormData(getEmptyFormData());
      setConfidence({});
      setSourceMap({});
      setExtractionDiagnostics(null);
      setExtractionMethod('manual');
      setExtractionStatusMessage('');
      setStep('form');
    }
  };

  const handleRunInspection = useCallback(() => {
    setIsProcessing(true);

    const inspection = runInspection(formData);

    const newReport: InspectionReport = {
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      productName: formData.productName || 'Unnamed Product',
      brand: formData.brand,
      category: formData.category,
      overallStatus: inspection.overallStatus,
      complianceScore: inspection.complianceScore,
      results: inspection.results,
      formData,
      images,
      disclaimer:
        'This is an inspection-assistance prototype. It does not constitute a final legal determination or legal advice. Refer to authorized Legal Metrology officers for official enforcement decisions.',
    };

    storage.saveReport(newReport);
    setReport(newReport);
    setStep('report');
    setIsProcessing(false);
  }, [formData, images]);

  const handleNewInspection = () => {
    setImages([]);
    setFormData(getEmptyFormData());
    setReport(null);
    setConfidence({});
    setSourceMap({});
    setExtractionDiagnostics(null);
    setExtractionMethod('manual');
    setExtractionStatusMessage('');
    setStep('images');
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('images');
    } else if (step === 'report') {
      setStep('form');
    }
  };

  if (step === 'report' && report) {
    return (
      <InspectionReportView
        report={report}
        onBack={handleBack}
        onNewInspection={handleNewInspection}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {(['images', 'form'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step === s
                  ? 'bg-navy-800 text-white'
                  : i < ['images', 'form'].indexOf(step)
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm font-medium ${
                step === s ? 'text-navy-900' : 'text-gray-400'
              }`}
            >
              {s === 'images' ? 'Capture Labels' : 'Enter Details'}
            </span>
            {i < 1 && (
              <div className="w-8 h-0.5 bg-gray-200 mx-2" />
            )}
          </div>
        ))}
      </div>

      {/* Step: Image Capture */}
      {step === 'images' && (
        <>
          <CameraCapture images={images} onImagesChange={setImages} />

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" onClick={() => router.push('/')} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleContinueToForm} disabled={isProcessing}>
              {isProcessing
                ? (visionAIAvailable ? 'Extracting via Vision AI + OCR...' : 'Extracting via OCR...')
                : images.length > 0
                  ? (visionAIAvailable ? 'Run Hybrid Extraction →' : 'Run OCR & Continue →')
                  : 'Continue to Form →'}
            </Button>
          </div>
        </>
      )}

      {/* Step: Form */}
      {step === 'form' && (
        <>
          {/* Demo samples */}
          <Card className="bg-navy-50 border-navy-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-navy-800">
                🎯 Load Demo Sample
              </h3>
              <span className="text-xs text-navy-500">
                Pre-filled data for hackathon demo
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {getDemoSampleKeys().map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  onClick={() => handleLoadDemo(key)}
                  disabled={isProcessing}
                >
                  {getDemoSampleLabel(key)}
                </Button>
              ))}
            </div>
          </Card>

          <InspectionForm
            formData={formData}
            onChange={setFormData}
            confidence={confidence}
            extractionMethod={extractionMethod}
            statusMessage={extractionStatusMessage}
            extractionDiagnostics={extractionDiagnostics}
            sourceMap={sourceMap}
          />

          <div className="flex flex-col sm:flex-row gap-3 justify-between sticky bottom-4 bg-gray-50 py-3 px-4 rounded-lg border shadow-lg">
            <Button variant="ghost" onClick={handleBack}>
              ← Back to Images
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleRunInspection}
              disabled={isProcessing || !formData.productName.trim()}
            >
              {isProcessing ? 'Processing...' : '🔍 Run Inspection'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
