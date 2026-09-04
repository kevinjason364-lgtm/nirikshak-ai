'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { InspectionReportView } from '@/components/inspection/InspectionReport';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { InspectionReport as ReportType } from '@/types';

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<ReportType | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = params?.id as string;
    if (id) {
      const saved = storage.getReport(id);
      if (saved) {
        setReport(saved);
      } else {
        setNotFound(true);
      }
    }
  }, [params?.id]);

  if (notFound) {
    return (
      <div className="text-center py-12">
        <Card className="max-w-md mx-auto">
          <h1 className="text-xl font-bold text-navy-900 mb-2">Report Not Found</h1>
          <p className="text-gray-500 mb-4">
            This inspection report may have been deleted or the link is invalid.
          </p>
          <Button onClick={() => router.push('/')}>Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse text-gray-400">Loading report...</div>
      </div>
    );
  }

  return <InspectionReportView report={report} onBack={() => router.push('/')} />;
}