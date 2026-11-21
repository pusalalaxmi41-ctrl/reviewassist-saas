import { useEffect, useState } from 'react';
import {
  Award,
  Gift,
  Plus,
  Trash2,
  Edit3,
  Wifi,
  Inbox,
  CheckCircle2,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  RestaurantLoyaltyRules,
  RestaurantReward,
  RestaurantSuggestion,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { Button } from '../common/Button';

interface Props {
  business: Business;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

export function RestaurantLoyaltyAndExtrasPanel({
  business,
  onStatus,
  onError,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  // Loyalty Economy & Table Extras state
  const [starsPerVerifiedVisit, setStarsPerVerifiedVisit] = useState(1);
  const [pointsPerStarExchange, setPointsPerStarExchange] = useState(100);
  const [allowPointExchange, setAllowPointExchange] = useState(true);
  const [maxStarsViaExchangePerWeek, setMaxStarsViaExchangePerWeek] =
    useState(2);
  const [wifiNetworkName, setWifiNetworkName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [suggestionBoxEnabled, setSuggestionBoxEnabled] = useState(true);

  // Rewards Catalogue state
  const [rewards, setRewards] = useState<RestaurantReward[]>([]);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardStarsRequired, setRewardStarsRequired] = useState(3);
  const [rewardIsActive, setRewardIsActive] = useState(true);

  // Private Suggestion Box state
  const [suggestions, setSuggestions] = useState<RestaurantSuggestion[]>([]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [rules, rwds, sugs] = await Promise.all([
          businessRepository.getRestaurantLoyaltyRules(business.id),
          businessRepository.getRestaurantRewards(business.id),
          businessRepository.getRestaurantSuggestions(business.id),
        ]);
        applyRulesToState(rules);
        setRewards(rwds);
        setSuggestions(sugs);
      } catch (err) {
        onError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void loadAll();
  }, [business.id, onError]);

  function applyRulesToState(rules: RestaurantLoyaltyRules) {
    setStarsPerVerifiedVisit(rules.starsPerVerifiedVisit);
    setPointsPerStarExchange(rules.pointsPerStarExchange);
    setAllowPointExchange(rules.allowPointExchange);
    setMaxStarsViaExchangePerWeek(rules.maxStarsViaExchangePerWeek);
    setWifiNetworkName(rules.wifiNetworkName ?? '');
    setWifiPassword(rules.wifiPassword ?? '');
    setSuggestionBoxEnabled(rules.suggestionBoxEnabled);
  }

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    setSavingRules(true);
    try {
      const saved = await businessRepository.updateRestaurantLoyaltyRules(
        business.id,
        {
          starsPerVerifiedVisit,
          pointsPerStarExchange,
          allowPointExchange,
          maxStarsViaExchangePerWeek,
          wifiNetworkName: wifiNetworkName.trim() || null,
          wifiPassword: wifiPassword.trim() || null,
          suggestionBoxEnabled,
        },
      );
      applyRulesToState(saved);
      onStatus(
        'Saved Loyalty Economy rules, Guest Wi-Fi, and Suggestion Box settings.',
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSavingRules(false);
    }
  }

  async function handleSeedStarterRewards() {
    try {
      const r1 = await businessRepository.createRestaurantReward(business.id, {
        title: 'Complimentary Filter Coffee or Masala Chai',
        description: 'Freshly brewed hot beverage on the house',
        starsRequired: 2,
        isActive: true,
        displayOrder: 0,
      });
      const r2 = await businessRepository.createRestaurantReward(business.id, {
        title: "Chef's Dessert of the Day",
        description: 'Warm Gulab Jamun or Double Ka Meetha served after your meal',
        starsRequired: 4,
        isActive: true,
        displayOrder: 1,
      });
      const r3 = await businessRepository.createRestaurantReward(business.id, {
        title: 'Complimentary Signature Starter',
        description: 'Any starter dish from our appetizers section',
        starsRequired: 6,
        isActive: true,
        displayOrder: 2,
      });
      setRewards((prev) => [...prev, r1, r2, r3]);
      onStatus('Added 3 starter loyalty rewards to your catalogue.');
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function handleSaveReward(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingRewardId) {
        const updated = await businessRepository.updateRestaurantReward(
          business.id,
          editingRewardId,
          {
            title: rewardTitle,
            description: rewardDescription.trim() || null,
            starsRequired: rewardStarsRequired,
            isActive: rewardIsActive,
          },
        );
        setRewards((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)),
        );
        setEditingRewardId(null);
        onStatus(`Updated reward "${updated.title}".`);
      } else {
        const created = await businessRepository.createRestaurantReward(
          business.id,
          {
            title: rewardTitle,
            description: rewardDescription.trim() || null,
            starsRequired: rewardStarsRequired,
            isActive: rewardIsActive,
            displayOrder: rewards.length,
          },
        );
        setRewards((prev) => [...prev, created]);
        onStatus(`Added reward "${created.title}".`);
      }
      setRewardTitle('');
      setRewardDescription('');
      setRewardStarsRequired(3);
      setRewardIsActive(true);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  function handleStartEditReward(rwd: RestaurantReward) {
    setEditingRewardId(rwd.id);
    setRewardTitle(rwd.title);
    setRewardDescription(rwd.description ?? '');
    setRewardStarsRequired(rwd.starsRequired);
    setRewardIsActive(rwd.isActive);
  }

  async function handleToggleRewardActive(rwd: RestaurantReward) {
    try {
      const updated = await businessRepository.updateRestaurantReward(
        business.id,
        rwd.id,
        {
          title: rwd.title,
          description: rwd.description,
          starsRequired: rwd.starsRequired,
          isActive: !rwd.isActive,
          maxRedemptionsTotal: rwd.maxRedemptionsTotal,
          displayOrder: rwd.displayOrder,
        },
      );
      setRewards((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      onStatus(
        `Reward "${updated.title}" is now ${updated.isActive ? 'Active' : 'Paused'}.`,
      );
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function handleDeleteReward(rwd: RestaurantReward) {
    try {
      await businessRepository.deleteRestaurantReward(business.id, rwd.id);
      setRewards((prev) => prev.filter((r) => r.id !== rwd.id));
      onStatus(`Removed reward "${rwd.title}".`);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function handleMarkSuggestionRead(sug: RestaurantSuggestion) {
    try {
      const updated = await businessRepository.markRestaurantSuggestionRead(
        business.id,
        sug.id,
        !sug.isRead,
      );
      setSuggestions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } catch (err) {
      onError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center">
        <p className="text-[14px] text-[#626B65]">
          Loading Loyalty Stars &amp; Rewards…
        </p>
      </div>
    );
  }

  const unreadCount = suggestions.filter((s) => !s.isRead).length;

  return (
    <div className="space-y-6">
      {/* 1. Loyalty Economy, Point-to-Star Exchange & Guest Wi-Fi Form */}
      <form
        onSubmit={(e) => void handleSaveRules(e)}
        className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-6"
      >
        <div>
          <h3 className="text-[18px] font-semibold text-[#252B29] flex items-center gap-2">
            <Award className="h-5 w-5 text-[#244B40]" aria-hidden />
            Loyalty Stars Economy, Point Exchange &amp; Guest Wi-Fi
          </h3>
          <p className="text-[13px] text-[#626B65] mt-0.5">
            Loyalty Stars and Game Points are tracked in two separate ledgers. Configure how many Game Points equal 1 Loyalty Star and protect your margins with a weekly exchange cap.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="starsPerVisitInput"
              className="block text-[13px] font-semibold text-[#252B29]"
            >
              Stars Earned per Verified Visit
            </label>
            <input
              id="starsPerVisitInput"
              type="number"
              min={1}
              max={50}
              required
              value={starsPerVerifiedVisit}
              onChange={(e) =>
                setStarsPerVerifiedVisit(
                  Math.max(1, Number.parseInt(e.target.value || '1', 10)),
                )
              }
              className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
            />
            <p className="text-[11px] text-[#626B65]">
              Awarded when staff verifies a diner&apos;s Loyalty QR pass.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pointsPerStarInput"
              className="block text-[13px] font-semibold text-[#252B29]"
            >
              Game Points Needed for 1 Star
            </label>
            <input
              id="pointsPerStarInput"
              type="number"
              min={1}
              max={100000}
              required
              value={pointsPerStarExchange}
              onChange={(e) =>
                setPointsPerStarExchange(
                  Math.max(1, Number.parseInt(e.target.value || '100', 10)),
                )
              }
              className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
            />
            <p className="text-[11px] text-[#626B65]">
              e.g. 100 Game Points = 1 Loyalty Star.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="maxWeeklyExchangeInput"
              className="block text-[13px] font-semibold text-[#252B29]"
            >
              Max Stars via Exchange / Week
            </label>
            <input
              id="maxWeeklyExchangeInput"
              type="number"
              min={0}
              max={100}
              required
              value={maxStarsViaExchangePerWeek}
              onChange={(e) =>
                setMaxStarsViaExchangePerWeek(
                  Math.max(0, Number.parseInt(e.target.value || '0', 10)),
                )
              }
              className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
            />
            <p className="text-[11px] text-[#626B65]">
              Caps how many stars a diner can convert from games each week.
            </p>
          </div>
        </div>

        {/* Guest Wi-Fi & Suggestion Box Toggles */}
        <div className="grid gap-4 sm:grid-cols-2 border-t border-[#DDE4DC] pt-5">
          <div className="space-y-3 rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#252B29]">
              <Wifi className="h-4 w-4 text-[#244B40]" aria-hidden />
              Guest Wi-Fi Card on Table Hub (Optional)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input
                type="text"
                maxLength={80}
                placeholder="Wi-Fi Network Name (SSID)"
                value={wifiNetworkName}
                onChange={(e) => setWifiNetworkName(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
              />
              <input
                type="text"
                maxLength={120}
                placeholder="Wi-Fi Password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowPointExchange}
                onChange={(e) => setAllowPointExchange(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#244B40]"
              />
              <div>
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#252B29]">
                  <ArrowRightLeft className="h-4 w-4 text-[#244B40]" aria-hidden />
                  Allow Game Points → Loyalty Star Conversion
                </span>
                <p className="text-[12px] text-[#626B65]">
                  Lets diners exchange earned game points for stars up to your weekly cap.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={suggestionBoxEnabled}
                onChange={(e) => setSuggestionBoxEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#244B40]"
              />
              <div>
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[#252B29]">
                  <Inbox className="h-4 w-4 text-[#244B40]" aria-hidden />
                  Enable Private Table Suggestion Box
                </span>
                <p className="text-[12px] text-[#626B65]">
                  Lets guests send direct hospitality notes from their table.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={savingRules}>
            {savingRules ? 'Saving…' : 'Save Loyalty & Table Hub Rules'}
          </Button>
        </div>
      </form>

      {/* 2. Reward Catalogue Manager */}
      <div className="space-y-4">
        {rewards.length === 0 && (
          <div className="rounded-2xl border border-[#E4BD63] bg-[#FAF3DF] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-[16px] font-semibold text-[#252B29] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#244B40]" aria-hidden />
                Load Starter Loyalty Rewards
              </h4>
              <p className="text-[13px] text-[#252B29]">
                Your reward catalogue is empty. Load 3 popular restaurant perks (Filter Coffee, Chef&apos;s Dessert, Signature Starter) in one click.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleSeedStarterRewards()}
            >
              Load Starter Rewards
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: Add / Edit Reward Form */}
          <form
            onSubmit={(e) => void handleSaveReward(e)}
            className="lg:col-span-5 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-[16px] font-semibold text-[#252B29] flex items-center gap-2">
                <Gift className="h-4 w-4 text-[#244B40]" aria-hidden />
                {editingRewardId ? 'Edit Loyalty Reward' : 'Add Loyalty Reward'}
              </h4>
              {editingRewardId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRewardId(null);
                    setRewardTitle('');
                    setRewardDescription('');
                    setRewardStarsRequired(3);
                  }}
                  className="text-[12px] font-medium text-[#626B65] hover:text-[#252B29] cursor-pointer"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rewardTitleInput"
                className="block text-[13px] font-medium text-[#252B29]"
              >
                Reward Title
              </label>
              <input
                id="rewardTitleInput"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Complimentary Filter Coffee"
                value={rewardTitle}
                onChange={(e) => setRewardTitle(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rewardStarsInput"
                className="block text-[13px] font-medium text-[#252B29]"
              >
                Loyalty Stars Required to Claim
              </label>
              <input
                id="rewardStarsInput"
                type="number"
                required
                min={1}
                max={1000}
                value={rewardStarsRequired}
                onChange={(e) =>
                  setRewardStarsRequired(
                    Math.max(1, Number.parseInt(e.target.value || '1', 10)),
                  )
                }
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="rewardDescInput"
                className="block text-[13px] font-medium text-[#252B29]"
              >
                Details / Terms (Optional)
              </label>
              <input
                id="rewardDescInput"
                type="text"
                maxLength={260}
                placeholder="e.g. Show your 6-digit claim ticket to your server"
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[13px] text-[#252B29]"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full">
              <Plus className="h-4 w-4" aria-hidden />
              {editingRewardId ? 'Update Reward' : 'Add Reward to Catalogue'}
            </Button>
          </form>

          {/* RIGHT: Active Rewards List */}
          <div className="lg:col-span-7 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
            <h4 className="text-[14px] font-semibold uppercase tracking-wider text-[#626B65]">
              Reward Catalogue ({rewards.length})
            </h4>

            {rewards.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#626B65]">
                No rewards configured yet. Add your first reward on the left.
              </p>
            ) : (
              <div className="space-y-2.5">
                {rewards.map((rwd) => (
                  <div
                    key={rwd.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-3.5"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-2.5 py-0.5 text-[12px] font-bold text-[#252B29]">
                          ★ {rwd.starsRequired}{' '}
                          {rwd.starsRequired === 1 ? 'Star' : 'Stars'}
                        </span>
                        <span className="text-[15px] font-semibold text-[#252B29]">
                          {rwd.title}
                        </span>
                        {!rwd.isActive && (
                          <span className="rounded-full bg-[#E8EBE7] px-2 py-0.5 text-[11px] font-medium text-[#626B65]">
                            Paused
                          </span>
                        )}
                      </div>
                      {rwd.description && (
                        <p className="text-[12px] text-[#626B65]">
                          {rwd.description}
                        </p>
                      )}
                      <p className="text-[11px] text-[#626B65]">
                        Claimed {rwd.redemptionsCount}{' '}
                        {rwd.redemptionsCount === 1 ? 'time' : 'times'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleToggleRewardActive(rwd)}
                        className="rounded-lg border border-[#DDE4DC] bg-[#FFFFFF] px-2.5 py-1 text-[12px] font-medium text-[#252B29] hover:border-[#244B40] cursor-pointer"
                      >
                        {rwd.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditReward(rwd)}
                        aria-label={`Edit ${rwd.title}`}
                        className="rounded-lg p-1.5 text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29] cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReward(rwd)}
                        aria-label={`Delete ${rwd.title}`}
                        className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Private Suggestion Box Inbox */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-semibold text-[#252B29] flex items-center gap-2">
              <Inbox className="h-5 w-5 text-[#244B40]" aria-hidden />
              Private Table Suggestion Box ({suggestions.length})
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#244B40] px-2.5 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                  {unreadCount} unread
                </span>
              )}
            </h3>
            <p className="text-[13px] text-[#626B65] mt-0.5">
              Direct private hospitality suggestions submitted by guests from their table QR hub.
            </p>
          </div>
        </div>

        {suggestions.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-[#626B65]">
            No suggestion box messages yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((sug) => (
              <div
                key={sug.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 ${
                  sug.isRead
                    ? 'border-[#DDE4DC] bg-[#FFFFFF]'
                    : 'border-[#A8BFA5] bg-[#EEF3EC]/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#626B65]">
                    <span className="font-semibold text-[#252B29]">
                      {sug.customerName || 'Table Guest'}
                    </span>
                    <span>·</span>
                    <span>{new Date(sug.createdAt).toLocaleString()}</span>
                    {!sug.isRead && (
                      <span className="rounded-full bg-[#244B40] px-2 py-0.5 text-[10px] font-semibold text-[#FFFFFF]">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] text-[#252B29]">{sug.message}</p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleMarkSuggestionRead(sug)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] px-3 py-1.5 text-[12px] font-medium text-[#252B29] hover:border-[#244B40] shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                  {sug.isRead ? 'Mark Unread' : 'Mark as Read'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
