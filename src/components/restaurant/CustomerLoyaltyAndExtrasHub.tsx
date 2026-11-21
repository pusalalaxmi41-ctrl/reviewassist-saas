import { useEffect, useRef, useState } from 'react';
import {
  Gift,
  QrCode,
  ArrowRightLeft,
  Wifi,
  Copy,
  Check,
  Inbox,
  Send,
  Star,
  Trophy,
  X,
  Ticket,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  BellRing,
  Receipt,
  ArrowLeft,
} from 'lucide-react';
import type {
  RestaurantCustomerWalletState,
  RestaurantLoyaltyRules,
  RestaurantReward,
  RestaurantRewardClaim,
  RestaurantTableCall,
  RestaurantTableCallType,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  buildCustomerLoyaltyQrToken,
  normalizeRestaurantLoyaltyRules,
} from '../../utils/restaurantValidation';
import { generateUrlQRMatrix } from '../../services/qr/qrGenerator';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';

export function CustomerLoyaltyHeroCard({
  businessId,
  businessSlug,
  businessName,
  loyaltyEnabled,
  loyaltyRules,
  rewards,
  wallet,
  onWalletUpdated,
  onEnsureCustomerWallet,
}: {
  businessId: string;
  businessSlug: string;
  businessName: string;
  loyaltyEnabled: boolean;
  loyaltyRules?: RestaurantLoyaltyRules;
  rewards?: RestaurantReward[];
  wallet: RestaurantCustomerWalletState | null;
  onWalletUpdated: (next: RestaurantCustomerWalletState) => void;
  onEnsureCustomerWallet: () => Promise<RestaurantCustomerWalletState | null>;
  onOpenRewards?: () => void;
}) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [profileName, setProfileName] = useState(
    () => wallet?.customer.displayName ?? '',
  );
  const [profileContact, setProfileContact] = useState(
    () => wallet?.customer.phoneOrEmail ?? '',
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const rules =
    loyaltyRules ?? normalizeRestaurantLoyaltyRules(businessId, undefined);
  const starsBalance = wallet?.loyaltyStarsBalance ?? 0;
  const gamePointsBalance = wallet?.gamePointsBalance ?? 0;

  const sortedRewards = [...(rewards ?? [])]
    .filter((r) => r.isActive)
    .sort((a, b) => a.starsRequired - b.starsRequired);
  const nextReward =
    sortedRewards.find((r) => r.starsRequired > starsBalance) ??
    sortedRewards[0] ??
    null;
  const targetStars = nextReward ? Math.max(nextReward.starsRequired, 5) : 5;
  const progressPercent = Math.min(
    100,
    Math.round((starsBalance / Math.max(1, targetStars)) * 100),
  );

  // Render high-contrast personal Loyalty QR Pass when modal is open
  useEffect(() => {
    if (!showQrModal || !wallet || !qrCanvasRef.current) return;
    const token = buildCustomerLoyaltyQrToken(businessSlug, wallet.customer.id);
    const matrix = generateUrlQRMatrix(token);
    const canvas = qrCanvasRef.current;
    const size = 280;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const cellSize = size / matrix.totalModules;
    const offset = matrix.quietZoneModules;
    ctx.fillStyle = '#1E1B4B';
    for (let r = 0; r < matrix.moduleCount; r++) {
      for (let c = 0; c < matrix.moduleCount; c++) {
        if (matrix.modules[r * matrix.moduleCount + c] === 1) {
          const x = Math.round((c + offset) * cellSize);
          const y = Math.round((r + offset) * cellSize);
          const nextX = Math.round((c + offset + 1) * cellSize);
          const nextY = Math.round((r + offset + 1) * cellSize);
          ctx.fillRect(x, y, Math.max(1, nextX - x), Math.max(1, nextY - y));
        }
      }
    }
  }, [showQrModal, wallet, businessSlug]);

  async function handleOpenQrPass() {
    const ensured = wallet ?? (await onEnsureCustomerWallet());
    if (ensured) {
      setProfileName(ensured.customer.displayName);
      setProfileContact(ensured.customer.phoneOrEmail ?? '');
      setProfileSavedMsg(null);
      setShowQrModal(true);
    }
  }

  async function handleSaveDinerContact(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    setSavingProfile(true);
    setProfileSavedMsg(null);
    try {
      const updated =
        await businessRepository.registerOrResumeRestaurantCustomer({
          displayName: profileName.trim() || wallet.customer.displayName,
          phoneOrEmail: profileContact.trim() || null,
          businessSlug,
        });
      onWalletUpdated(updated);
      setProfileSavedMsg('Saved! Your Stars & Points are linked across visits.');
    } catch {
      // ignore error
    } finally {
      setSavingProfile(false);
    }
  }

  if (!loyaltyEnabled) return null;

  return (
    <>
      {/* Slim Star Wallet Card (Matching Mockup 2) */}
      <div className="bistro-card p-4 flex items-center justify-between gap-3.5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[15px] font-extrabold text-[#111827] tabular-nums">
              <Star
                className="h-4.5 w-4.5 text-[#D97706]"
                fill="#D2DB76"
                aria-hidden
              />
              {starsBalance}/{targetStars} Stars
            </span>
            <span className="rounded-full bg-[#D2DB76]/55 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B] tabular-nums">
              {gamePointsBalance} pts
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div
            aria-label={`${starsBalance} of ${targetStars} loyalty stars collected`}
            className="h-2.5 w-full max-w-[210px] overflow-hidden rounded-full bg-[#1E1B4B]/10"
          >
            <div
              className="h-full rounded-full bg-[#1E1B4B] transition-all duration-500 ease-out"
              style={{ width: `${Math.max(8, progressPercent)}%` }}
            />
          </div>

          <p className="truncate text-[11px] font-medium text-[#6B7280]">
            {nextReward
              ? starsBalance >= nextReward.starsRequired
                ? `Unlocked: ${nextReward.title}!`
                : `${nextReward.starsRequired - starsBalance} more ★ for ${nextReward.title}`
              : `+${rules.starsPerVerifiedVisit} ★ per verified dining visit`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleOpenQrPass()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-[#1E1B4B] bg-[#FFFFFF] px-4 text-[13px] font-extrabold text-[#1E1B4B] shadow-2xs transition-all duration-150 hover:bg-[#1E1B4B] hover:text-[#FFFFFF] active:scale-[0.98] cursor-pointer"
        >
          <QrCode className="h-3.5 w-3.5" aria-hidden />
          <span>{wallet ? 'My QR' : 'Save Stars'}</span>
        </button>
      </div>

      {/* Personal Customer Loyalty QR Pass Modal */}
      {showQrModal && wallet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Personal Loyalty QR Pass"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#1E1B4B]/10 bg-[#FFFFFF] p-6 text-center shadow-2xl space-y-4 animate-fadeSlideUp">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D2DB76]/55 px-3 py-1 text-[12px] font-extrabold text-[#1E1B4B]">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                {wallet.customer.displayName}
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label="Close Loyalty QR modal"
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div>
              <h3 className="text-[20px] font-extrabold text-[#111827]">
                {businessName} Loyalty Pass
              </h3>
              <p className="text-[12px] text-[#6B7280] mt-0.5">
                Show this QR pass to your waiter to verify your visit and earn +{rules.starsPerVerifiedVisit} ★.
              </p>
            </div>

            <div className="mx-auto flex justify-center rounded-2xl border-2 border-[#1E1B4B] bg-[#FFFFFF] p-3 w-fit shadow-sm">
              <canvas
                ref={qrCanvasRef}
                aria-label="Customer Loyalty QR Code"
                className="h-52 w-52"
              />
            </div>

            <div className="rounded-xl bg-[#F8F9FA] px-3 py-2 text-[13px] font-semibold text-[#111827] tabular-nums">
              Balance: <strong className="text-[#1E1B4B]">★ {starsBalance} Stars</strong> •{' '}
              <strong>{gamePointsBalance} Game Points</strong>
            </div>

            {/* Optional Save Phone/Email to Keep Stars Across Devices */}
            <form
              onSubmit={(e) => void handleSaveDinerContact(e)}
              className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-3.5 text-left space-y-2.5"
            >
              <p className="text-[12px] font-bold text-[#111827]">
                Save Stars Across Future Visits
              </p>
              <div className="grid gap-2">
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Your Name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="block h-9 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] text-[#111827]"
                />
                <input
                  type="text"
                  maxLength={160}
                  placeholder="Phone or Email (e.g. +91 98765 43210)"
                  value={profileContact}
                  onChange={(e) => setProfileContact(e.target.value)}
                  className="block h-9 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] text-[#111827]"
                />
              </div>
              {profileSavedMsg && (
                <p className="text-[11px] font-semibold text-[#059669]">
                  {profileSavedMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full rounded-xl bg-[#1E1B4B]/10 py-2 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                {savingProfile ? 'Saving…' : 'Link Phone / Email to Pass'}
              </button>
            </form>

            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => setShowQrModal(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function CustomerRewardsAndExtrasView({
  businessId,
  businessSlug,
  businessName,
  tableKey,
  loyaltyRules,
  rewards,
  wallet,
  onWalletUpdated,
  onEnsureCustomerWallet,
  mode,
  onBackToMenu,
}: {
  businessId: string;
  businessSlug: string;
  businessName: string;
  tableKey?: string | null;
  loyaltyRules?: RestaurantLoyaltyRules;
  rewards?: RestaurantReward[];
  wallet: RestaurantCustomerWalletState | null;
  onWalletUpdated: (next: RestaurantCustomerWalletState) => void;
  onEnsureCustomerWallet: () => Promise<RestaurantCustomerWalletState | null>;
  mode: 'rewards' | 'extras';
  onBackToMenu?: () => void;
}) {
  const rules =
    loyaltyRules ?? normalizeRestaurantLoyaltyRules(businessId, undefined);
  const starsBalance = wallet?.loyaltyStarsBalance ?? 0;
  const gamePointsBalance = wallet?.gamePointsBalance ?? 0;
  const exchangedThisWeek = wallet?.starsExchangedThisWeek ?? 0;
  const activeClaims: RestaurantRewardClaim[] = wallet?.rewardClaims ?? [];

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [latestClaim, setLatestClaim] = useState<RestaurantRewardClaim | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wi-Fi & Suggestion Box state
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [suggestionName, setSuggestionName] = useState(
    () => wallet?.customer.displayName ?? '',
  );
  const [suggestionText, setSuggestionText] = useState('');
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  const [suggestionSent, setSuggestionSent] = useState(false);

  const canConvertPointsToStar =
    rules.allowPointExchange &&
    gamePointsBalance >= rules.pointsPerStarExchange &&
    exchangedThisWeek < rules.maxStarsViaExchangePerWeek;

  async function handleConvertPointsToStar() {
    setErrorMessage(null);
    setStatusMessage(null);
    const ensured = wallet ?? (await onEnsureCustomerWallet());
    if (!ensured) return;

    setExchanging(true);
    try {
      const idemKey = `exch-${ensured.customer.id}-${crypto.randomUUID()}`;
      const res = await businessRepository.exchangeGamePointsForStar({
        businessSlug,
        customerId: ensured.customer.id,
        idempotencyKey: idemKey,
      });

      const refreshed =
        await businessRepository.registerOrResumeRestaurantCustomer({
          displayName: ensured.customer.displayName,
          phoneOrEmail: ensured.customer.phoneOrEmail,
          businessSlug,
        });
      onWalletUpdated(refreshed);
      setStatusMessage(
        `Converted ${res.pointsSpent} Game Points into +${res.starsEarned} Loyalty Star!`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setExchanging(false);
    }
  }

  async function handleClaimReward(rwd: RestaurantReward) {
    setErrorMessage(null);
    setStatusMessage(null);
    const ensured = wallet ?? (await onEnsureCustomerWallet());
    if (!ensured) return;

    setClaimingId(rwd.id);
    try {
      const idemKey = `claim-${ensured.customer.id}-${rwd.id}-${crypto.randomUUID()}`;
      const res = await businessRepository.claimRestaurantReward({
        businessSlug,
        customerId: ensured.customer.id,
        rewardId: rwd.id,
        idempotencyKey: idemKey,
      });
      setLatestClaim(res.claim);

      const refreshed =
        await businessRepository.registerOrResumeRestaurantCustomer({
          displayName: ensured.customer.displayName,
          phoneOrEmail: ensured.customer.phoneOrEmail,
          businessSlug,
        });
      onWalletUpdated(refreshed);
      setStatusMessage(
        `Claimed "${rwd.title}"! Show claim code ${res.claim.claimCode} to your server.`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setClaimingId(null);
    }
  }

  async function handleCopyWifiPassword() {
    if (!rules.wifiPassword) return;
    const ok = await copyText(rules.wifiPassword);
    if (ok) {
      setCopiedWifi(true);
      window.setTimeout(() => setCopiedWifi(false), 2000);
    }
  }

  async function handleSubmitSuggestion(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSendingSuggestion(true);
    try {
      await businessRepository.submitRestaurantSuggestion({
        businessSlug,
        tableKey: tableKey ?? null,
        customerName:
          suggestionName.trim() || wallet?.customer.displayName || null,
        message: suggestionText,
      });
      setSuggestionText('');
      setSuggestionSent(true);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSendingSuggestion(false);
    }
  }

  if (mode === 'rewards') {
    const activeRewards = (rewards ?? []).filter((r) => r.isActive);

    return (
      <div className="space-y-4 animate-fadeSlideUp">
        {/* Top Back to Menu Header */}
        <div className="flex items-center justify-between">
          {onBackToMenu ? (
            <button
              type="button"
              onClick={onBackToMenu}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3.5 py-1.5 text-[13px] font-bold text-[#111827] shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Table Hub
            </button>
          ) : (
            <span />
          )}
          <span className="rounded-full bg-[#D2DB76]/60 px-3 py-1 text-[12px] font-extrabold text-[#1E1B4B] tabular-nums">
            ★ {starsBalance} Stars • {gamePointsBalance} pts
          </span>
        </div>

        {statusMessage && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-[#059669]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1-Tap Game Points -> Loyalty Star Conversion Card */}
        {rules.allowPointExchange && (
          <div className="bistro-card p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-[14px] font-extrabold text-[#111827] flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Convert Game Points to Stars
              </p>
              <p className="text-[12px] text-[#6B7280] tabular-nums">
                {rules.pointsPerStarExchange} pts = +1 ★ ({exchangedThisWeek}/
                {rules.maxStarsViaExchangePerWeek} used this week)
              </p>
            </div>
            <button
              type="button"
              disabled={!canConvertPointsToStar || exchanging}
              onClick={() => void handleConvertPointsToStar()}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-extrabold transition-all active:scale-[0.98] ${
                canConvertPointsToStar
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm cursor-pointer'
                  : 'bg-[#F8F9FA] text-[#6B7280] border border-[#1E1B4B]/10 cursor-not-allowed'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
              {exchanging ? 'Converting…' : 'Convert → +1 ★'}
            </button>
          </div>
        )}

        {/* Active Claim Tickets to Show Staff */}
        {(latestClaim || activeClaims.length > 0) && (
          <div className="rounded-2xl border-2 border-[#D2DB76] bg-[#D2DB76]/25 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-4.5 w-4.5 text-[#1E1B4B]" aria-hidden />
              <h3 className="text-[15px] font-extrabold text-[#111827]">
                Active Claim Tickets (Show to Server)
              </h3>
            </div>

            <div className="grid gap-2.5">
              {(latestClaim
                ? [
                    latestClaim,
                    ...activeClaims.filter((c) => c.id !== latestClaim.id),
                  ]
                : activeClaims
              ).map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#1E1B4B]/10 bg-[#FFFFFF] px-4 py-3 shadow-2xs"
                >
                  <div>
                    <p className="text-[14px] font-bold text-[#111827]">
                      {claim.rewardTitle || 'Loyalty Reward'}
                    </p>
                    <p className="text-[11px] font-medium text-[#6B7280]">
                      {claim.status === 'fulfilled'
                        ? 'Fulfilled ✓'
                        : 'Show 6-character code to waiter'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#1E1B4B] px-3.5 py-1.5 font-mono text-[15px] font-extrabold tracking-widest text-[#D2DB76]">
                    {claim.claimCode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reward Catalogue List */}
        <div className="bistro-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-extrabold text-[#111827] flex items-center gap-2">
                <Gift className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
                Reward Catalogue
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Redeem your Loyalty Stars for house perks at {businessName}.
              </p>
            </div>
          </div>

          {activeRewards.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#6B7280]">
              Reward perks are being updated by {businessName}. Keep collecting stars on every visit!
            </p>
          ) : (
            <div className="space-y-3">
              {activeRewards.map((rwd) => {
                const canAfford = starsBalance >= rwd.starsRequired;
                const isClaiming = claimingId === rwd.id;

                return (
                  <div
                    key={rwd.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#D2DB76]/60 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B] tabular-nums">
                          ★ {rwd.starsRequired}{' '}
                          {rwd.starsRequired === 1 ? 'Star' : 'Stars'}
                        </span>
                        <h4 className="text-[14px] font-bold text-[#111827]">
                          {rwd.title}
                        </h4>
                      </div>
                      {rwd.description && (
                        <p className="text-[12px] text-[#6B7280]">
                          {rwd.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford || isClaiming}
                      onClick={() => void handleClaimReward(rwd)}
                      className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-[12px] font-extrabold transition-all active:scale-[0.98] ${
                        canAfford
                          ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm cursor-pointer'
                          : 'bg-[#FFFFFF] text-[#6B7280] border border-[#1E1B4B]/15 cursor-not-allowed'
                      }`}
                    >
                      {isClaiming
                        ? 'Claiming…'
                        : canAfford
                          ? `Claim (${rwd.starsRequired} ★)`
                          : `Need ${rwd.starsRequired - starsBalance} ★`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // mode === 'extras' (Guest Wi-Fi + Private Suggestion Box)
  return (
    <div className="space-y-4 animate-fadeSlideUp">
      {onBackToMenu && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToMenu}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3.5 py-1.5 text-[13px] font-bold text-[#111827] shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Menu
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Guest Wi-Fi Card */}
      <div className="bistro-card p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
            <Wifi className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-[16px] font-extrabold text-[#111827]">
              Complimentary Guest Wi-Fi
            </h3>
            <p className="text-[12px] text-[#6B7280]">
              {rules.wifiNetworkName
                ? 'Tap to copy the table Wi-Fi password'
                : 'Ask your server for today’s guest Wi-Fi credentials'}
            </p>
          </div>
        </div>

        {rules.wifiNetworkName && (
          <div className="grid gap-2.5 sm:grid-cols-2 rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-3.5 text-[13px]">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Network (SSID)
              </span>
              <p className="font-bold text-[#111827]">{rules.wifiNetworkName}</p>
            </div>
            {rules.wifiPassword && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Password
                  </span>
                  <p className="font-mono font-bold text-[#1E1B4B]">
                    {rules.wifiPassword}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCopyWifiPassword()}
                >
                  {copiedWifi ? (
                    <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copiedWifi ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Private Suggestion Box */}
      {rules.suggestionBoxEnabled && (
        <div className="bistro-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
              <Inbox className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold text-[#111827]">
                Private Suggestion Box
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Send a direct private note to the management of {businessName}.
              </p>
            </div>
          </div>

          {suggestionSent ? (
            <div
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center space-y-2"
            >
              <p className="text-[14px] font-bold text-[#059669]">
                Thank you! Your private note has been sent to {businessName}.
              </p>
              <button
                type="button"
                onClick={() => setSuggestionSent(false)}
                className="text-[12px] font-semibold text-[#111827] underline cursor-pointer"
              >
                Send another suggestion
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSubmitSuggestion(e)}
              className="space-y-3"
            >
              <input
                type="text"
                maxLength={80}
                placeholder="Your Name (Optional)"
                value={suggestionName}
                onChange={(e) => setSuggestionName(e.target.value)}
                className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[13px] text-[#111827]"
              />
              <textarea
                rows={3}
                required
                minLength={2}
                maxLength={1000}
                placeholder="Tell us how we can make your table experience even better…"
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                className="block w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] p-3.5 text-[13px] text-[#111827]"
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={sendingSuggestion || suggestionText.trim().length < 2}
              >
                <Send className="h-4 w-4" aria-hidden />
                {sendingSuggestion ? 'Sending…' : 'Send Private Suggestion'}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomerFloatingServicePill({
  businessSlug,
  tableKey,
  tableNumber,
  customerId,
  onOpenWifiAndExtras,
}: {
  businessSlug: string;
  tableKey?: string | null;
  tableNumber?: string | null;
  customerId?: string | null;
  onOpenWifiAndExtras: () => void;
}) {
  const [showCallSheet, setShowCallSheet] = useState(false);
  const [activeCall, setActiveCall] = useState<RestaurantTableCall | null>(
    null,
  );
  const [callingType, setCallingType] =
    useState<RestaurantTableCallType | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  async function handleRequestStaff(callType: RestaurantTableCallType) {
    if (!tableKey) {
      setCallError(
        'Scan the QR standee on your table so your waiter knows which table to visit.',
      );
      return;
    }
    setCallError(null);
    setCallingType(callType);
    try {
      const created = await businessRepository.createRestaurantTableCall({
        businessSlug,
        tableKey,
        customerId: customerId ?? null,
        callType,
      });
      setActiveCall(created);
    } catch (err) {
      setCallError((err as Error).message);
    } finally {
      setCallingType(null);
    }
  }

  return (
    <>
      {/* Fixed Bottom Service Pill Bar (Matches Mockup 2) */}
      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2">
        <div className="flex items-center justify-between gap-2 rounded-full bg-[#1E1B4B] p-2 pl-4 text-[#FFFFFF] shadow-2xl border border-[#FFFFFF]/10">
          <button
            type="button"
            onClick={() => setShowCallSheet(true)}
            className="inline-flex items-center gap-2 py-1.5 text-[14px] font-bold text-[#FFFFFF] active:scale-[0.98] transition-transform cursor-pointer"
          >
            <BellRing className="h-4 w-4 text-[#D2DB76]" aria-hidden />
            <span>
              {activeCall
                ? activeCall.callType === 'ready_for_bill'
                  ? 'Bill Requested ✓'
                  : 'Waiter Notified ✓'
                : 'Call Waiter'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenWifiAndExtras}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFFFF]/15 px-4 py-2 text-[13px] font-bold text-[#FFFFFF] hover:bg-[#FFFFFF]/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Wi-Fi</span>
            <Wifi className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
          </button>
        </div>
      </div>

      {/* 2-Tap Waiter Call Bottom Sheet */}
      {showCallSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Call Waiter"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFFFF] p-6 shadow-2xl space-y-4 animate-fadeSlideUp">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-extrabold text-[#111827]">
                  Table Service {tableNumber ? `• ${tableNumber}` : ''}
                </h3>
                <p className="text-[12px] text-[#6B7280]">
                  Notify your server right from your table
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCallSheet(false)}
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {callError && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[12px] font-medium text-[#D97706]">
                {callError}
              </p>
            )}

            {activeCall && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-[13px] font-bold text-[#059669] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {activeCall.callType === 'ready_for_bill'
                    ? 'Your server has been notified to bring your bill.'
                    : 'Your server has been notified and will be right with you.'}
                </span>
              </div>
            )}

            <div className="grid gap-3">
              <button
                type="button"
                disabled={callingType !== null}
                onClick={() => void handleRequestStaff('assistance')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E1B4B] px-4 py-3 text-[14px] font-bold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
              >
                <BellRing className="h-4 w-4 text-[#D2DB76]" aria-hidden />
                {callingType === 'assistance'
                  ? 'Notifying Server…'
                  : 'Need Assistance at Table'}
              </button>

              <button
                type="button"
                disabled={callingType !== null}
                onClick={() => void handleRequestStaff('ready_for_bill')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#1E1B4B] bg-[#FFFFFF] px-4 py-3 text-[14px] font-bold text-[#111827] hover:bg-[#F8F9FA] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Receipt className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                {callingType === 'ready_for_bill'
                  ? 'Notifying Server…'
                  : 'Ready for Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
