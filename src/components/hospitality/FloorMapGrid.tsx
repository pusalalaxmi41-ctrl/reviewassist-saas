import { useMemo, useState } from 'react';
import {
  BedDouble,
  BellRing,
  Clock,
  Plus,
  Receipt,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  RestaurantCurrencyCode,
  RestaurantTable,
  RestaurantTableCall,
  RestaurantTableOrder,
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

interface Props {
  tables: RestaurantTable[];
  recentOrders: RestaurantTableOrder[];
  activeCalls: RestaurantTableCall[];
  currencyCode: RestaurantCurrencyCode;
  gstPercent: number;
  serviceChargePercent: number;
  propertyViewFilter?: 'all' | 'table' | 'room';
  hotelRoomsEnabled: boolean;
  onSelectAvailableTable: (table: RestaurantTable) => void;
  onSelectOccupiedTable: (table: RestaurantTable) => void;
}

export function FloorMapGrid({
  tables,
  recentOrders,
  activeCalls,
  currencyCode,
  gstPercent,
  serviceChargePercent,
  propertyViewFilter = 'all',
  hotelRoomsEnabled,
  onSelectAvailableTable,
  onSelectOccupiedTable,
}: Props) {
  const [filter, setFilter] = useState<FloorFilter>('all');

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

  const filtered = useMemo(() => {
    return tableSummaries.filter((item) => {
      const loc = item.table.locationType ?? 'table';
      if (filter === 'tables') return loc === 'table';
      if (filter === 'rooms') return loc === 'room';
      if (filter === 'occupied') return item.isOccupied;
      if (filter === 'available') return !item.isOccupied;
      if (filter === 'bill_requested')
        return item.hasBillRequest || item.hasUrgentAlert;
      return true;
    });
  }, [tableSummaries, filter]);

  const occupiedCount = tableSummaries.filter((s) => s.isOccupied).length;
  const availableCount = tableSummaries.length - occupiedCount;
  const alertCount = tableSummaries.filter(
    (s) => s.hasBillRequest || s.hasUrgentAlert,
  ).length;

  const filterChips: Array<{ id: FloorFilter; label: string; count?: number }> =
    [
      { id: 'all', label: 'All', count: tableSummaries.length },
      ...(hotelRoomsEnabled && propertyViewFilter === 'all'
        ? [
            {
              id: 'tables' as const,
              label: 'Tables',
              count: tableSummaries.filter(
                (s) => (s.table.locationType ?? 'table') === 'table',
              ).length,
            },
            {
              id: 'rooms' as const,
              label: 'Rooms',
              count: tableSummaries.filter(
                (s) => (s.table.locationType ?? 'table') === 'room',
              ).length,
            },
          ]
        : []),
      { id: 'occupied', label: 'Occupied', count: occupiedCount },
      { id: 'available', label: 'Available', count: availableCount },
      { id: 'bill_requested', label: 'Bill / Alerts', count: alertCount },
    ];

  return (
    <div className="space-y-4">
      {/* Filter Strip & Status Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-extrabold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#1E1B4B] text-[#D2DB76] shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E1B4B]'
                }`}
              >
                <span>{chip.label}</span>
                {typeof chip.count === 'number' && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Occupied
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Bill / Alert
          </span>
        </div>
      </div>

      {/* Visual Tactile Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <UtensilsCrossed
            className="mx-auto h-7 w-7 text-slate-400"
            aria-hidden
          />
          <p className="text-[14px] font-bold text-slate-700">
            No tables or rooms match this filter yet.
          </p>
          <p className="text-[12.5px] text-slate-500">
            Add dining tables or hotel rooms under <strong>Tables &amp; QRs</strong> to see them live on your floor map.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                className={`group relative flex flex-col justify-between rounded-3xl p-4 text-left transition-all active:scale-[0.98] cursor-pointer min-h-[196px] ${cardClass}`}
              >
                {/* Top Header */}
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

                {/* Tactile Center Table/Chair or Hotel Room Graphic */}
                <div className="my-3 flex items-center justify-center">
                  {isRoom ? (
                    <div
                      className={`flex h-14 w-20 items-center justify-center rounded-2xl border-2 ${
                        hasUrgentAlert
                          ? 'border-rose-300 bg-white text-rose-700'
                          : isOccupied
                            ? 'border-amber-300 bg-white text-amber-800'
                            : 'border-emerald-300 bg-white text-emerald-700'
                      }`}
                    >
                      <BedDouble className="h-6 w-6" aria-hidden />
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center py-2 px-5">
                      {/* Top seat dots */}
                      <div className="absolute top-0 flex gap-2">
                        {Array.from({
                          length: Math.min(3, Math.ceil(seatCount / 2)),
                        }).map((_, idx) => (
                          <span
                            key={`top-${idx}`}
                            className={`h-1.5 w-3.5 rounded-full ${
                              hasUrgentAlert
                                ? 'bg-rose-400'
                                : isOccupied
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                            }`}
                          />
                        ))}
                      </div>
                      {/* Center table top */}
                      <div
                        className={`flex h-11 min-w-[68px] items-center justify-center rounded-xl border-2 bg-white px-3 font-mono text-[13px] font-black text-[#1E1B4B] shadow-2xs ${
                          hasUrgentAlert
                            ? 'border-rose-300'
                            : isOccupied
                              ? 'border-amber-300'
                              : 'border-emerald-300'
                        }`}
                      >
                        {table.tableNumber.length <= 6
                          ? table.tableNumber
                          : table.tableKey.toUpperCase().slice(0, 6)}
                      </div>
                      {/* Bottom seat dots */}
                      <div className="absolute bottom-0 flex gap-2">
                        {Array.from({
                          length: Math.min(3, Math.floor(seatCount / 2) || 1),
                        }).map((_, idx) => (
                          <span
                            key={`bot-${idx}`}
                            className={`h-1.5 w-3.5 rounded-full ${
                              hasUrgentAlert
                                ? 'bg-rose-400'
                                : isOccupied
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Telemetry */}
                {isOccupied ? (
                  <div className="space-y-1.5 border-t border-black/10 pt-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[18px] font-black text-[#1E1B4B] tabular-nums">
                        {formatPriceFromPaise(grandTotalPaise, currencyCode)}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        {openOrders.length}{' '}
                        {openOrders.length === 1 ? 'order' : 'orders'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1 text-slate-600 tabular-nums">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatElapsedOccupancy(occupiedSince) || 'Active'}
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {hasUpiPending && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9.5px] font-black text-white">
                            VERIFY UPI
                          </span>
                        )}
                        {maxRepeatVisits > 1 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[9.5px] font-black text-blue-900">
                            <Sparkles className="h-2.5 w-2.5" aria-hidden />
                            REPEAT x{maxRepeatVisits}
                          </span>
                        )}
                        {hasBillRequest && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[9.5px] font-black text-white">
                            <Receipt className="h-2.5 w-2.5" aria-hidden />
                            BILL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 border-t border-emerald-200/80 pt-2.5 text-[11.5px] font-bold">
                    <span className="inline-flex items-center gap-1 text-emerald-800">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {hasUrgentAlert && callMeta ? (
                        <span className="text-rose-700 font-black flex items-center gap-1">
                          <BellRing className="h-3 w-3" aria-hidden />
                          {callMeta.label}
                        </span>
                      ) : (
                        'Ready for guests'
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#1E1B4B] px-2.5 py-1 text-[11px] font-extrabold text-[#D2DB76] group-hover:bg-[#2E2A6E]">
                      <Plus className="h-3 w-3" aria-hidden /> Order
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
