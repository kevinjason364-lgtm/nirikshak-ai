'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-navy-900 text-white shadow-lg print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-saffron-500 flex items-center justify-center font-bold text-navy-900 text-lg">
            N
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              Nirikshak AI
            </h1>
            <p className="text-[10px] text-navy-300 leading-none tracking-wide uppercase">
              Label Compliance Inspector
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-navy-800 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/inspect"
            className="px-3 py-1.5 text-sm rounded-lg bg-saffron-500 text-navy-900 font-semibold hover:bg-saffron-400 transition-colors"
          >
            New Inspection
          </Link>
        </nav>
      </div>
    </header>
  );
}
