import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Santaquin Farms – Irrigation Scheduler',
  description: 'Farm irrigation scheduling for Santaquin Farms',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
