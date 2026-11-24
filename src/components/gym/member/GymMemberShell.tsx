import type { CSSProperties, ReactNode } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  Dumbbell,
  Home,
  Play,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GymBrandMark } from './GymBrandMark';

export type MemberNavTab =
  | 'home'
  | 'plan'
  | 'track'
  | 'community'
  | 'profile';

export interface GymMemberShellProps {
  cssVars: CSSProperties;
  brandAccent: string;
  brandAccentText: string;
  brandInk: string;
  brandLogoUrl: string | null;
  gymName: string;
  gymCity?: string | null;
  memberName: string;
  memberCode: string;
  memberStatusLabel: string;
  todayFormatted: string;
  activeTab: MemberNavTab;
  onSelectTab: (tab: MemberNavTab) => void;
  unreadChatCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  showNotifPopover: boolean;
  onToggleNotifPopover: () => void;
  onOpenChatFromNotif: () => void;
  onOpenLibrary: () => void;
  onLaunchTodayWorkout: () => void;
  minimizedWorkout: {
    active: boolean;
    dayTitle: string;
    elapsedClock: string;
    completedSets: number;
    totalSets: number;
  };
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: MemberNavTab;
  label: string;
  desktopSubtitle: string;
  Icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', desktopSubtitle: 'Daily check-in & today’s session', Icon: Home },
  { id: 'plan', label: 'Plan', desktopSubtitle: 'Weekly split, meals & library', Icon: Calendar },
  { id: 'track', label: 'Track', desktopSubtitle: 'Progress, body log, PRs & badges', Icon: BarChart3 },
  { id: 'community', label: 'Community', desktopSubtitle: 'Gym chat & live floor crew', Icon: Users },
  { id: 'profile', label: 'Profile', desktopSubtitle: 'Digital pass QR, renewal & preferences', Icon: User },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Adaptive FitPro x GymOS member shell:
 * - Desktop (`lg:`): 240px left sidebar rail + 1160px fluid dashboard canvas
 * - Mobile / Tablet: sticky top header + 5-tab commercial bottom bar + sticky live workout bar
 */
export function GymMemberShell({
  cssVars,
  brandAccent,
  brandAccentText,
  brandInk,
  brandLogoUrl,
  gymName,
  gymCity,
  memberName,
  memberCode,
  memberStatusLabel,
  todayFormatted,
  activeTab,
  onSelectTab,
  unreadChatCount,
  soundEnabled,
  onToggleSound,
  showNotifPopover,
  onToggleNotifPopover,
  onOpenChatFromNotif,
  onOpenLibrary,
  onLaunchTodayWorkout,
  minimizedWorkout,
  children,
}: GymMemberShellProps) {
  const activeMeta = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];
  const initials = getInitials(memberName);
  const bottomPad = minimizedWorkout.active
    ? 'pb-[calc(9.25rem+env(safe-area-inset-bottom))] lg:pb-10'
    : 'pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-10';

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden bg-[#0B0D10] text-[#F5F7FA] ${bottomPad}`}
      style={cssVars}
    >
      {/* Desktop Fixed Left Sidebar Rail (>= 1024px) */}
      <aside
        aria-label="Gym Member Sidebar Navigation"
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-60 lg:flex-col lg:justify-between border-r border-white/[0.08] bg-[#111419] p-4"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 px-1">
            <GymBrandMark
              logoUrl={brandLogoUrl}
              name={gymName}
              accentColor={brandAccent}
              inkColor={brandInk}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-black text-[#F5F7FA]">
                {gymName}
              </p>
              <p className="truncate text-[11px] font-medium text-[#778191]">
                {gymCity || 'Member Portal'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLaunchTodayWorkout}
            className="gym-tactile flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-3.5 text-[13px] font-black shadow-md cursor-pointer"
            style={
              minimizedWorkout.active
                ? { backgroundColor: '#FFB84D', color: '#0B0D10' }
                : { backgroundColor: brandAccent, color: brandInk }
            }
          >
            <Play className="h-4 w-4 fill-current shrink-0" aria-hidden />
            <span className="truncate tabular-nums">
              {minimizedWorkout.active
                ? `Resume · ${minimizedWorkout.elapsedClock}`
                : 'Start Workout'}
            </span>
          </button>

          <nav className="space-y-1">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  className={`gym-tactile relative flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#1D222B] text-[#F5F7FA] border border-white/10'
                      : 'text-[#A4ADBB] hover:bg-white/[0.04] hover:text-[#F5F7FA]'
                  }`}
                >
                  <Icon
                    className="h-4.5 w-4.5 shrink-0"
                    style={selected ? { color: brandAccentText } : undefined}
                    aria-hidden
                  />
                  <span>{label}</span>
                  {id === 'community' && unreadChatCount > 0 && (
                    <span
                      className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                      style={{ backgroundColor: brandAccent, color: brandInk }}
                    >
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={onOpenLibrary}
              className="gym-tactile flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-bold text-[#A4ADBB] hover:bg-white/[0.04] hover:text-[#F5F7FA] cursor-pointer"
            >
              <Dumbbell className="h-4.5 w-4.5 shrink-0" aria-hidden />
              <span>Exercise Library</span>
            </button>
          </nav>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className="gym-tactile flex w-full items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#171B22] p-2.5 text-left hover:border-white/20 cursor-pointer"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
            style={{ backgroundColor: `${brandAccent}24`, color: brandAccentText }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-extrabold text-[#F5F7FA]">
              {memberName}
            </p>
            <p className="truncate text-[10.5px] font-semibold text-[#778191]">
              {memberCode} · {memberStatusLabel}
            </p>
          </div>
        </button>
      </aside>

      {/* Main Content Shell (Fluid Mobile -> Max-width 1160px Desktop) */}
      <div className="lg:pl-60">
        {/* Global Sticky Top Header Bar */}
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0B0D10]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="lg:hidden">
                <GymBrandMark
                  logoUrl={brandLogoUrl}
                  name={gymName}
                  accentColor={brandAccent}
                  inkColor={brandInk}
                  size="sm"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14.5px] font-black text-[#F5F7FA] lg:text-[18px]">
                    <span className="lg:hidden">{gymName}</span>
                    <span className="hidden lg:inline">{activeMeta.label}</span>
                  </p>
                </div>
                <p className="truncate text-[11px] font-medium text-[#778191]">
                  <span className="lg:hidden">{todayFormatted}</span>
                  <span className="hidden lg:inline">
                    {activeMeta.desktopSubtitle} · {todayFormatted}
                  </span>
                </p>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onToggleNotifPopover}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-[#171B22] text-[#A4ADBB] hover:text-[#F5F7FA] cursor-pointer"
                aria-label="Notifications and Sound Settings"
              >
                <Bell className="h-4.5 w-4.5" aria-hidden />
                {unreadChatCount > 0 && (
                  <span
                    className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: brandAccent }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('profile')}
                className="gym-tactile flex h-11 items-center gap-2 rounded-xl border border-white/[0.09] bg-[#171B22] px-2.5 text-[12px] font-bold text-[#F5F7FA] hover:border-white/25 cursor-pointer"
                aria-label="Open Member Profile and QR Pass"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black"
                  style={{
                    backgroundColor: `${brandAccent}24`,
                    color: brandAccentText,
                  }}
                >
                  {initials}
                </span>
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {memberName.split(' ')[0]}
                </span>
              </button>

              {showNotifPopover && (
                <div className="absolute right-0 top-13 z-40 w-72 rounded-2xl border border-white/15 bg-[#1D222B] p-3.5 shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-extrabold text-[#F5F7FA]">
                      Live Gym Alerts
                    </span>
                    <button
                      type="button"
                      onClick={onToggleNotifPopover}
                      className="text-[11px] font-bold text-[#778191] hover:text-[#F5F7FA] cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-[#171B22] px-3 py-2 text-left text-[12px] cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-bold text-[#F5F7FA]">
                      {soundEnabled ? (
                        <Volume2
                          className="h-4 w-4"
                          style={{ color: brandAccentText }}
                          aria-hidden
                        />
                      ) : (
                        <VolumeX className="h-4 w-4 text-[#778191]" aria-hidden />
                      )}
                      Chat &amp; Timer Ringtone
                    </span>
                    <span
                      className="text-[11px] font-black"
                      style={{
                        color: soundEnabled ? brandAccentText : '#778191',
                      }}
                    >
                      {soundEnabled ? 'ON' : 'MUTED'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenChatFromNotif}
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-[#171B22] px-3 py-2 text-[12px] font-bold cursor-pointer hover:bg-white/[0.04]"
                    style={{ color: brandAccentText }}
                  >
                    <span>
                      {unreadChatCount > 0
                        ? `${unreadChatCount} new gym chat message${unreadChatCount > 1 ? 's' : ''}`
                        : 'Open Live Gym Chat'}
                    </span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport Canvas */}
        <main className="mx-auto w-full max-w-[1160px] px-4 pt-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Sticky Live Minimized Workout Mini-Bar (Mobile + Desktop Floating Resume) */}
      {minimizedWorkout.active && (
        <div className="fixed bottom-[76px] left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 lg:left-auto lg:right-6 lg:bottom-6 lg:w-88 lg:translate-x-0">
          <button
            type="button"
            onClick={onLaunchTodayWorkout}
            className="gym-tactile flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-[#FFB84D]/45 bg-[#1D222B]/95 px-4 py-2 text-left shadow-2xl backdrop-blur-md cursor-pointer"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#FFB84D]" />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-extrabold text-[#F5F7FA]">
                  {minimizedWorkout.dayTitle}
                </p>
                <p className="text-[11px] font-semibold text-[#A4ADBB] tabular-nums">
                  {minimizedWorkout.completedSets}/{minimizedWorkout.totalSets} sets · {minimizedWorkout.elapsedClock}
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#FFB84D] px-3 py-1.5 text-[11.5px] font-black text-[#0B0D10]">
              Resume <Play className="h-3 w-3 fill-current" aria-hidden />
            </span>
          </button>
        </div>
      )}

      {/* Mobile & Tablet 5-Tab Bottom Navigation Bar (< 1024px) */}
      <nav
        aria-label="Gym Member Mobile Navigation"
        className="fixed bottom-2.5 left-1/2 z-30 grid w-[calc(100%-1.25rem)] max-w-md -translate-x-1/2 grid-cols-5 items-center rounded-2xl border border-white/10 bg-[#171B22]/95 px-1 py-1 shadow-2xl backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              className="gym-tactile relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10.5px] font-bold cursor-pointer"
              style={{ color: selected ? brandAccentText : '#778191' }}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
              {id === 'community' && unreadChatCount > 0 && (
                <span
                  className="absolute top-1.5 right-4 h-2 w-2 rounded-full"
                  style={{ backgroundColor: brandAccent }}
                />
              )}
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
