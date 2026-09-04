import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Nirikshak AI — Label Compliance Inspector',
  description:
    'Mobile-first packaged-product label compliance inspection assistant for field officers. Prototype for Smart India Hackathon SIH26034.',
  keywords: [
    'Legal Metrology',
    'Packaged Commodities',
    'Label Compliance',
    'Inspection',
    'India',
    'Smart India Hackathon',
  ],
  authors: [{ name: 'Nirikshak AI Team' }],
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a2847',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
          <footer className="print:hidden py-4 text-center text-xs text-gray-400 border-t border-gray-100">
            Nirikshak AI • Inspection-assistance prototype • Not a final legal determination
          </footer>
        </div>
      </body>
    </html>
  );
}
