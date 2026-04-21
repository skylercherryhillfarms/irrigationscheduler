'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const path = usePathname();

  return (
    <header style={{ backgroundColor: '#27500A' }} className="text-white shadow-md">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Logo / Brand */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
            <Image src="/logo.png" alt="Cherry Hill Farms" width={40} height={40} className="object-contain" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">Cherry Hill Farms</div>
            <div className="text-xs text-green-200">Utah Irrigation Scheduler</div>
          </div>
        </div>

        <nav className="flex gap-1">
          <Link
            href="/master-schedule"
            className={`px-3 sm:px-4 py-2 min-h-[44px] inline-flex items-center rounded-md text-sm font-medium transition-colors ${
              path === '/master-schedule'
                ? 'bg-white/20 text-white'
                : 'text-green-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="hidden sm:inline">Master Schedule</span>
            <span className="sm:hidden">Schedule</span>
          </Link>
          <Link
            href="/manager-portal"
            className={`px-3 sm:px-4 py-2 min-h-[44px] inline-flex items-center rounded-md text-sm font-medium transition-colors ${
              path === '/manager-portal'
                ? 'bg-white/20 text-white'
                : 'text-green-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="hidden sm:inline">Manager Portal</span>
            <span className="sm:hidden">Manager</span>
          </Link>
          <Link
            href="/set-maps"
            className={`px-3 sm:px-4 py-2 min-h-[44px] inline-flex items-center rounded-md text-sm font-medium transition-colors ${
              path === '/set-maps'
                ? 'bg-white/20 text-white'
                : 'text-green-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="hidden sm:inline">Set Maps</span>
            <span className="sm:hidden">Maps</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
