'use client';

import type { InspectionStatus, RuleResultStatus } from '@/types';

const inspectionStatusConfig: Record<
  InspectionStatus,
  { label: string; className: string }
> = {
  compliant: {
    label: 'Compliant',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  'needs-review': {
    label: 'Needs Review',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  'potential-non-compliance': {
    label: 'Potential Non-Compliance',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  'not-applicable': {
    label: 'Not Applicable',
    className: 'bg-gray-100 text-gray-600 border-gray-300',
  },
};

const ruleStatusConfig: Record<
  RuleResultStatus,
  { label: string; className: string; icon: string }
> = {
  pass: {
    label: 'Pass',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: '✓',
  },
  warning: {
    label: 'Warning',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: '⚠',
  },
  fail: {
    label: 'Fail',
    className: 'bg-red-100 text-red-800 border-red-300',
    icon: '✗',
  },
  'needs-review': {
    label: 'Needs Review',
    className: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: '?',
  },
  'not-applicable': {
    label: 'N/A',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
    icon: '—',
  },
};

interface StatusBadgeProps {
  status: InspectionStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = inspectionStatusConfig[status];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${config.className} ${sizeClasses[size]}`}
      role="status"
    >
      {config.label}
    </span>
  );
}

interface RuleStatusBadgeProps {
  status: RuleResultStatus;
  size?: 'sm' | 'md';
}

export function RuleStatusBadge({ status, size = 'md' }: RuleStatusBadgeProps) {
  const config = ruleStatusConfig[status];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.className} ${sizeClasses[size]}`}
      role="status"
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  );
}
