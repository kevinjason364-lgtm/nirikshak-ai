'use client';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({ score, size = 120, strokeWidth = 10 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;

  let color: string;
  if (score >= 80) color = '#059669'; // emerald-600
  else if (score >= 60) color = '#d97706'; // amber-600
  else if (score >= 40) color = '#ea580c'; // orange-600
  else color = '#dc2626'; // red-600

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`Compliance score: ${score}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-navy-900">{score}</span>
        <span className="text-xs text-gray-500 uppercase tracking-wide">Score</span>
      </div>
    </div>
  );
}
