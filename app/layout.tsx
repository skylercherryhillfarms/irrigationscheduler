import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cherry Hill Farms – Utah Irrigation Scheduler',
  description: 'Farm irrigation scheduling for Cherry Hill Farms',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
