'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, RuleStatusBadge } from '@/components/ui/StatusBadge';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { Disclaimer } from '@/components/ui/Disclaimer';
import type { InspectionReport as ReportType, RuleResultStatus, CapturedImage } from '@/types';
import { getRulesMetadata } from '@/lib/rule-engine';

interface InspectionReportViewProps {
  report: ReportType;
  onBack: () => void;
}

type FilterType = 'all' | RuleResultStatus;

export function InspectionReportView({ report, onBack }: InspectionReportViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const metadata = getRulesMetadata();

  const filteredResults = useMemo(() => {
    if (filter === 'all') return report.results;
    return report.results.filter((r) => r.status === filter);
  }, [report.results, filter]);

  const counts = useMemo(() => {
    return {
      pass: report.results.filter((r) => r.status === 'pass').length,
      warning: report.results.filter((r) => r.status === 'warning').length,
      fail: report.results.filter((r) => r.status === 'fail').length,
      'needs-review': report.results.filter((r) => r.status === 'needs-review').length,
      'not-applicable': report.results.filter((r) => r.status === 'not-applicable').length,
    };
  }, [report.results]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print header (visible only in print) */}
      <div className="hidden print:block mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-white font-bold text-sm">
            N
          </div>
          <div>
            <h1 className="text-lg font-bold">Nirikshak AI — Inspection Report</h1>
            <p className="text-xs text-gray-500">Packaged Product Label Compliance Inspector</p>
          </div>
        </div>
      </div>

      {/* Actions (hidden in print) */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          🖨️ Print / Save PDF
        </Button>
      </div>

      {/* Disclaimer */}
      <Disclaimer />

      {/* Summary Card */}
      <Card className="print:border print:shadow-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={report.complianceScore} />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-navy-900">{report.productName}</h2>
            {report.brand && (
              <p className="text-sm text-gray-500">Brand: {report.brand}</p>
            )}
            <p className="text-sm text-gray-500 capitalize">
              Category: {report.category}
              {report.formData.isImported && ' • Imported'}
            </p>
            <div className="mt-2">
              <StatusBadge status={report.overallStatus} size="lg" />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Inspected: {new Date(report.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </Card>

      {/* Status counts */}
      <div className="grid grid-cols-5 gap-2 text-center">
        {([
          { key: 'pass' as const, label: 'Pass', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { key: 'warning' as const, label: 'Warning', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
          { key: 'fail' as const, label: 'Fail', bg: 'bg-red-50 border-red-200 text-red-700' },
          { key: 'needs-review' as const, label: 'Review', bg: 'bg-sky-50 border-sky-200 text-sky-700' },
          { key: 'not-applicable' as const, label: 'N/A', bg: 'bg-gray-50 border-gray-200 text-gray-500' },
        ] as const).map(({ key, label, bg }) => (
          <div key={key} className={`rounded-lg border p-2 ${bg}`}>
            <div className="text-2xl font-bold">{counts[key]}</div>
            <div className="text-xs font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Product images */}
      {report.images.length > 0 && (
        <Card className="print:break-inside-avoid">
          <h3 className="text-base font-semibold text-navy-900 mb-3">Visual Evidence</h3>
          <p className="text-xs text-gray-500 mb-3">
            Captured images for reference only. No automated image interpretation was performed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.images.map((img: CapturedImage) => (
              <div key={img.id} className="rounded-lg overflow-hidden border">
                <img
                  src={img.dataUrl}
                  alt={`Product label — ${img.label}`}
                  className="w-full aspect-[4/3] object-cover"
                />
                <div className="px-2 py-1 bg-gray-50 text-xs text-gray-600 text-center capitalize">
                  {img.label.replace('-', ' / ')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {([
          { key: 'all' as FilterType, label: 'All', count: report.results.length },
          { key: 'pass' as FilterType, label: 'Pass', count: counts.pass },
          { key: 'warning' as FilterType, label: 'Warning', count: counts.warning },
          { key: 'fail' as FilterType, label: 'Fail', count: counts.fail },
          { key: 'needs-review' as FilterType, label: 'Needs Review', count: counts['needs-review'] },
          { key: 'not-applicable' as FilterType, label: 'N/A', count: counts['not-applicable'] },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filter === key
                ? 'bg-navy-800 text-white border-navy-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-navy-400'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filteredResults.map((result) => (
          <Card
            key={result.ruleId}
            padding="sm"
            className="print:break-inside-avoid print:border print:shadow-none"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {result.ruleId}
                  </span>
                  <RuleStatusBadge status={result.status} size="sm" />
                </div>
                <h4 className="font-semibold text-navy-900 mt-1 text-sm">{result.title}</h4>
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Evidence:</span>
                <p className="text-gray-700">{result.evidence}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Reason:</span>
                <p className="text-gray-700">{result.reason}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>Source:</span>
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-navy-600"
                >
                  {result.sourceReference}
                </a>
              </div>
            </div>
          </Card>
        ))}

        {filteredResults.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No results match the selected filter.
          </div>
        )}
      </div>

      {/* Rule source metadata */}
      <Card padding="sm" className="print:break-inside-avoid">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Rule Source Information</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Source:</span>
          <span>{metadata.sourceTitle}</span>
          <span>Version:</span>
          <span>{metadata.version}</span>
          <span>Effective Date:</span>
          <span>{metadata.effectiveDate}</span>
          <span>Last Verified:</span>
          <span>{metadata.lastManuallyVerifiedDate}</span>
          <span>Official URL:</span>
          <a
            href={metadata.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-navy-600"
          >
            {metadata.sourceUrl}
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-2 italic">{metadata.amendmentNotes}</p>
      </Card>

      {/* Footer disclaimer */}
      <Disclaimer compact />
    </div>
  );
}
