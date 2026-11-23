import type { RestaurantTable } from '../types/restaurant';

export type BuildingFloorType = 'restaurant' | 'hotel';

export interface BuildingFloor {
  id: string;
  name: string;
  floorType: BuildingFloorType;
  widthFt: number;
  heightFt: number;
}

export const DEFAULT_RESTAURANT_FLOOR_NAME = 'Ground Floor';
export const DEFAULT_HOTEL_FLOOR_NAME = 'Floor 1';

function storageKey(businessId: string): string {
  return `vitaran_building_floors_v1_${businessId.trim()}`;
}

export function slugifyFloorName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'floor'
  );
}

/**
 * Normalizes raw floor labels stored in `table.tableLabel` (e.g., "1" on a room -> "Floor 1",
 * "Floor 2" -> "Floor 2") so existing tables & rooms map cleanly into dedicated floors.
 */
export function resolveTableFloorName(
  table: RestaurantTable,
  knownFloors: ReadonlyArray<BuildingFloor>,
): string {
  const isRoom = (table.locationType ?? 'table') === 'room';
  const floorType: BuildingFloorType = isRoom ? 'hotel' : 'restaurant';
  const rawLabel = (table.tableLabel ?? '').trim();

  if (rawLabel) {
    // Direct case-insensitive match against any configured floor of matching type
    const direct = knownFloors.find(
      (f) =>
        f.floorType === floorType &&
        f.name.trim().toLowerCase() === rawLabel.toLowerCase(),
    );
    if (direct) return direct.name;

    // For rooms, numeric labels like "1" or "2" normalize cleanly to "Floor 1", "Floor 2"
    if (isRoom && /^\d{1,2}$/.test(rawLabel)) {
      return `Floor ${rawLabel}`;
    }

    // For rooms, labels explicitly naming a floor/wing (e.g. "Floor 2", "2nd Floor", "Wing A") become their own floor
    if (isRoom && /floor|wing|level|suite|block/i.test(rawLabel)) {
      return rawLabel;
    }

    // For restaurant tables, labels explicitly mentioning a floor/rooftop/terrace/hall
    if (!isRoom && /floor|rooftop|terrace|mezzanine|patio|hall/i.test(rawLabel)) {
      return rawLabel;
    }
  }

  // Fallback to the first configured floor of the matching type, or sensible default
  const firstMatching = knownFloors.find((f) => f.floorType === floorType);
  if (firstMatching) return firstMatching.name;
  return isRoom ? DEFAULT_HOTEL_FLOOR_NAME : DEFAULT_RESTAURANT_FLOOR_NAME;
}

export function loadSavedBuildingFloors(businessId: string): BuildingFloor[] {
  if (!businessId) return [];
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is BuildingFloor =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as BuildingFloor).name === 'string' &&
          ((item as BuildingFloor).floorType === 'restaurant' ||
            (item as BuildingFloor).floorType === 'hotel'),
      )
      .map((f) => ({
        id: f.id || `${f.floorType}-${slugifyFloorName(f.name)}`,
        name: f.name.trim().slice(0, 48),
        floorType: f.floorType,
        widthFt: Math.max(10, Math.min(300, Math.round(f.widthFt || 40))),
        heightFt: Math.max(10, Math.min(300, Math.round(f.heightFt || 28))),
      }));
  } catch {
    return [];
  }
}

export function saveBuildingFloors(
  businessId: string,
  floors: ReadonlyArray<BuildingFloor>,
): BuildingFloor[] {
  const clean = floors.map((f) => ({
    id: f.id || `${f.floorType}-${slugifyFloorName(f.name)}`,
    name: f.name.trim().slice(0, 48),
    floorType: f.floorType,
    widthFt: Math.max(10, Math.min(300, Math.round(f.widthFt || 40))),
    heightFt: Math.max(10, Math.min(300, Math.round(f.heightFt || 28))),
  }));
  try {
    if (typeof window !== 'undefined' && window.localStorage && businessId) {
      window.localStorage.setItem(storageKey(businessId), JSON.stringify(clean));
    }
  } catch {
    // ignore storage quota errors
  }
  return clean;
}

/**
 * Computes the complete ordered list of Building Floors by combining:
 *  1. Owner-created floors saved for this property
 *  2. Auto-discovered floors from existing Dining Tables & Hotel Rooms in PostgreSQL
 * Guarantees at least one Restaurant Floor (Ground Floor) and, whenever Hotel Rooms exist
 * or Hotel Rooms Mode is enabled, at least one dedicated Hotel Floor (Floor 1) so
 * Tables and Hotel Rooms are ALWAYS cleanly separated onto their own floors!
 */
export function buildEffectiveBuildingFloors(params: {
  savedFloors: ReadonlyArray<BuildingFloor>;
  tables: ReadonlyArray<RestaurantTable>;
  hotelRoomsEnabled: boolean;
  defaultWidthFt?: number;
  defaultHeightFt?: number;
}): BuildingFloor[] {
  const w = params.defaultWidthFt ?? 40;
  const h = params.defaultHeightFt ?? 28;
  const result: BuildingFloor[] = [...params.savedFloors];

  const hasFloor = (name: string, floorType: BuildingFloorType) =>
    result.some(
      (f) =>
        f.floorType === floorType &&
        f.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  // Always ensure at least one Restaurant floor exists
  if (!result.some((f) => f.floorType === 'restaurant')) {
    result.unshift({
      id: `restaurant-${slugifyFloorName(DEFAULT_RESTAURANT_FLOOR_NAME)}`,
      name: DEFAULT_RESTAURANT_FLOOR_NAME,
      floorType: 'restaurant',
      widthFt: w,
      heightFt: h,
    });
  }

  const activeTables = params.tables.filter((t) => t.isActive);
  const hasAnyRoom = activeTables.some((t) => t.locationType === 'room');

  // Auto-discover any additional floors referenced by existing tables/rooms
  for (const tbl of activeTables) {
    const isRoom = (tbl.locationType ?? 'table') === 'room';
    const floorType: BuildingFloorType = isRoom ? 'hotel' : 'restaurant';
    const resolvedName = resolveTableFloorName(tbl, result);
    if (!hasFloor(resolvedName, floorType)) {
      result.push({
        id: `${floorType}-${slugifyFloorName(resolvedName)}`,
        name: resolvedName,
        floorType,
        widthFt: w,
        heightFt: h,
      });
    }
  }

  // If Hotel Rooms Mode is enabled (or rooms exist), ensure at least one Hotel floor tab exists
  if (
    (params.hotelRoomsEnabled || hasAnyRoom) &&
    !result.some((f) => f.floorType === 'hotel')
  ) {
    result.push({
      id: `hotel-${slugifyFloorName(DEFAULT_HOTEL_FLOOR_NAME)}`,
      name: DEFAULT_HOTEL_FLOOR_NAME,
      floorType: 'hotel',
      widthFt: w,
      heightFt: h,
    });
  }

  return result;
}
