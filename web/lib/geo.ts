export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
// Rough public-transport time from straight-line distance. Labelled as an estimate in the UI.
export const commuteMinutes = (m: number) => Math.round(8 + (m / 1000) * 3.2);

// Places a renter can pick as their commute target in the City of Sydney pilot.
export const PLACES = [
  { id: 'usyd', label: 'University of Sydney (Camperdown)', lat: -33.8886, lng: 151.1873 },
  { id: 'uts', label: 'UTS (Ultimo)', lat: -33.8832, lng: 151.2005 },
  { id: 'unsw', label: 'UNSW (Kensington)', lat: -33.9173, lng: 151.2313 },
  { id: 'nd', label: 'Notre Dame (Broadway)', lat: -33.8849, lng: 151.1966 },
  { id: 'cbd', label: 'Sydney CBD (Martin Place)', lat: -33.8679, lng: 151.2111 },
  { id: 'barangaroo', label: 'Barangaroo', lat: -33.8617, lng: 151.2015 },
  { id: 'rpa', label: 'RPA Hospital', lat: -33.8893, lng: 151.1812 },
] as const;
