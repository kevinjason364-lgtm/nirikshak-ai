export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-gray-500 italic text-center">
        Inspection-assistance prototype — not a final legal determination or legal advice.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <span className="text-amber-600 text-lg flex-shrink-0" aria-hidden="true">⚖️</span>
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Prototype Disclaimer</p>
          <p>
            This is an inspection-assistance prototype tool developed for the Smart India
            Hackathon. It does not constitute a final legal determination, official
            enforcement decision, or legal advice. All rule checks are based on manually
            maintained JSON data and may not reflect the latest amendments or
            notifications. Refer to the{' '}
            <a
              href="https://consumeraffairs.gov.in/pages/legal-metrology-act"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-amber-900"
            >
              official Legal Metrology Act
            </a>{' '}
            and consult authorized Legal Metrology officers for official decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
