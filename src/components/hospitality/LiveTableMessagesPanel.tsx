import { useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  MessageCircle,
  MessageSquare,
  Receipt,
  Send,
  UserCheck,
} from 'lucide-react';
import type {
  RestaurantStaffMember,
  RestaurantTable,
  RestaurantTableCall,
  RestaurantTableMessage,
} from '../../types/restaurant';
import {
  isBillRequestCallType,
  TABLE_CALL_TYPE_METADATA,
} from '../../utils/hospitalityHelpers';

interface Props {
  businessSlug: string;
  businessName: string;
  activeCalls: RestaurantTableCall[];
  tableMessages: RestaurantTableMessage[];
  tables: RestaurantTable[];
  staffRoster: RestaurantStaffMember[];
  onResolveCall: (callId: string, assignedStaffLabel?: string | null) => Promise<void>;
  onAssignCall: (callId: string, assignedStaffLabel: string) => Promise<void>;
  onOpenTableCheckout: (table: RestaurantTable) => void;
  onSendManagerReply: (tableKey: string, messageText: string) => Promise<void>;
}

export function LiveTableMessagesPanel({
  businessName,
  activeCalls,
  tableMessages,
  tables,
  staffRoster,
  onResolveCall,
  onAssignCall,
  onOpenTableCheckout,
  onSendManagerReply,
}: Props) {
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingTableKey, setSendingTableKey] = useState<string | null>(null);
  const [busyCallId, setBusyCallId] = useState<string | null>(null);

  const activeWaiters = useMemo(
    () =>
      staffRoster.filter(
        (s) => s.isActive && (s.role === 'waiter' || s.role === 'manager'),
      ),
    [staffRoster],
  );

  // Group chat messages by tableId
  const threads = useMemo(() => {
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const grouped = new Map<
      string,
      {
        tableId: string;
        tableNumber: string;
        tableKey: string;
        table: RestaurantTable | null;
        messages: RestaurantTableMessage[];
        unreadCount: number;
        hasBillAsk: boolean;
      }
    >();

    for (const msg of tableMessages) {
      const tbl = tableById.get(msg.tableId) ?? null;
      const existing = grouped.get(msg.tableId) ?? {
        tableId: msg.tableId,
        tableNumber: msg.tableNumber || tbl?.tableNumber || 'Table',
        tableKey: msg.tableKey || tbl?.tableKey || '',
        table: tbl,
        messages: [],
        unreadCount: 0,
        hasBillAsk: false,
      };
      existing.messages.push(msg);
      if (msg.senderRole === 'customer' && !msg.isRead) {
        existing.unreadCount++;
      }
      grouped.set(msg.tableId, existing);
    }

    for (const call of activeCalls) {
      if (!isBillRequestCallType(call.callType)) continue;
      const tbl = tableById.get(call.tableId) ?? null;
      const existing = grouped.get(call.tableId) ?? {
        tableId: call.tableId,
        tableNumber: call.tableNumber,
        tableKey: call.tableKey,
        table: tbl,
        messages: [],
        unreadCount: 0,
        hasBillAsk: true,
      };
      existing.hasBillAsk = true;
      grouped.set(call.tableId, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const aTime = a.messages[a.messages.length - 1]?.createdAt ?? '';
      const bTime = b.messages[b.messages.length - 1]?.createdAt ?? '';
      return bTime.localeCompare(aTime);
    });
  }, [tableMessages, tables, activeCalls]);

  async function handleSendReply(tableKey: string) {
    const text = (replyDrafts[tableKey] ?? '').trim();
    if (!text || !tableKey) return;
    setSendingTableKey(tableKey);
    try {
      await onSendManagerReply(tableKey, text);
      setReplyDrafts((prev) => ({ ...prev, [tableKey]: '' }));
    } finally {
      setSendingTableKey(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. TOP URGENT GUEST REQUESTS STRIP */}
      <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-rose-600" aria-hidden />
            <h2 className="text-[17px] font-black text-[#1E1B4B]">
              Urgent Guest Requests ({activeCalls.length})
            </h2>
          </div>
          <span className="text-[11.5px] font-bold text-slate-500">
            Assign waiter &amp; mark Done
          </span>
        </div>

        {activeCalls.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F9FA] p-4 text-center text-[13px] font-semibold text-slate-500">
            All table &amp; room service requests are cleared!
          </p>
        ) : (
          <div className="space-y-2.5">
            {activeCalls.map((call) => {
              const meta =
                TABLE_CALL_TYPE_METADATA[call.callType] ??
                TABLE_CALL_TYPE_METADATA.assistance;
              const isBill = isBillRequestCallType(call.callType);
              const matchedTable =
                tables.find((t) => t.id === call.tableId) ?? null;

              return (
                <div
                  key={call.id}
                  className={`flex flex-col gap-3 rounded-2xl border-2 p-3.5 lg:flex-row lg:items-center lg:justify-between ${
                    isBill
                      ? 'border-red-300 bg-[#FEF2F2]'
                      : 'border-amber-200 bg-[#FFFBEB]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-black ${meta.badgeClass}`}
                    >
                      <span>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span className="text-[15px] font-black text-[#1E1B4B]">
                      {call.tableNumber}
                    </span>
                    <span className="text-[12px] font-semibold text-slate-500">
                      {new Date(call.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {call.assignedStaffLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-900">
                        <UserCheck className="h-3 w-3" aria-hidden />
                        {call.assignedStaffLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      aria-label={`Assign waiter for ${call.tableNumber}`}
                      value={call.assignedStaffLabel ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setBusyCallId(call.id);
                          void onAssignCall(call.id, val).finally(() =>
                            setBusyCallId(null),
                          );
                        }
                      }}
                      className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-[12px] font-bold text-slate-800"
                    >
                      <option value="">Assign to Waiter…</option>
                      {activeWaiters.map((w) => {
                        const lbl = `${w.fullName} (${w.staffCode})`;
                        return (
                          <option key={w.id} value={lbl}>
                            {lbl}
                          </option>
                        );
                      })}
                      <option value="Manager Desk">Manager Desk</option>
                    </select>

                    {isBill && matchedTable && (
                      <button
                        type="button"
                        onClick={() => onOpenTableCheckout(matchedTable)}
                        className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#1E1B4B] px-3 text-[12px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
                      >
                        <Receipt className="h-3.5 w-3.5" aria-hidden />
                        Open Checkout →
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busyCallId === call.id}
                      onClick={() => {
                        setBusyCallId(call.id);
                        void onResolveCall(
                          call.id,
                          call.assignedStaffLabel,
                        ).finally(() => setBusyCallId(null));
                      }}
                      className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-[12px] font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden /> Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. 2-WAY LIVE TABLE & ROOM CHAT INBOX */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
            <h2 className="text-[18px] font-black text-[#1E1B4B]">
              2-Way Table &amp; Room Messages ({threads.length})
            </h2>
          </div>
        </div>

        {threads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-[13px] font-semibold text-slate-500">
            No table or room chat messages yet today. Guest requests, order updates, and direct chats appear here in real time.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {threads.map((thread) => (
              <div
                key={thread.tableId}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
              >
                <div className="space-y-3">
                  {/* Thread Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl bg-[#1E1B4B] px-2.5 py-1 text-[12px] font-black text-[#D2DB76]">
                        {thread.tableNumber}
                      </span>
                      {thread.unreadCount > 0 && (
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                          {thread.unreadCount} NEW
                        </span>
                      )}
                    </div>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Hi from ${businessName} regarding ${thread.tableNumber}!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-700 hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      WhatsApp
                    </a>
                  </div>

                  {/* Bill Requested Banner */}
                  {thread.hasBillAsk && thread.table && (
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5">
                      <span className="text-[12px] font-extrabold text-red-900">
                        🧾 Guest asked for final bill
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenTableCheckout(thread.table!)}
                        className="rounded-lg bg-red-600 px-3 py-1 text-[11px] font-black text-white hover:bg-red-700 cursor-pointer"
                      >
                        Open Checkout →
                      </button>
                    </div>
                  )}

                  {/* Chronological Thread Messages */}
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {thread.messages.map((msg) => {
                      const isMgr = msg.senderRole === 'manager';
                      const isSys = msg.senderRole === 'system';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMgr
                              ? 'items-end'
                              : isSys
                                ? 'items-center'
                                : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] ${
                              isMgr
                                ? 'bg-[#1E1B4B] text-white'
                                : isSys
                                  ? 'bg-slate-100 text-slate-600 text-[11px] font-bold text-center'
                                  : 'bg-[#F8F9FA] border border-slate-200 text-slate-900 font-semibold'
                            }`}
                          >
                            {!isSys && (
                              <p
                                className={`text-[10px] font-extrabold mb-0.5 ${
                                  isMgr ? 'text-[#D2DB76]' : 'text-slate-500'
                                }`}
                              >
                                {msg.senderName ||
                                  (isMgr ? 'Manager' : 'Guest')}
                              </p>
                            )}
                            <p>{msg.messageText}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Inline Manager Reply Box */}
                {thread.tableKey && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendReply(thread.tableKey);
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-slate-100"
                  >
                    <input
                      type="text"
                      maxLength={600}
                      placeholder="Reply… (shows instantly on guest phone)"
                      value={replyDrafts[thread.tableKey] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [thread.tableKey]: e.target.value,
                        }))
                      }
                      className="h-10 flex-1 rounded-xl border border-slate-200 bg-[#F8F9FA] px-3 text-[12.5px] font-semibold text-slate-900 focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={
                        sendingTableKey === thread.tableKey ||
                        !(replyDrafts[thread.tableKey] ?? '').trim()
                      }
                      className="inline-flex h-10 items-center gap-1 rounded-xl bg-[#1E1B4B] px-3.5 text-[12px] font-extrabold text-[#D2DB76] hover:bg-[#2E2A6E] disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden />
                      Send
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
