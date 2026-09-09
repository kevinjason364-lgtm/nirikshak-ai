import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import type { FieldExtractionMeta, QualitativeConfidence } from '@/lib/vision/types';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  confidence?: number | null;
  source?: 'ocr' | 'ai' | 'ocr+ai' | 'manual' | string;
  metadata?: FieldExtractionMeta;
}

function SourceBadge({ source, confidence, metadata }: { source?: string; confidence?: number | null; metadata?: FieldExtractionMeta }) {
  if (!source && (confidence === null || confidence === undefined) && !metadata) return null;

  const resolvedSource = metadata?.source || source;
  const rawScore = metadata?.confidence ?? confidence;

  // Derive qualitative confidence if not explicitly provided
  let qualConf: QualitativeConfidence | undefined = metadata?.qualitativeConfidence;

  if (!qualConf && rawScore !== null && rawScore !== undefined) {
    if (resolvedSource === 'manual') qualConf = 'Needs Review';
    else if (resolvedSource === 'ocr+ai') qualConf = 'High';
    else if (rawScore >= 80) qualConf = 'High';
    else if (rawScore >= 60) qualConf = 'Medium';
    else qualConf = 'Low';
  }

  let bgColor = 'bg-gray-100 text-gray-600 border-gray-200';
  let label = 'Not detected';

  if (resolvedSource === 'manual' || qualConf === 'Needs Review') {
    bgColor = 'bg-amber-100 text-amber-800 border-amber-300';
    label = 'Needs Review';
  } else if (resolvedSource === 'ocr+ai') {
    bgColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    label = 'OCR + AI (High)';
  } else if (resolvedSource === 'ai') {
    if (qualConf === 'High') {
      bgColor = 'bg-purple-100 text-purple-800 border-purple-300';
      label = 'AI (High)';
    } else if (qualConf === 'Medium') {
      bgColor = 'bg-purple-50 text-purple-700 border-purple-200';
      label = 'AI (Medium)';
    } else {
      bgColor = 'bg-gray-100 text-gray-600 border-gray-200';
      label = 'AI (Low)';
    }
  } else if (resolvedSource === 'ocr' || rawScore !== null) {
    if (qualConf === 'High') {
      bgColor = 'bg-teal-100 text-teal-800 border-teal-300';
      label = 'OCR (High)';
    } else if (qualConf === 'Medium') {
      bgColor = 'bg-teal-50 text-teal-700 border-teal-200';
      label = 'OCR (Medium)';
    } else {
      bgColor = 'bg-red-50 text-red-700 border-red-200';
      label = 'OCR (Low)';
    }
  }

  const sideLabel = metadata?.sourceSide && metadata.sourceSide !== 'unknown'
    ? ` • ${metadata.sourceSide.toUpperCase()}`
    : '';

  return (
    <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded border ${bgColor}`}>
      {label}{sideLabel}
    </span>
  );
}

export function FormField({ label, required, error, hint, children, confidence, source, metadata }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        <SourceBadge source={source} confidence={confidence} metadata={metadata} />
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 ${
        error
          ? 'border-red-300 bg-red-50 focus:ring-red-400 focus:border-red-400'
          : 'border-gray-300 bg-white hover:border-gray-400'
      } ${className}`}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 ${
        error
          ? 'border-red-300 bg-red-50 focus:ring-red-400 focus:border-red-400'
          : 'border-gray-300 bg-white hover:border-gray-400'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-navy-400 resize-y ${
        error
          ? 'border-red-300 bg-red-50 focus:ring-red-400 focus:border-red-400'
          : 'border-gray-300 bg-white hover:border-gray-400'
      } ${className}`}
      {...props}
    />
  );
}
