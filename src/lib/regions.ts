// Six operational zones used for the Super Admin "Zones" dashboard and
// leadership reporting. Each Indian state/UT is auto-aligned to exactly one
// zone — events and students inherit their zone from their `state` field.
export type ZoneId = 'north' | 'east' | 'west' | 'northeast' | 'south_tn' | 'south_other';

export interface ZoneConfig {
  id: ZoneId;
  name: string;
  shortLabel: string;
  states: string[];
  icon: string;
  color: string;
  bg: string;
}

export const ZONES: ZoneConfig[] = [
  {
    id: 'north',
    name: 'North',
    shortLabel: 'NR',
    states: [
      'Delhi', 'Haryana', 'Punjab', 'Himachal Pradesh', 'Uttarakhand',
      'Jammu and Kashmir', 'Ladakh', 'Uttar Pradesh', 'Rajasthan', 'Chandigarh',
    ],
    icon: 'north',
    color: 'text-primary',
    bg: 'bg-primary/8',
  },
  {
    id: 'east',
    name: 'East',
    shortLabel: 'ER',
    states: ['West Bengal', 'Odisha', 'Bihar', 'Jharkhand', 'Andaman and Nicobar Islands'],
    icon: 'east',
    color: 'text-tertiary-container',
    bg: 'bg-tertiary-fixed/15',
  },
  {
    id: 'west',
    name: 'West',
    shortLabel: 'WR',
    states: [
      'Maharashtra', 'Gujarat', 'Goa', 'Madhya Pradesh', 'Chhattisgarh',
      'Dadra and Nagar Haveli and Daman and Diu',
    ],
    icon: 'west',
    color: 'text-on-tertiary-container',
    bg: 'bg-tertiary/10',
  },
  {
    id: 'northeast',
    name: 'North East',
    shortLabel: 'NER',
    states: [
      'Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura',
      'Arunachal Pradesh', 'Sikkim',
    ],
    icon: 'explore',
    color: 'text-error',
    bg: 'bg-error/8',
  },
  {
    id: 'south_tn',
    name: 'South — Tamil Nadu',
    shortLabel: 'SR-TN',
    states: ['Tamil Nadu', 'Puducherry'],
    icon: 'south',
    color: 'text-secondary',
    bg: 'bg-secondary/8',
  },
  {
    id: 'south_other',
    name: 'South — TG/KA/KL/AP',
    shortLabel: 'SR',
    states: ['Telangana', 'Karnataka', 'Kerala', 'Andhra Pradesh', 'Lakshadweep'],
    icon: 'south',
    color: 'text-secondary',
    bg: 'bg-secondary/8',
  },
];

const STATE_TO_ZONE: Record<string, ZoneId> = (() => {
  const map: Record<string, ZoneId> = {};
  ZONES.forEach(zone => zone.states.forEach(state => { map[state] = zone.id; }));
  return map;
})();

/** Auto-aligns a state to one of the 6 zones. Returns null if the state is unrecognized. */
export const getZoneId = (state?: string | null): ZoneId | null =>
  state ? STATE_TO_ZONE[state] ?? null : null;

export const getZoneConfig = (zoneId: ZoneId): ZoneConfig =>
  ZONES.find(z => z.id === zoneId)!;

// Maps each city in EventsManager's CITIES list to its state, so picking a
// city can auto-fill the state (and from there, the zone).
export const CITY_STATE: Record<string, string> = {
  Agartala: 'Tripura', Agra: 'Uttar Pradesh', Ahmedabad: 'Gujarat', Aizawl: 'Mizoram',
  Ajmer: 'Rajasthan', Aligarh: 'Uttar Pradesh', Amravati: 'Maharashtra', Amritsar: 'Punjab',
  Asansol: 'West Bengal', Aurangabad: 'Maharashtra', Bengaluru: 'Karnataka', Bhopal: 'Madhya Pradesh',
  Bhubaneswar: 'Odisha', Bikaner: 'Rajasthan', Chandigarh: 'Chandigarh', Chennai: 'Tamil Nadu',
  Coimbatore: 'Tamil Nadu', Cuttack: 'Odisha', Dehradun: 'Uttarakhand', Delhi: 'Delhi',
  Dhanbad: 'Jharkhand', Dispur: 'Assam', Durgapur: 'West Bengal', Faridabad: 'Haryana',
  Ghaziabad: 'Uttar Pradesh', Guwahati: 'Assam', Gwalior: 'Madhya Pradesh', Hubli: 'Karnataka',
  Hyderabad: 'Telangana', Imphal: 'Manipur', Indore: 'Madhya Pradesh', Itanagar: 'Arunachal Pradesh',
  Jabalpur: 'Madhya Pradesh', Jaipur: 'Rajasthan', Jalandhar: 'Punjab', Jammu: 'Jammu and Kashmir',
  Jamshedpur: 'Jharkhand', Jodhpur: 'Rajasthan', Kanpur: 'Uttar Pradesh', Kochi: 'Kerala',
  Kohima: 'Nagaland', Kolkata: 'West Bengal', Lucknow: 'Uttar Pradesh', Ludhiana: 'Punjab',
  Madurai: 'Tamil Nadu', Mangaluru: 'Karnataka', Meerut: 'Uttar Pradesh', Mumbai: 'Maharashtra',
  Mysuru: 'Karnataka', Nagpur: 'Maharashtra', Nashik: 'Maharashtra', 'Navi Mumbai': 'Maharashtra',
  Noida: 'Uttar Pradesh', Panjim: 'Goa', Patna: 'Bihar', Pune: 'Maharashtra',
  Raipur: 'Chhattisgarh', Rajkot: 'Gujarat', Ranchi: 'Jharkhand', Shillong: 'Meghalaya',
  Shimla: 'Himachal Pradesh', Siliguri: 'West Bengal', Srinagar: 'Jammu and Kashmir', Surat: 'Gujarat',
  Thane: 'Maharashtra', Thiruvananthapuram: 'Kerala', Tiruchirappalli: 'Tamil Nadu', Vadodara: 'Gujarat',
  Varanasi: 'Uttar Pradesh', Vijayawada: 'Andhra Pradesh', Visakhapatnam: 'Andhra Pradesh', Warangal: 'Telangana',
};

export const getStateForCity = (city?: string | null): string | null =>
  city ? CITY_STATE[city] ?? null : null;

// ── Cross-zone constituency allocation ──────────────────────────
// Bulk-imported students are assigned a "seat" constituency from the
// opposite half of the country to their event's home state — students at
// a southern event (south_tn / south_other) get northern constituencies,
// and vice versa. This is purely flavour data for the simulation, not a
// real electoral mapping.
const SOUTH_ZONES: ZoneId[] = ['south_tn', 'south_other'];

const NORTHERN_CONSTITUENCIES = [
  'New Delhi', 'Amritsar', 'Lucknow', 'Varanasi', 'Jaipur', 'Chandigarh',
  'Patna Sahib', 'Kolkata Dakshin', 'Bhubaneswar', 'Ranchi', 'Indore',
  'Bhopal', 'Mumbai North', 'Pune', 'Ahmedabad East', 'Panaji', 'Shimla',
  'Dehradun', 'Guwahati', 'Shillong',
];

const SOUTHERN_CONSTITUENCIES = [
  'Chennai South', 'Madurai', 'Coimbatore', 'Puducherry', 'Bengaluru Central',
  'Mysuru', 'Hyderabad', 'Warangal', 'Visakhapatnam', 'Vijayawada',
  'Thiruvananthapuram', 'Ernakulam', 'Mangaluru', 'Tiruchirappalli',
  'Kanyakumari', 'Hubli-Dharwad', 'Kurnool', 'Kozhikode', 'Salem', 'Madikeri',
];

/** Returns the constituency pool from the opposite half of the country to `state`. */
export const getCrossZoneConstituencyPool = (state?: string | null): string[] => {
  const zone = getZoneId(state);
  return zone && SOUTH_ZONES.includes(zone) ? NORTHERN_CONSTITUENCIES : SOUTHERN_CONSTITUENCIES;
};

/** Deterministically picks a cross-zone constituency for the given index (e.g. serial number). */
export const getCrossZoneConstituency = (state: string | null | undefined, index: number): string => {
  const pool = getCrossZoneConstituencyPool(state);
  return pool[((index % pool.length) + pool.length) % pool.length];
};

// ── Level-based location columns ─────────────────────────────────
// "School" is always shown alongside student data. Additional location
// columns progressively appear based on the event's level: city events show
// just the school, regional events add City + State, and national events
// also add the Zone.
export type LocationColumn = 'city' | 'state' | 'zone';

export const getLocationColumns = (level?: string | null): LocationColumn[] => {
  if (level === 'national') return ['city', 'state', 'zone'];
  if (level === 'regional') return ['city', 'state'];
  return [];
};
