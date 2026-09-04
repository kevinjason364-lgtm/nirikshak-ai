'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { storage } from '@/lib/storage';
import { seedDemoData } from '@/lib/seed-data';
import type { InspectionHistoryEntry, InspectionStatus } from '@/types';

export default function DashboardPage() {
  const [history, setHistory] = useState<InspectionHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    seedDemoData().then(() => {
      setHistory(storage.getHistory());
      setIsLoading(false);
    });
  }, []);

  const statusCounts = {
    compliant: history.filter((h) => h.overallStatus === 'compliant').length,
    'needs-review': history.filter((h) => h.overallStatus === 'needs-review').length,
    'potential-non-compliance': history.filter((h) => h.overallStatus === 'potential-non-compliance').length,
    'not-applicable': history.filter((h) => h.overallStatus === 'not-applicable').length,
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight">
          Nirikshak AI
        </h1>
        <p className="text-gray-500 mt-1">
          Packaged Product Label Compliance Inspector
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Prototype for Smart India Hackathon — SIH26034
        </p>
      </div>

      {/* Start Inspection */}
      <Card className="text-center py-8">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-navy-800 mb-2">
            Start New Inspection
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Capture product label images and verify Legal Metrology compliance
            for packaged commodities.
          </p>
          <Link href="/inspect">
            <Button size="lg" fullWidth>
              🔍 Start Inspection
            </Button>
          </Link>
        </div>
      </Card>

      {/* Disclaimer */}
      <Disclaimer />

      {/* Status Overview */}
      {!isLoading && history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: 'compliant' as InspectionStatus, label: 'Compliant', emoji: '✅', bg: 'bg-emerald-50 border-emerald-200' },
            { key: 'needs-review' as InspectionStatus, label: 'Needs Review', emoji: '🔍', bg: 'bg-amber-50 border-amber-200' },
            { key: 'potential-non-compliance' as InspectionStatus, label: 'Non-Compliance', emoji: '⚠️', bg: 'bg-red-50 border-red-200' },
            { key: 'not-applicable' as InspectionStatus, label: 'N/A', emoji: '—', bg: 'bg-gray-50 border-gray-200' },
          ]).map(({ key, label, emoji, bg }) => (
            <div
              key={key}
              className={`rounded-lg border p-3 text-center ${bg}`}
            >
              <div className="text-2xl mb-1">{emoji}</div>
              <div className="text-2xl font-bold text-navy-900">
                {statusCounts[key]}
              </div>
              <div className="text-xs text-gray-600">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold text-navy-900 mb-3">
          Local Inspection History
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Records are stored locally on this device. They do not sync across devices.
        </p>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : history.length === 0 ? (
          <Card className="text-center py-8 text-gray-500">
            <p>No inspections yet.</p>
            <p className="text-sm mt-1">
              Start an inspection to see results here.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <Link
                key={entry.id}
                href={`/report/${entry.id}`}
                className="block"
              >
                <Card
                  padding="sm"
                  className="hover:border-navy-300 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy-900 truncate">
                        {entry.productName || 'Unnamed Product'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.brand ? `${entry.brand} • ` : ''}
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <div className="text-lg font-bold text-navy-900">
                          {entry.complianceScore}
                        </div>
                        <div className="text-xs text-gray-400">Score</div>
                      </div>
                      <StatusBadge status={entry.overallStatus} size="sm" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
