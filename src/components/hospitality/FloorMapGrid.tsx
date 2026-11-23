import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BedDouble,
  BellRing,
  Check,
  Clock,
  Grid2X2,
  LayoutGrid,
  Map as MapIcon,
  Move,
  Pencil,
  Plus,
  Receipt,
  RotateCw,
  Ruler,
  Save,
  Sparkles,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type {
  FloorTableLayoutItem,
  RestaurantCurrencyCode,
  RestaurantTable,
  RestaurantTableCall,
  RestaurantTableOrder,
  RestaurantTableShape,
} from '../../types/restaurant';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import {
  calculateBillTotals,
  formatElapsedOccupancy,
  isBillRequestCallType,
  TABLE_CALL_TYPE_METADATA,
} from '../../utils/hospitalityHelpers';

type FloorFilter =
  | 'all'
  | 'tables'
  | 'rooms'
  | 'occupied'
  | 'available'
  | 'bill_requested';

interface TableDraftGeometry {
  id: string;
  tableShape: RestaurantTableShape;
  posX: number;
  posY: number;
  widthUnits: number;
  heightUnits: number;
  seatCapacity: number;
}

interface Props {
  tables: RestaurantTable[];
  recentOrders: RestaurantTableOrder[];
  activeCalls: RestaurantTableCall[];
  currencyCode: RestaurantCurrencyCode;
  gstPercent: number;
  serviceChargePercent: number;
  propertyViewFilter?: 'all' | 'table' | 'room';
  floorMode?: 'restaurant' | 'hotel';
  floorName?: string;
  hotelRoomsEnabled: boolean;
  floorWidthFt?: number;
  floorHeightFt?: number;
  onSaveFloorLayout?: (params: {
    floorWidthFt: number;
    floorHeightFt: number;
    tables: FloorTableLayoutItem[];
  }) => Promise<void>;
  onAddLocation?: (locationType: 'table' | 'room') => void;
  onSelectAvailableTable: (table: RestaurantTable) => void;
  onSelectOccupiedTable: (table: RestaurantTable) => void;
}

const TABLE_PRESETS: ReadonlyArray<{
  label: string;
  shape: RestaurantTableShape;
  widthUnits: number;
  heightUnits: number;
  seatCapacity: number;
}> = [
  {
    label: '2-Seater Square',
    shape: 'square',
    widthUnits: 12,
    heightUnits: 14,
    seatCapacity: 2,
  },
  {
    label: '4-Seater Dining',
    shape: 'rectangle',
    widthUnits: 16,
    heightUnits: 15,
    seatCapacity: 4,
  },
  {
    label: '6-Seater Family',
    shape: 'rectangle',
    widthUnits: 21,
    heightUnits: 15,
    seatCapacity: 6,
  },
  {
    label: '8-Seater Group',
    shape: 'rectangle',
    widthUnits: 26,
    heightUnits: 16,
    seatCapacity: 8,
  },
  {
    label: 'Round Table',
    shape: 'round',
    widthUnits: 15,
    heightUnits: 18,
    seatCapacity: 4,
  },
  {
    label: 'Hotel Room',
    shape: 'rectangle',
    widthUnits: 18,
    heightUnits: 18,
    seatCapacity: 2,
  },
];

function buildInitialGeometry(
  tables: RestaurantTable[],
): Record<string, TableDraftGeometry> {
  const map: Record<string, TableDraftGeometry> = {};
  const cols = Math.max(3, Math.min(5, Math.ceil(Math.sqrt(tables.length || 1))));
  tables.forEach((t, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const defaultW =
      t.locationType === 'room'
        ? 18
        : (t.seatCapacity ?? 4) >= 6
          ? 21
          : (t.seatCapacity ?? 4) <= 2
            ? 13
            : 16;
    const defaultH = t.locationType === 'room' ? 18 : 16;
    const defaultX = Math.min(78, 4 + col * 22);
    const defaultY = Math.min(76, 6 + row * 24);
    map[t.id] = {
      id: t.id,
      tableShape: t.tableShape ?? 'rectangle',
      posX:
        typeof t.posX === 'number' && Number.isFinite(t.posX)
          ? t.posX
          : defaultX,
      posY:
        typeof t.posY === 'number' && Number.isFinite(t.posY)
          ? t.posY
          : defaultY,
      widthUnits:
        typeof t.widthUnits === 'number' && Number.isFinite(t.widthUnits)
          ? t.widthUnits
          : defaultW,
      heightUnits:
        typeof t.heightUnits === 'number' && Number.isFinite(t.heightUnits)
          ? t.heightUnits
          : defaultH,
      seatCapacity: t.seatCapacity ?? (t.locationType === 'room' ? 2 : 4),
    };
  });
  return map;
}

export function FloorMapGrid({
  tables,
  recentOrders,
  activeCalls,
  currencyCode,
  gstPercent,
  serviceChargePercent,
  propertyViewFilter = 'all',
  floorMode,
  floorName,
  hotelRoomsEnabled,
  floorWidthFt = 40,
  floorHeightFt = 28,
  onSaveFloorLayout,
  onAddLocation,
  onSelectAvailableTable,
  onSelectOccupiedTable,
}: Props) {
  const [filter, setFilter] = useState<FloorFilter>('all');
  const [viewMode, setViewMode] = useState<'canvas' | 'cards'>('canvas');
  const [editMode, setEditMode] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  const [draftWidthFt, setDraftWidthFt] = useState(floorWidthFt);
  const [draftHeightFt, setDraftHeightFt] = useState(floorHeightFt);
  const [draftGeo, setDraftGeo] = useState<Record<string, TableDraftGeometry>>(
    () => buildInitialGeometry(tables),
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Dragging state via refs + pointer events for silky 60fps positioning
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    tableId: string;
    startClientX: number;
    startClientY: number;
    origPosX: number;
    origPosY: number;
    moved: boolean;
  } | null>(null);

  // Sync incoming saved dimensions/tables whenever not actively editing
  useEffect(() => {
    if (editMode) return;
    const t = window.setTimeout(() => {
      setDraftWidthFt(floorWidthFt);
      setDraftHeightFt(floorHeightFt);
      setDraftGeo(buildInitialGeometry(tables));
    }, 0);
    return () => window.clearTimeout(t);
  }, [tables, floorWidthFt, floorHeightFt, editMode]);

  const activeTables = useMemo(
    () =>
      tables
        .filter((t) => t.isActive)
        .filter((t) =>
          propertyViewFilter === 'all'
            ? true
            : (t.locationType ?? 'table') === propertyViewFilter,
        ),
    [tables, propertyViewFilter],
  );

  const tableSummaries = useMemo(() => {
    return activeTables.map((table) => {
      const openOrders = recentOrders.filter(
        (o) =>
          o.tableId === table.id &&
          o.status !== 'cancelled' &&
          (o.paymentStatus ?? 'unpaid') !== 'paid',
      );
      const subtotalPaise = openOrders.reduce(
        (sum, o) =>
          sum +
          o.items.reduce((s, item) => s + item.pricePaise * item.quantity, 0),
        0,
      );
      const billTotals = calculateBillTotals({
        subtotalPaise,
        gstPercent,
        serviceChargePercent,
      });
      const tableCalls = activeCalls.filter(
        (c) =>
          c.tableId === table.id &&
          (c.status === 'open' || c.status === 'acknowledged'),
      );
      const hasBillRequest = tableCalls.some((c) =>
        isBillRequestCallType(c.callType),
      );
      const hasUrgentAlert = tableCalls.length > 0;
      const isOccupied = openOrders.length > 0 || Boolean(table.occupiedSince);
      const occupiedSince =
        table.occupiedSince ??
        (openOrders.length > 0
          ? openOrders[openOrders.length - 1].createdAt
          : null);
      const maxRepeatVisits = openOrders.reduce(
        (max, o) => Math.max(max, o.customerRepeatVisitCount ?? 1),
        1,
      );
      const hasUpiPending = openOrders.some(
        (o) => o.paymentStatus === 'upi_pending_verify',
      );

      return {
        table,
        openOrders,
        grandTotalPaise: billTotals.grandTotalPaise,
        tableCalls,
        hasBillRequest,
        hasUrgentAlert,
        isOccupied,
        occupiedSince,
        maxRepeatVisits,
        hasUpiPending,
      };
    });
  }, [activeTables, recentOrders, activeCalls, gstPercent, serviceChargePercent]);

  const counts = useMemo(() => {
    let tableCount = 0;
    let roomCount = 0;
    let occupiedCount = 0;
    let availableCount = 0;
    let alertCount = 0;
    for (const s of tableSummaries) {
      if ((s.table.locationType ?? 'table') === 'room') roomCount++;
      else tableCount++;
      if (s.isOccupied) occupiedCount++;
      else availableCount++;
      if (s.hasUrgentAlert || s.hasBillRequest || s.hasUpiPending) alertCount++;
    }
    return {
      all: tableSummaries.length,
      tables: tableCount,
      rooms: roomCount,
      occupied: occupiedCount,
      available: availableCount,
      bill_requested: alertCount,
    };
  }, [tableSummaries]);

  const filtered = useMemo(() => {
    return tableSummaries.filter((s) => {
      if (filter === 'tables') return (s.table.locationType ?? 'table') === 'table';
      if (filter === 'rooms') return (s.table.locationType ?? 'table') === 'room';
      if (filter === 'occupied') return s.isOccupied;
      if (filter === 'available') return !s.isOccupied;
      if (filter === 'bill_requested') {
        return s.hasBillRequest || s.hasUrgentAlert || s.hasUpiPending;
      }
      return true;
    });
  }, [tableSummaries, filter]);

  const filterChips: Array<{ id: FloorFilter; label: string; count: number }> = [
    {
      id: 'all',
      label:
        floorMode === 'hotel'
          ? 'All Rooms'
          : floorMode === 'restaurant'
            ? 'All Tables'
            : 'All',
      count: counts.all,
    },
    ...(!floorMode && hotelRoomsEnabled
      ? [
          { id: 'tables' as const, label: 'Tables', count: counts.tables },
          { id: 'rooms' as const, label: 'Rooms', count: counts.rooms },
        ]
      : []),
    { id: 'occupied', label: 'Occupied', count: counts.occupied },
    { id: 'available', label: 'Available', count: counts.available },
    { id: 'bill_requested', label: 'Bill / Alerts', count: counts.bill_requested },
  ];

  function updateSelectedGeo(patch: Partial<TableDraftGeometry>) {
    if (!selectedTableId) return;
    setDraftGeo((prev) => {
      const cur = prev[selectedTableId];
      if (!cur) return prev;
      return {
        ...prev,
        [selectedTableId]: { ...cur, ...patch },
      };
    });
  }

  function handleAutoArrange() {
    const list = activeTables;
    const cols = Math.max(3, Math.min(5, Math.ceil(Math.sqrt(list.length || 1))));
    const next: Record<string, TableDraftGeometry> = { ...draftGeo };
    list.forEach((tbl, idx) => {
      const cur = next[tbl.id] ?? {
        id: tbl.id,
        tableShape: 'rectangle' as const,
        posX: 4,
        posY: 6,
        widthUnits: 16,
        heightUnits: 16,
        seatCapacity: tbl.seatCapacity ?? 4,
      };
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const stepX = Math.floor(94 / cols);
      next[tbl.id] = {
        ...cur,
        posX: Math.min(82, 3 + col * stepX),
        posY: Math.min(78, 5 + row * 24),
      };
    });
    setDraftGeo(next);
  }

  function handlePointerDownNode(
    e: React.PointerEvent<HTMLDivElement>,
    tableId: string,
  ) {
    if (!editMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cur = draftGeo[tableId];
    if (!cur) return;
    setSelectedTableId(tableId);
    dragRef.current = {
      tableId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origPosX: cur.posX,
      origPosY: cur.posY,
      moved: false,
    };
  }

  function handlePointerMoveNode(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || !editMode) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;
    if (Math.abs(dxPct) > 0.4 || Math.abs(dyPct) > 0.4) {
      drag.moved = true;
    }

    setDraftGeo((prev) => {
      const cur = prev[drag.tableId];
      if (!cur) return prev;
      const maxX = Math.max(0, 100 - cur.widthUnits);
      const maxY = Math.max(0, 100 - cur.heightUnits);
      // Smooth 1% snap so tables align crisply
      const nextX = Math.round(
        Math.max(0, Math.min(maxX, drag.origPosX + dxPct)),
      );
      const nextY = Math.round(
        Math.max(0, Math.min(maxY, drag.origPosY + dyPct)),
      );
      return {
        ...prev,
        [drag.tableId]: { ...cur, posX: nextX, posY: nextY },
      };
    });
  }

  function handlePointerUpNode(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore release errors
      }
      dragRef.current = null;
    }
  }

  async function handlePersistFloorPlan() {
    if (!onSaveFloorLayout) {
      setEditMode(false);
      return;
    }
    setSavingLayout(true);
    try {
      const payloadTables: FloorTableLayoutItem[] = tables.map((t) => {
        const g = draftGeo[t.id];
        return {
          id: t.id,
          tableShape: g?.tableShape ?? t.tableShape ?? 'rectangle',
          posX: g?.posX ?? t.posX ?? 4,
          posY: g?.posY ?? t.posY ?? 6,
          widthUnits: g?.widthUnits ?? t.widthUnits ?? 16,
          heightUnits: g?.heightUnits ?? t.heightUnits ?? 16,
          seatCapacity: g?.seatCapacity ?? t.seatCapacity ?? 4,
        };
      });
      await onSaveFloorLayout({
        floorWidthFt: draftWidthFt,
        floorHeightFt: draftHeightFt,
        tables: payloadTables,
      });
      setEditMode(false);
      setSelectedTableId(null);
    } finally {
      setSavingLayout(false);
    }
  }

  const selectedTable = selectedTableId
    ? (tables.find((t) => t.id === selectedTableId) ?? null)
    : null;
  const selectedGeo = selectedTableId ? (draftGeo[selectedTableId] ?? null) : null;

  // Dynamic room aspect ratio scaled cleanly from room width x height in feet
  const aspectRatio = Math.max(
    1.15,
    Math.min(2.3, draftWidthFt / Math.max(10, draftHeightFt)),
  );
  const totalSqFt = Math.round(draftWidthFt * draftHeightFt);

  return (
    <div className="space-y-3.5">
      {/* Toolbar: Clean Flat Filters (Left) + Add Table/Room + Floor/Cards Switcher (Right) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`inline-flex h-8.5 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1E1B4B] text-[#FFFFFF]'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10.5px] font-bold tabular-nums ${
                    active
                      ? 'bg-[#D2DB76] text-[#1E1B4B]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Legend */}
          <div className="hidden 2xl:flex items-center gap-3 text-[11px] font-medium text-slate-500 mr-1">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              Available
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
              Occupied
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
              Bill / Alert
            </span>
          </div>

          {onAddLocation && !editMode && (
            <div className="inline-flex items-center gap-1.5">
              {floorMode !== 'hotel' && (
                <button
                  type="button"
                  onClick={() => onAddLocation('table')}
                  className="inline-flex h-8.5 items-center gap-1 rounded-lg bg-[#1E1B4B] px-3 text-[12px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                  Add Table
                </button>
              )}
              {floorMode !== 'restaurant' && (
                <button
                  type="button"
                  onClick={() => onAddLocation('room')}
                  className="inline-flex h-8.5 items-center gap-1 rounded-lg bg-[#1E1B4B] px-3 text-[12px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                >
                  <BedDouble className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                  Add Room
                </button>
              )}
            </div>
          )}

          {/* Floor Canvas vs Card Grid Switcher */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`inline-flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-semibold cursor-pointer transition-colors ${
                viewMode === 'canvas'
                  ? 'bg-[#1E1B4B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden />
              Floor Plan
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('cards');
                setEditMode(false);
              }}
              className={`inline-flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-semibold cursor-pointer transition-colors ${
                viewMode === 'cards'
                  ? 'bg-[#1E1B4B] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Cards
            </button>
          </div>

          {/* Customize Floor Plan Button */}
          {viewMode === 'canvas' && !editMode && (
            <button
              type="button"
              onClick={() => {
                setEditMode(true);
                setSelectedTableId(activeTables[0]?.id ?? null);
              }}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#1E1B4B] hover:border-[#1E1B4B]/40 hover:bg-slate-50 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit Layout
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          FLOOR PLAN DESIGNER TOOLBAR (ONLY WHEN EDITING ROOM & TABLES)
         ===================================================================== */}
      {viewMode === 'canvas' && editMode && (
        <div className="rounded-2xl border-2 border-[#1E1B4B] bg-white p-4 shadow-md space-y-3.5 animate-fadeSlideUp">
          {/* Row 1: Room Dimensions + Auto-Arrange + Save/Cancel */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-3 py-1.5 text-[12px] font-extrabold text-[#D2DB76]">
                <Ruler className="h-3.5 w-3.5" aria-hidden />
                Room Designer Mode
              </span>
              <div className="flex items-center gap-2 text-[12px] font-bold text-slate-700">
                <label htmlFor="floorWidthInput">Width (ft):</label>
                <input
                  id="floorWidthInput"
                  type="number"
                  min={10}
                  max={300}
                  value={draftWidthFt}
                  onChange={(e) =>
                    setDraftWidthFt(
                      Math.max(10, Math.min(300, Number(e.target.value) || 40)),
                    )
                  }
                  className="h-8 w-16 rounded-lg border border-slate-300 bg-[#F8F9FA] px-2 text-center font-extrabold text-[#1E1B4B] tabular-nums"
                />
                <span>×</span>
                <label htmlFor="floorHeightInput">Length (ft):</label>
                <input
                  id="floorHeightInput"
                  type="number"
                  min={10}
                  max={300}
                  value={draftHeightFt}
                  onChange={(e) =>
                    setDraftHeightFt(
                      Math.max(10, Math.min(300, Number(e.target.value) || 28)),
                    )
                  }
                  className="h-8 w-16 rounded-lg border border-slate-300 bg-[#F8F9FA] px-2 text-center font-extrabold text-[#1E1B4B] tabular-nums"
                />
                <span className="rounded-full bg-[#D2DB76]/55 px-2.5 py-0.5 text-[11px] font-black text-[#1E1B4B] tabular-nums">
                  {totalSqFt.toLocaleString()} sq ft
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoArrange}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 text-[12px] font-bold text-slate-700 hover:bg-white cursor-pointer"
              >
                <Grid2X2 className="h-3.5 w-3.5" aria-hidden />
                Auto-Arrange
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setSelectedTableId(null);
                  setDraftWidthFt(floorWidthFt);
                  setDraftHeightFt(floorHeightFt);
                  setDraftGeo(buildInitialGeometry(tables));
                }}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden /> Cancel
              </button>
              <button
                type="button"
                disabled={savingLayout}
                onClick={() => void handlePersistFloorPlan()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#059669] px-4 text-[12.5px] font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {savingLayout ? (
                  'Saving…'
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" aria-hidden />
                    Save Floor Layout ✓
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Selected Table Customization Inspector (Presets, Shape, W/H, Rotate, Seats) */}
          {selectedTable && selectedGeo ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[#D2DB76] px-2.5 py-1 text-[12px] font-black text-[#1E1B4B]">
                  Editing: {selectedTable.tableNumber}
                </span>

                {/* Quick Table Type Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  {TABLE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        updateSelectedGeo({
                          tableShape: preset.shape,
                          widthUnits: preset.widthUnits,
                          heightUnits: preset.heightUnits,
                          seatCapacity: preset.seatCapacity,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-[#F8F9FA] px-2 py-1 text-[11px] font-bold text-slate-700 hover:border-[#1E1B4B] hover:bg-white cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-[11.5px] font-bold text-slate-700">
                {/* Shape Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-[#F8F9FA] p-0.5">
                  {(['square', 'rectangle', 'round'] as const).map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => updateSelectedGeo({ tableShape: shape })}
                      className={`rounded-md px-2 py-1 text-[11px] font-extrabold capitalize cursor-pointer ${
                        selectedGeo.tableShape === shape
                          ? 'bg-[#1E1B4B] text-[#D2DB76]'
                          : 'text-slate-600'
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>

                {/* Width & Height sliders */}
                <label className="inline-flex items-center gap-1">
                  W:
                  <input
                    type="range"
                    min={9}
                    max={36}
                    value={selectedGeo.widthUnits}
                    onChange={(e) =>
                      updateSelectedGeo({ widthUnits: Number(e.target.value) })
                    }
                    className="w-16 accent-[#1E1B4B]"
                  />
                </label>
                <label className="inline-flex items-center gap-1">
                  H:
                  <input
                    type="range"
                    min={9}
                    max={36}
                    value={selectedGeo.heightUnits}
                    onChange={(e) =>
                      updateSelectedGeo({ heightUnits: Number(e.target.value) })
                    }
                    className="w-16 accent-[#1E1B4B]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    updateSelectedGeo({
                      widthUnits: selectedGeo.heightUnits,
                      heightUnits: selectedGeo.widthUnits,
                    })
                  }
                  title="Rotate 90°"
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-extrabold text-[#1E1B4B] hover:bg-slate-50 cursor-pointer"
                >
                  <RotateCw className="h-3 w-3" aria-hidden /> Rotate
                </button>

                <label className="inline-flex items-center gap-1">
                  Seats:
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={selectedGeo.seatCapacity}
                    onChange={(e) =>
                      updateSelectedGeo({
                        seatCapacity: Math.max(
                          1,
                          Math.min(30, Number(e.target.value) || 4),
                        ),
                      })
                    }
                    className="h-7 w-12 rounded-lg border border-slate-300 bg-white px-1.5 text-center font-extrabold text-[#1E1B4B] tabular-nums"
                  />
                </label>
              </div>
            </div>
          ) : (
            <p className="text-[12px] font-semibold text-slate-500 border-t border-slate-100 pt-2">
              Drag any table or room node on the floor below to reposition it, or click a table to customize its shape (Square / Rectangle / Round), size, and seat count.
            </p>
          )}
        </div>
      )}

      {/* =====================================================================
          VIEW 1: INTERACTIVE SPATIAL ROOM FLOOR PLAN CANVAS (DRAG & DROP!)
         ===================================================================== */}
      {viewMode === 'canvas' ? (
        filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            {floorMode === 'hotel' || filter === 'rooms' ? (
              <BedDouble
                className="mx-auto h-8 w-8 text-slate-400"
                aria-hidden
              />
            ) : (
              <UtensilsCrossed
                className="mx-auto h-8 w-8 text-slate-400"
                aria-hidden
              />
            )}
            <p className="text-[14px] font-semibold text-slate-800">
              {floorMode === 'hotel'
                ? `No rooms on ${floorName || 'this hotel floor'} yet`
                : floorMode === 'restaurant'
                  ? `No dining tables on ${floorName || 'this restaurant floor'} yet`
                  : filter === 'rooms'
                    ? 'No Hotel Rooms added yet'
                    : 'No tables or rooms match this filter'}
            </p>
            {onAddLocation && (
              <div className="flex justify-center gap-2 pt-1">
                {floorMode === 'hotel' || filter === 'rooms' ? (
                  <button
                    type="button"
                    onClick={() => onAddLocation('room')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-4 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                    Add Room to {floorName || 'This Floor'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddLocation('table')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-4 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                    Add Table to {floorName || 'This Floor'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
        <div
          ref={canvasRef}
          className={`relative w-full overflow-hidden rounded-2xl border bg-white select-none ${
            editMode ? 'border-2 border-[#1E1B4B]' : 'border-slate-200'
          }`}
          style={{
            aspectRatio: `${aspectRatio}`,
            minHeight: '420px',
            maxHeight: '680px',
            backgroundImage:
              'radial-gradient(circle, rgba(30, 27, 75, 0.14) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Room Blueprint Dimensions Badge & Entrance Marker */}
          <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#1E1B4B]">
            <Ruler className="h-3 w-3 text-slate-400" aria-hidden />
            <span>
              {floorName ? `${floorName} · ` : ''}
              {draftWidthFt} ft × {draftHeightFt} ft ({totalSqFt.toLocaleString()} sq ft)
            </span>
            {editMode && (
              <span className="rounded bg-[#D2DB76] px-1.5 py-0.5 text-[10px] font-bold text-[#1E1B4B]">
                DRAG TO MOVE
              </span>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 rounded-md border border-slate-200 bg-white/95 px-3.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {floorMode === 'hotel'
              ? '▲ Elevator / Corridor Access ▲'
              : '▲ Entrance / Main Door ▲'}
          </div>

          {/* Draggable / Interactive Table & Room Nodes */}
          {filtered.map((item) => {
            const {
              table,
              openOrders,
              grandTotalPaise,
              tableCalls,
              hasBillRequest,
              hasUrgentAlert,
              isOccupied,
              occupiedSince,
              maxRepeatVisits,
              hasUpiPending,
            } = item;
            const geo = draftGeo[table.id] ?? {
              id: table.id,
              tableShape: table.tableShape ?? 'rectangle',
              posX: 5,
              posY: 12,
              widthUnits: 16,
              heightUnits: 16,
              seatCapacity: table.seatCapacity ?? 4,
            };
            const isRoom = (table.locationType ?? 'table') === 'room';
            const isSelected = editMode && selectedTableId === table.id;
            const primaryCall = tableCalls[0] ?? null;
            const callMeta = primaryCall
              ? TABLE_CALL_TYPE_METADATA[primaryCall.callType]
              : null;

            const surfaceClass = hasUrgentAlert
              ? 'border-[#EF4444] bg-[#FEF2F2] text-[#991B1B] shadow-md'
              : isOccupied
                ? 'border-[#F59E0B] bg-[#FFFBEB] text-[#92400E] shadow-sm'
                : 'border-[#10B981] bg-[#ECFDF5] text-[#065F46] shadow-2xs';

            const dotClass = hasUrgentAlert
              ? 'bg-[#EF4444]'
              : isOccupied
                ? 'bg-[#F59E0B]'
                : 'bg-[#10B981]';

            const shapeRadius =
              geo.tableShape === 'round'
                ? 'rounded-full'
                : geo.tableShape === 'square'
                  ? 'rounded-2xl'
                  : 'rounded-2xl';

            const seatDotsTop = Math.max(
              1,
              Math.min(5, Math.ceil(geo.seatCapacity / 2)),
            );
            const seatDotsBottom = Math.max(
              0,
              Math.min(5, Math.floor(geo.seatCapacity / 2)),
            );

            return (
              <div
                key={table.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => handlePointerDownNode(e, table.id)}
                onPointerMove={handlePointerMoveNode}
                onPointerUp={handlePointerUpNode}
                onClick={() => {
                  if (editMode) {
                    setSelectedTableId(table.id);
                    return;
                  }
                  if (isOccupied || hasUrgentAlert) {
                    onSelectOccupiedTable(table);
                  } else {
                    onSelectAvailableTable(table);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (editMode) {
                      setSelectedTableId(table.id);
                    } else if (isOccupied || hasUrgentAlert) {
                      onSelectOccupiedTable(table);
                    } else {
                      onSelectAvailableTable(table);
                    }
                  }
                }}
                style={{
                  left: `${geo.posX}%`,
                  top: `${geo.posY}%`,
                  width: `${geo.widthUnits}%`,
                  height: `${geo.heightUnits}%`,
                  minWidth: '104px',
                  minHeight: '86px',
                  touchAction: editMode ? 'none' : 'auto',
                }}
                className={`absolute flex flex-col items-center justify-center border-2 p-2 text-center transition-shadow ${shapeRadius} ${surfaceClass} ${
                  editMode
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer hover:scale-[1.02] transition-transform'
                } ${isSelected ? 'z-30 ring-4 ring-[#1E1B4B] shadow-xl' : 'z-20'}`}
              >
                {/* Visual Chairs Around Table (Top & Bottom) */}
                {!isRoom && geo.tableShape !== 'round' && (
                  <>
                    <div className="pointer-events-none absolute -top-2 flex gap-1.5">
                      {Array.from({ length: seatDotsTop }).map((_, i) => (
                        <span
                          key={`t-${i}`}
                          className={`h-1.5 w-3.5 rounded-full ${dotClass}`}
                        />
                      ))}
                    </div>
                    {seatDotsBottom > 0 && (
                      <div className="pointer-events-none absolute -bottom-2 flex gap-1.5">
                        {Array.from({ length: seatDotsBottom }).map((_, i) => (
                          <span
                            key={`b-${i}`}
                            className={`h-1.5 w-3.5 rounded-full ${dotClass}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Top Floating Status Pill */}
                {(hasUrgentAlert || hasUpiPending || editMode) && (
                  <span
                    className={`absolute -top-2.5 right-2 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase shadow-xs ${
                      editMode
                        ? 'bg-[#1E1B4B] text-[#D2DB76]'
                        : hasUrgentAlert
                          ? 'bg-[#EF4444] text-white animate-pulse'
                          : 'bg-amber-500 text-white'
                    }`}
                  >
                    {editMode ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Move className="h-2.5 w-2.5" aria-hidden /> Drag
                      </span>
                    ) : hasBillRequest ? (
                      '🧾 Bill'
                    ) : hasUrgentAlert ? (
                      `${callMeta?.emoji ?? '🔔'} ${callMeta?.shortLabel ?? 'Alert'}`
                    ) : (
                      'VERIFY UPI'
                    )}
                  </span>
                )}

                {/* Center Label & Live Bill / Status */}
                <div className="flex items-center gap-1">
                  {isRoom && <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                  <span className="text-[14px] font-black text-[#1E1B4B] leading-tight truncate max-w-full">
                    {table.tableNumber}
                  </span>
                </div>

                {isOccupied ? (
                  <>
                    <span className="mt-0.5 text-[14px] font-black text-[#1E1B4B] tabular-nums leading-none">
                      {formatPriceFromPaise(grandTotalPaise, currencyCode)}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-extrabold opacity-85 tabular-nums">
                      <Clock className="h-2.5 w-2.5" aria-hidden />
                      {formatElapsedOccupancy(occupiedSince) || '<1m'} ·{' '}
                      {openOrders.length} ord
                    </span>
                  </>
                ) : (
                  <span className="mt-0.5 text-[10.5px] font-extrabold opacity-80">
                    {geo.seatCapacity} {isRoom ? 'guests' : 'seats'} · Ready
                  </span>
                )}

                {maxRepeatVisits >= 2 && !editMode && (
                  <span className="mt-0.5 rounded-full bg-[#1E1B4B] px-1.5 py-0.2 text-[9px] font-black text-[#D2DB76]">
                    REPEAT ×{maxRepeatVisits}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        )
      ) : (
        /* =====================================================================
           VIEW 2: CLASSIC TACTILE CARD GRID
           ===================================================================== */
        filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
            {filter === 'rooms' ? (
              <BedDouble
                className="mx-auto h-7 w-7 text-slate-400"
                aria-hidden
              />
            ) : (
              <UtensilsCrossed
                className="mx-auto h-7 w-7 text-slate-400"
                aria-hidden
              />
            )}
            <p className="text-[14px] font-semibold text-slate-700">
              {filter === 'rooms'
                ? 'No Hotel Rooms added yet.'
                : 'No tables or rooms match this filter yet.'}
            </p>
            {onAddLocation && (
              <button
                type="button"
                onClick={() =>
                  onAddLocation(filter === 'rooms' ? 'room' : 'table')
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-4 text-[12.5px] font-semibold text-white hover:bg-[#2E2A6E] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                {filter === 'rooms' ? 'Add First Hotel Room' : 'Add Table'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item) => {
              const {
                table,
                openOrders,
                grandTotalPaise,
                tableCalls,
                hasBillRequest,
                hasUrgentAlert,
                isOccupied,
                occupiedSince,
                maxRepeatVisits,
                hasUpiPending,
              } = item;
              const isRoom = (table.locationType ?? 'table') === 'room';
              const seatCount = table.seatCapacity ?? (isRoom ? 2 : 4);
              const primaryCall = tableCalls[0] ?? null;
              const callMeta = primaryCall
                ? TABLE_CALL_TYPE_METADATA[primaryCall.callType]
                : null;

              const cardClass = hasUrgentAlert
                ? 'border-2 border-[#EF4444] bg-[#FEF2F2] shadow-sm hover:shadow-md'
                : isOccupied
                  ? 'border-2 border-[#F59E0B] bg-[#FFFBEB] shadow-xs hover:shadow-md'
                  : 'border-2 border-[#10B981] bg-[#ECFDF5] hover:shadow-sm';

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() =>
                    isOccupied || hasUrgentAlert
                      ? onSelectOccupiedTable(table)
                      : onSelectAvailableTable(table)
                  }
                  className={`group relative flex flex-col justify-between rounded-3xl p-4 text-left transition-all active:scale-[0.98] cursor-pointer min-h-[186px] ${cardClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 truncate">
                        {isRoom ? 'Hotel Room' : 'Dining'} •{' '}
                        {table.tableLabel || `${seatCount} Seats`}
                      </p>
                      <h3 className="text-[18px] font-black text-[#1E1B4B] truncate">
                        {table.tableNumber}
                      </h3>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        hasUrgentAlert
                          ? 'bg-[#EF4444] text-white animate-pulse'
                          : isOccupied
                            ? 'bg-[#F59E0B] text-white'
                            : 'bg-[#10B981] text-white'
                      }`}
                    >
                      {hasBillRequest
                        ? 'Bill Asked'
                        : hasUrgentAlert
                          ? callMeta?.shortLabel ?? 'Alert'
                          : isOccupied
                            ? 'Occupied'
                            : 'Available'}
                    </span>
                  </div>

                  <div className="my-2.5 flex items-center justify-center">
                    {isRoom ? (
                      <div
                        className={`flex h-12 w-18 items-center justify-center rounded-2xl border-2 bg-white ${
                          hasUrgentAlert
                            ? 'border-rose-300 text-rose-700'
                            : isOccupied
                              ? 'border-amber-300 text-amber-800'
                              : 'border-emerald-300 text-emerald-700'
                        }`}
                      >
                        <BedDouble className="h-5 w-5" aria-hidden />
                      </div>
                    ) : (
                      <div className="relative flex items-center justify-center py-2 px-5">
                        <div className="flex h-11 min-w-18 items-center justify-center rounded-xl border-2 bg-white px-3 text-[13px] font-black text-[#1E1B4B] border-current/25">
                          {table.tableNumber}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 border-t border-black/5 pt-2.5">
                    {isOccupied ? (
                      <>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[17px] font-black text-[#1E1B4B] tabular-nums">
                            {formatPriceFromPaise(grandTotalPaise, currencyCode)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                            {openOrders.length}{' '}
                            {openOrders.length === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {occupiedSince && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 tabular-nums">
                              <Clock className="h-3 w-3" aria-hidden />
                              {formatElapsedOccupancy(occupiedSince)}
                            </span>
                          )}
                          {maxRepeatVisits >= 2 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-900">
                              <Sparkles className="h-2.5 w-2.5" aria-hidden />
                              REPEAT ×{maxRepeatVisits}
                            </span>
                          )}
                          {hasUpiPending && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-950">
                              <Receipt className="h-2.5 w-2.5" aria-hidden />
                              VERIFY UPI
                            </span>
                          )}
                          {hasUrgentAlert && primaryCall && callMeta && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-900">
                              <BellRing className="h-2.5 w-2.5" aria-hidden />
                              {callMeta.label}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-800">
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          Ready ({seatCount})
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#1E1B4B] px-2.5 py-1 text-[11px] font-extrabold text-[#D2DB76]">
                          <Plus className="h-3 w-3" aria-hidden /> Order
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Helpful Edit Hint Footer */}
      {viewMode === 'canvas' && !editMode && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-semibold text-slate-500 px-1">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden />
            Tap any <strong className="text-emerald-700">Green</strong> table to start an order, or any{' '}
            <strong className="text-amber-700">Amber / Red</strong> table to open its live bill &amp; checkout.
          </span>
          <span>
            Need custom shapes or room dimensions? Tap <strong>Customize Floor Plan</strong> above.
          </span>
        </div>
      )}
    </div>
  );
}
