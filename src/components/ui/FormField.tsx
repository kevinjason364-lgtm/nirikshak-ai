import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  confidence?: number | null;
  source?: 'ocr' | 'ai' | 'ocr+ai' | 'manual' | string;
}

function SourceBadge({ source, confidence }: { source?: string; confidence?: number | null }) {
  if (!source && (confidence === null || confidence === undefined)) return null;

  let bgColor = 'bg-gray-100 text-gray-600 border-gray-200';
  let label = 'Not detected';
  const confText = confidence ? ` (${Math.round(confidence)}%)` : '';

  if (source === 'manual') {
    bgColor = 'bg-amber-50 text-amber-700 border-amber-200';
    label = `Needs Review${confText}`;
  } else if (source === 'ocr+ai') {
    bgColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    label = `OCR + AI${confText}`;
  } else if (source === 'ai') {
    bgColor = 'bg-purple-50 text-purple-700 border-purple-200';
    label = `AI detected${confText}`;
  } else if (source === 'ocr') {
    if (confidence && confidence >= 80) {
      bgColor = 'bg-teal-50 text-teal-700 border-teal-200';
      label = `OCR High${confText}`;
    } else if (confidence && confidence >= 60) {
      bgColor = 'bg-amber-50 text-amber-700 border-amber-200';
      label = `OCR Medium${confText}`;
    } else {
      bgColor = 'bg-teal-50 text-teal-700 border-teal-200';
      label = `OCR detected${confText}`;
    }
  } else if (confidence !== null && confidence !== undefined) {
    // Fallback when only confidence is provided
    if (confidence >= 80) {
      bgColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      label = `OCR: High (${Math.round(confidence)}%)`;
    } else if (confidence >= 60) {
      bgColor = 'bg-amber-50 text-amber-700 border-amber-200';
      label = `OCR: Medium (${Math.round(confidence)}%)`;
    } else if (confidence > 0) {
      bgColor = 'bg-red-50 text-red-700 border-red-200';
      label = `OCR: Low (${Math.round(confidence)}%)`;
    }
  }

  return (
    <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded border ${bgColor}`}>
      {label}
    </span>
  );
}

export function FormField({ label, required, error, hint, children, confidence, source }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        <SourceBadge source={source} confidence={confidence} />
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
