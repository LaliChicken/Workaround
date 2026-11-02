import { areaById } from '../data/areas';
import type { Job, LatLng } from './types';

const EARTH_RADIUS_MI = 3958.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line (great-circle) distance in miles. Not travel distance or time. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/** Distance from the student's chosen search area to a job, rounded to 0.1 mi. */
export function jobDistance(job: Job, areaId: string): number {
  return Math.round(milesBetween(areaById(areaId).center, job.location) * 10) / 10;
}

export function jobDistances(jobs: Job[], areaId: string): Record<string, number> {
  return Object.fromEntries(jobs.map((j) => [j.id, jobDistance(j, areaId)]));
}
