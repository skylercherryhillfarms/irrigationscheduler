'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const path = usePathname();

  return (
    <header style={{ backgroundColor: '#27500A' }} className="text-white shadow-md">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Logo / Brand */}
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
            🌱
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Santaquin Farms</div>
            <div className="text-xs text-green-200">Irrigation Scheduler</div>
          </div>
        </div>

        <nav className="flex gap-1">
          <Link
            href="/master-schedule"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              path === '/master-schedule'
                ? 'bg-white/20 text-white'
                : 'text-green-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            📅 Master Schedule
          </Link>
          <Link
            href="/manager-portal"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              path === '/manager-portal'
                ? 'bg-white/20 text-white'
                : 'text-green-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            ⚙️ Manager Portal
          </Link>
        </nav>
      </div>
    </header>
  );
}
