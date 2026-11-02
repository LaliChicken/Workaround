import type { LatLng } from '../lib/types';

/**
 * Approximate areas a student can search from. Students pick an area, never a
 * home address. Centre points are public landmarks, used only to estimate
 * straight-line distances.
 */
export interface SearchArea {
  id: string;
  label: string;
  /** Short form for inline text, e.g. "Foothill campus". */
  short: string;
  center: LatLng;
}

export const SEARCH_AREAS: SearchArea[] = [
  { id: 'foothill', label: 'Foothill College campus (Los Altos Hills)', short: 'Foothill campus', center: { lat: 37.3617, lng: -122.1286 } },
  { id: 'de-anza', label: 'De Anza College campus (Cupertino)', short: 'De Anza campus', center: { lat: 37.3194, lng: -122.045 } },
  { id: 'mountain-view', label: 'Downtown Mountain View', short: 'downtown Mountain View', center: { lat: 37.3934, lng: -122.079 } },
  { id: 'los-altos', label: 'Downtown Los Altos', short: 'downtown Los Altos', center: { lat: 37.3797, lng: -122.1146 } },
  { id: 'palo-alto', label: 'Palo Alto (California Ave)', short: 'California Ave, Palo Alto', center: { lat: 37.4275, lng: -122.143 } },
  { id: 'sunnyvale', label: 'Downtown Sunnyvale', short: 'downtown Sunnyvale', center: { lat: 37.3772, lng: -122.03 } },
];

export const DEFAULT_AREA_ID = 'foothill';

export const RADIUS_OPTIONS = [2, 5, 10, 15];

export function areaById(id: string): SearchArea {
  return SEARCH_AREAS.find((a) => a.id === id) ?? SEARCH_AREAS[0];
}
