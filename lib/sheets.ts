import { SheetRow } from './types';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/15JjZQPJ5M2D6wjA230gtaOJZ9lTwg3CSHhDw7RLfyf4/export?format=csv&gid=0';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface Cache {
  data: SheetRow[];
  fetchedAt: number;
}

// Module-level cache (survives across requests in the same Node process)
let cache: Cache | null = null;

function parseNum(val: string): number | null {
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseCSV(raw: string): SheetRow[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header row using the same quoted-CSV parser as data rows
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  // Prefer exact match, fall back to substring match
  const colIdx = (name: string) => {
    const exact = headers.findIndex((h) => h === name);
    return exact >= 0 ? exact : headers.findIndex((h) => h.includes(name));
  };

  const iLocation = colIdx('location');
  const iSetName = colIdx('set name');
  const iGrouping = colIdx('grouping');
  const iAcres = colIdx('acres');
  const iGpm = colIdx('gpm');
  const iBlock = colIdx('block');
  const iBlockDesc = colIdx('block description');

  const rows: SheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const cells = splitCSVLine(lines[i]);
    const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');

    const location = get(iLocation);
    const setName = get(iSetName);
    if (!location && !setName) continue;

    rows.push({
      location,
      setName,
      grouping: get(iGrouping),
      acres: parseNum(get(iAcres)),
      gpm: parseNum(get(iGpm)),
      block: get(iBlock),
      blockDescription: iBlockDesc >= 0 ? get(iBlockDesc) : '',
    });
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export async function fetchSets(forceRefresh = false): Promise<SheetRow[]> {
  const now = Date.now();

  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const res = await fetch(SHEET_CSV_URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = parseCSV(text);
    cache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    console.error('Failed to fetch sheet data:', err);
    // Return stale cache if available
    if (cache) return cache.data;
    return [];
  }
}
