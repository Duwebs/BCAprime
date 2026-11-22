/**
 * Single Source of Truth for BCAPrime Colleges
 * src/constants/colleges.ts
 *
 * Contains:
 * - BCA_BASE_COLLEGES: Canonical colleges from the Onboarding list and central hubs.
 * - BCA_COLLEGES: Complete merged base list.
 * - Helper functions for monogram, badge color, name normalization, and dynamic merging.
 */

export interface CollegeItem {
  id: string;
  name: string;
  isCustom?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface CustomCollegeRecord {
  id?: string | number;
  name: string;
  submitted_by?: string;
  submitted_by_name?: string;
  status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export const BCA_BASE_COLLEGES: [string, string][] = [
  ['all', 'All Colleges'],
  ['amity', 'Amity University'],
  ['adbu', 'Assam Don Bosco University'],
  ['avviare', 'Avviare Educational Hub'],
  ['banasthali', 'Banasthali Vidyapith'],
  ['bvp', 'Bharati Vidyapeeth'],
  ['bitmesra', 'BIT Mesra'],
  ['cu', 'Chandigarh University'],
  ['chitkara', 'Chitkara University'],
  ['christ', 'Christ University'],
  ['davv', 'DAVV (Devi Ahilya Vishwavidyalaya)'],
  ['gauhati', 'Gauhati University'],
  ['glocal', 'Glocal University'],
  ['goa', 'Goa University'],
  ['geu', 'Graphic Era University'],
  ['hpu', 'Himachal Pradesh University'],
  ['kiit', 'KIIT University'],
  ['kuk', 'Kurukshetra University'],
  ['manipur', 'Manipur University'],
  ['mizoram', 'Mizoram University'],
  ['nagaland', 'Nagaland University'],
  ['nirma', 'Nirma University'],
  ['pu', 'Panjab University'],
  ['patna', 'Patna University'],
  ['pondi', 'Pondicherry University'],
  ['rgu', 'Rajiv Gandhi University'],
  ['smu', 'Sikkim Manipal University'],
  ['srm', 'SRM Institute of Science and Technology'],
  ['tripura', 'Tripura University'],
  ['uok', 'University of Kashmir'],
  ['kerala', 'University of Kerala'],
  ['ccsu', 'CCSU Meerut'],
  ['du', 'Delhi University'],
  ['ipu', 'GGSIPU Delhi'],
  ['aktu', 'AKTU / UPTU'],
  ['ignou', 'IGNOU'],
  ['mdu', 'MDU Rohtak'],
  ['bhu', 'BHU'],
  ['pune', 'Pune University'],
  ['bangalore', 'Bangalore University'],
  ['other', 'Other University']
];

export const BCA_COLLEGES: [string, string][] = [...BCA_BASE_COLLEGES];

export const COLLEGE_NAMES_MAP: Record<string, string> = BCA_BASE_COLLEGES.reduce((acc, [id, name]) => {
  acc[id] = name;
  return acc;
}, {} as Record<string, string>);

export const CUSTOM_MONOGRAMS: Record<string, string> = {
  amity: 'AU',
  adbu: 'AD',
  avviare: 'AE',
  banasthali: 'BV',
  bvp: 'BV',
  bitmesra: 'BM',
  cu: 'CU',
  chitkara: 'CU',
  christ: 'CU',
  davv: 'DA',
  gauhati: 'GU',
  glocal: 'GU',
  goa: 'GU',
  geu: 'GE',
  hpu: 'HP',
  kiit: 'KU',
  kuk: 'KU',
  manipur: 'MU',
  mizoram: 'MU',
  nagaland: 'NU',
  nirma: 'NU',
  pu: 'PU',
  patna: 'PU',
  pondi: 'PU',
  rgu: 'RG',
  smu: 'SM',
  srm: 'SR',
  tripura: 'TU',
  uok: 'UK',
  kerala: 'UK',
  ccsu: 'CC',
  du: 'DU',
  ipu: 'GG'
};

export const BADGE_COLORS: Record<string, string> = {
  amity: '#2563eb',
  adbu: '#059669',
  avviare: '#2563eb',
  banasthali: '#db2777',
  bvp: '#7c3aed',
  bitmesra: '#d97706',
  cu: '#dc2626',
  chitkara: '#ea580c',
  christ: '#4f46e5',
  davv: '#0891b2',
  gauhati: '#16a34a',
  glocal: '#16a34a',
  goa: '#0284c7',
  geu: '#9333ea',
  hpu: '#e11d48',
  kiit: '#0d9488',
  kuk: '#6366f1',
  manipur: '#059669',
  mizoram: '#ca8a04',
  nagaland: '#2563eb',
  nirma: '#dc2626',
  pu: '#4338ca',
  patna: '#0891b2',
  pondi: '#0d9488',
  rgu: '#7c3aed',
  smu: '#0284c7',
  srm: '#ea580c',
  tripura: '#16a34a',
  uok: '#4f46e5',
  kerala: '#059669',
  ccsu: '#3b82f6',
  du: '#1e40af',
  ipu: '#dc2626'
};

/**
 * Generate Badge Monogram & Color for a college
 */
export function getCollegeBadgeData(id: string, name?: string): { monogram: string; color: string } {
  let monogram = CUSTOM_MONOGRAMS[id];
  if (!monogram && name) {
    const clean = name
      .replace(/\([^)]*\)/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => !['of', 'and', 'the', 'in', 'for', '&'].includes(w.toLowerCase()));
    if (clean.length >= 2) {
      monogram = (clean[0][0] + clean[1][0]).toUpperCase();
    } else if (clean.length === 1 && clean[0].length >= 2) {
      monogram = clean[0].slice(0, 2).toUpperCase();
    } else {
      monogram = (name.slice(0, 2) || 'BC').toUpperCase();
    }
  }
  if (!monogram) monogram = 'BC';

  let color = BADGE_COLORS[id];
  if (!color) {
    const colors = ['#2563eb', '#16a34a', '#7c3aed', '#dc2626', '#d97706', '#0284c7', '#4f46e5', '#0d9488', '#e11d48'];
    let hash = 0;
    const str = name || id || 'bca';
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    color = colors[Math.abs(hash) % colors.length];
  }

  return { monogram, color };
}

/**
 * Normalize college name to slug id
 */
export function slugifyCollege(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-college';
}

/**
 * Format college code/id to human readable title
 */
export function formatCollegeName(codeOrId: string, customList: [string, string][] = []): string {
  if (!codeOrId) return 'All Colleges';
  const c = String(codeOrId).toLowerCase().trim();
  if (c === 'all') return 'All Colleges';
  if (c === 'other') return 'Other Colleges';
  if (COLLEGE_NAMES_MAP[c]) return COLLEGE_NAMES_MAP[c];
  const foundInCustom = customList.find(item => item[0].toLowerCase() === c);
  if (foundInCustom) return foundInCustom[1];
  return codeOrId.replace(/^custom-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Merge Base Colleges with approved custom colleges from Supabase or localStorage
 */
export function mergeColleges(
  baseList: [string, string][] = BCA_BASE_COLLEGES,
  approvedCustom: { id?: string; name: string }[] = []
): [string, string][] {
  const merged: [string, string][] = [...baseList];
  const seenNames = new Set(baseList.map(b => b[1].toLowerCase().trim()));
  const seenIds = new Set(baseList.map(b => b[0].toLowerCase().trim()));

  for (const item of approvedCustom) {
    const name = String(item.name || '').trim();
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (seenNames.has(nameLower)) continue;

    let id = item.id ? String(item.id).toLowerCase().trim() : 'custom-' + slugifyCollege(name);
    if (seenIds.has(id)) {
      id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
    }

    seenNames.add(nameLower);
    seenIds.add(id);

    // Insert custom colleges right before 'other'
    const otherIdx = merged.findIndex(c => c[0] === 'other');
    if (otherIdx !== -1) {
      merged.splice(otherIdx, 0, [id, name]);
    } else {
      merged.push([id, name]);
    }
  }

  return merged;
}
