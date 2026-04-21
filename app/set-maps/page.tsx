'use client';

import NavBar from '@/components/NavBar';

// Add your PDF files to /public/maps/ and list them here.
// Example: { label: 'Genola – Block A', file: 'genola-block-a.pdf' }
const MAPS: { label: string; file: string }[] = [
  { label: 'Santaquin', file: 'Santaquin Maps.pdf' },
  { label: 'Alpine', file: 'Alpine Map.pdf' },
];

export default function SetMapsPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8faf4' }}>
      <NavBar />

      <div style={{ backgroundColor: '#27500A' }} className="text-white px-4 py-4">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-2xl font-bold">Set Maps</h1>
          <p className="text-green-200 text-sm">PDF irrigation set maps by location</p>
        </div>
      </div>

      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        {MAPS.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <p className="text-lg font-medium">No maps uploaded yet</p>
            <p className="text-sm mt-1">Add PDF files to <code className="bg-gray-100 px-1 rounded">public/maps/</code> and register them in <code className="bg-gray-100 px-1 rounded">app/set-maps/page.tsx</code></p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {MAPS.map(({ label, file }) => (
              <div key={file} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div style={{ backgroundColor: '#27500A' }} className="text-white px-4 py-3 flex items-center justify-between">
                  <span className="font-semibold text-sm">{label}</span>
                  <a
                    href={`/Maps/${file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Open ↗
                  </a>
                </div>
                {/* Desktop: embedded iframe */}
                <div className="hidden md:block h-[800px]">
                  <iframe
                    src={`/Maps/${file}#view=FitH`}
                    className="w-full h-full border-0"
                    title={label}
                  />
                </div>
                {/* Mobile: tap-to-open card */}
                <a
                  href={`/Maps/${file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md:hidden flex flex-col items-center justify-center gap-3 py-12 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-4xl">🗺️</span>
                  <span className="text-sm font-medium text-green-700">Tap to open {label} map</span>
                  <span className="text-xs text-gray-400">Opens in your browser's PDF viewer</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
