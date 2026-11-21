import { useEffect, useRef, useState } from 'react';
import {
  Award,
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
  onOpenRewards,
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
  onOpenRewards: () => void;
}) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [heroMessage, setHeroMessage] = useState<string | null>(null);
  const [heroError, setHeroError] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const rules =
    loyaltyRules ?? normalizeRestaurantLoyaltyRules(businessId, undefined);
  const starsBalance = wallet?.loyaltyStarsBalance ?? 0;
  const gamePointsBalance = wallet?.gamePointsBalance ?? 0;
  const exchangedThisWeek = wallet?.starsExchangedThisWeek ?? 0;

  // Next reward star target
  const sortedRewards = [...(rewards ?? [])]
    .filter((r) => r.isActive)
    .sort((a, b) => a.starsRequired - b.starsRequired);
  const nextReward =
    sortedRewards.find((r) => r.starsRequired > starsBalance) ??
    sortedRewards[0] ??
    null;
  const targetStars = nextReward ? Math.max(nextReward.starsRequired, 5) : 5;
  const displaySlotCount = Math.min(Math.max(targetStars, 5), 10);

  const canConvertPointsToStar =
    loyaltyEnabled &&
    rules.allowPointExchange &&
    gamePointsBalance >= rules.pointsPerStarExchange &&
    exchangedThisWeek < rules.maxStarsViaExchangePerWeek;

  // Render high-contrast personal Loyalty QR Pass when modal is open
  useEffect(() => {
    if (!showQrModal || !wallet || !qrCanvasRef.current) return;
    const token = buildCustomerLoyaltyQrToken(businessSlug, wallet.customer.id);
    const matrix = generateUrlQRMatrix(token);
    const canvas = qrCanvasRef.current;
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const cellSize = size / matrix.totalModules;
    const offset = matrix.quietZoneModules;
    ctx.fillStyle = '#111827';
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
    setHeroError(null);
    const ensured = wallet ?? (await onEnsureCustomerWallet());
    if (ensured) {
      setShowQrModal(true);
    }
  }

  async function handleConvertPointsToStar() {
    setHeroError(null);
    setHeroMessage(null);
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
      setHeroMessage(
        `Converted ${res.pointsSpent} Game Points into +${res.starsEarned} Loyalty Star!`,
      );
    } catch (err) {
      setHeroError((err as Error).message);
    } finally {
      setExchanging(false);
    }
  }

  if (!loyaltyEnabled) return null;

  return (
    <>
      <div className="rounded-3xl border border-[#244B40] bg-[#244B40] p-5 text-[#FFFFFF] shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFFFF]/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#FAF3DF]">
              <Award className="h-3.5 w-3.5 text-[#E4BD63]" aria-hidden />
              Restaurant Loyalty Pass
            </span>
            <h2 className="text-[20px] font-bold tracking-tight">
              {starsBalance} / {targetStars} Loyalty Stars
            </h2>
            <p className="text-[12px] text-[#E8EFEA]">
              {nextReward
                ? starsBalance >= nextReward.starsRequired
                  ? `Ready to claim: ${nextReward.title}!`
                  : `${nextReward.starsRequired - starsBalance} more ${nextReward.starsRequired - starsBalance === 1 ? 'Star' : 'Stars'} to unlock ${nextReward.title}`
                : `Earn +${rules.starsPerVerifiedVisit} Star per verified dining visit`}
            </p>
          </div>

          {/* Separate Game Points Pill */}
          <div className="rounded-2xl border border-[#FFFFFF]/20 bg-[#FFFFFF]/10 px-3.5 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#E8EFEA]">
              Game Points
            </p>
            <p className="text-[16px] font-bold text-[#FAF3DF] flex items-center justify-end gap-1">
              <Trophy className="h-3.5 w-3.5 text-[#E4BD63]" aria-hidden />
              {gamePointsBalance} pts
            </p>
          </div>
        </div>

        {/* Visual Star Tracker Slots */}
        <div
          aria-label={`${starsBalance} of ${targetStars} loyalty stars collected`}
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#1C3B32] p-3"
        >
          {Array.from({ length: displaySlotCount }).map((_, idx) => {
            const filled = idx < starsBalance;
            return (
              <div
                key={idx}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                  filled
                    ? 'border-[#E4BD63] bg-[#E4BD63] text-[#252B29] shadow-2xs scale-105'
                    : 'border-[#FFFFFF]/25 bg-[#FFFFFF]/5 text-[#FFFFFF]/40'
                }`}
              >
                <Star
                  className="h-4 w-4"
                  fill={filled ? 'currentColor' : 'none'}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>

        {/* Actions: Show My Loyalty QR + Convert Points -> Star + Browse Rewards */}
        <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={() => void handleOpenQrPass()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#FAF3DF] px-4 py-2 text-[13px] font-bold text-[#252B29] hover:bg-[#FFFFFF] transition-colors cursor-pointer"
          >
            <QrCode className="h-4 w-4 text-[#244B40]" aria-hidden />
            Show My Loyalty QR
          </button>

          {rules.allowPointExchange && (
            <button
              type="button"
              disabled={!canConvertPointsToStar || exchanging}
              onClick={() => void handleConvertPointsToStar()}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                canConvertPointsToStar
                  ? 'border-[#E4BD63] bg-[#E4BD63] text-[#252B29] hover:bg-[#FAF3DF] cursor-pointer'
                  : 'border-[#FFFFFF]/25 bg-[#FFFFFF]/10 text-[#E8EFEA] opacity-80 cursor-not-allowed'
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
              {exchanging
                ? 'Converting…'
                : `Convert ${rules.pointsPerStarExchange} pts → +1 ★ (${exchangedThisWeek}/${rules.maxStarsViaExchangePerWeek} wk)`}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenRewards}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#FFFFFF]/30 bg-[#FFFFFF]/10 px-3.5 py-2 text-[12px] font-semibold text-[#FFFFFF] hover:bg-[#FFFFFF]/20 cursor-pointer"
          >
            <Gift className="h-3.5 w-3.5 text-[#E4BD63]" aria-hidden />
            Rewards ({sortedRewards.length})
          </button>
        </div>

        {heroMessage && (
          <div
            role="status"
            className="rounded-xl bg-[#FFFFFF]/15 px-3.5 py-2 text-[12px] font-semibold text-[#FAF3DF]"
          >
            {heroMessage}
          </div>
        )}
        {heroError && (
          <div
            role="alert"
            className="rounded-xl bg-red-900/60 border border-red-300/40 px-3.5 py-2 text-[12px] font-medium text-red-100"
          >
            {heroError}
          </div>
        )}
      </div>

      {/* Personal Customer Loyalty QR Pass Modal */}
      {showQrModal && wallet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Personal Loyalty QR Pass"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 text-center shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF3EC] px-3 py-1 text-[12px] font-bold text-[#244B40]">
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                {wallet.customer.displayName}
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label="Close Loyalty QR modal"
                className="rounded-full p-1.5 text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div>
              <h3 className="text-[19px] font-bold text-[#252B29]">
                {businessName} Loyalty Pass
              </h3>
              <p className="text-[12px] text-[#626B65] mt-0.5">
                Show this QR pass to your server or cashier to collect your visit star.
              </p>
            </div>

            <div className="mx-auto flex justify-center rounded-2xl border-2 border-[#244B40] bg-[#FFFFFF] p-3 w-fit">
              <canvas
                ref={qrCanvasRef}
                aria-label="Customer Loyalty QR Code"
                className="h-56 w-56"
              />
            </div>

            <div className="rounded-xl bg-[#F7F7F2] px-3 py-2 text-[12px] text-[#252B29]">
              Current Balance: <strong className="text-[#244B40]">{starsBalance} Stars</strong> ·{' '}
              <strong>{gamePointsBalance} Game Points</strong>
            </div>

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
}) {
  const rules =
    loyaltyRules ?? normalizeRestaurantLoyaltyRules(businessId, undefined);
  const starsBalance = wallet?.loyaltyStarsBalance ?? 0;
  const activeClaims: RestaurantRewardClaim[] = wallet?.rewardClaims ?? [];

  const [claimingId, setClaimingId] = useState<string | null>(null);
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
      <div className="space-y-4">
        {statusMessage && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC] px-4 py-3 text-[13px] font-semibold text-[#244B40]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Active Claim Tickets to Show Staff */}
        {(latestClaim || activeClaims.length > 0) && (
          <div className="rounded-3xl border-2 border-[#E4BD63] bg-[#FAF3DF] p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-[#244B40]" aria-hidden />
              <h3 className="text-[16px] font-bold text-[#252B29]">
                Your Reward Claim Tickets (Show to Server)
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
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] px-4 py-3"
                >
                  <div>
                    <p className="text-[14px] font-bold text-[#252B29]">
                      {claim.rewardTitle || 'Loyalty Reward'}
                    </p>
                    <p className="text-[11px] text-[#626B65]">
                      Status:{' '}
                      {claim.status === 'fulfilled'
                        ? 'Fulfilled ✓'
                        : 'Show 6-character code to staff'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#244B40] px-3.5 py-1.5 font-mono text-[16px] font-bold tracking-widest text-[#FFFFFF]">
                    {claim.claimCode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reward Catalogue List */}
        <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-bold text-[#252B29] flex items-center gap-2">
                <Gift className="h-5 w-5 text-[#244B40]" aria-hidden />
                {businessName} Reward Catalogue
              </h3>
              <p className="text-[12px] text-[#626B65]">
                Redeem your Loyalty Stars for house specials.
              </p>
            </div>
            <span className="rounded-full bg-[#EEF3EC] px-3 py-1 text-[12px] font-bold text-[#244B40]">
              ★ {starsBalance} {starsBalance === 1 ? 'Star' : 'Stars'} Available
            </span>
          </div>

          {activeRewards.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#626B65]">
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-2.5 py-0.5 text-[12px] font-bold text-[#252B29]">
                          ★ {rwd.starsRequired}{' '}
                          {rwd.starsRequired === 1 ? 'Star' : 'Stars'}
                        </span>
                        <h4 className="text-[15px] font-bold text-[#252B29]">
                          {rwd.title}
                        </h4>
                      </div>
                      {rwd.description && (
                        <p className="text-[12px] text-[#626B65]">
                          {rwd.description}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant={canAfford ? 'primary' : 'secondary'}
                      disabled={!canAfford || isClaiming}
                      onClick={() => void handleClaimReward(rwd)}
                    >
                      {isClaiming
                        ? 'Claiming…'
                        : canAfford
                          ? `Claim (${rwd.starsRequired} ★)`
                          : `Need ${rwd.starsRequired - starsBalance} more ★`}
                    </Button>
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
    <div className="space-y-4">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Guest Wi-Fi Card */}
      {rules.wifiNetworkName && (
        <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF3EC] text-[#244B40]">
              <Wifi className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#252B29]">
                Complimentary Guest Wi-Fi
              </h3>
              <p className="text-[12px] text-[#626B65]">
                Connect to our table Wi-Fi network below
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2] p-3.5 text-[13px]">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#626B65]">
                Network (SSID)
              </span>
              <p className="font-bold text-[#252B29]">{rules.wifiNetworkName}</p>
            </div>
            {rules.wifiPassword && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#626B65]">
                    Password
                  </span>
                  <p className="font-mono font-bold text-[#244B40]">
                    {rules.wifiPassword}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCopyWifiPassword()}
                >
                  {copiedWifi ? (
                    <Check className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copiedWifi ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Private Suggestion Box */}
      {rules.suggestionBoxEnabled && (
        <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF3EC] text-[#244B40]">
              <Inbox className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#252B29]">
                Private Suggestion Box
              </h3>
              <p className="text-[12px] text-[#626B65]">
                Share a private note or dish request directly with the management of {businessName}.
              </p>
            </div>
          </div>

          {suggestionSent ? (
            <div
              role="status"
              className="rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC]/70 p-4 text-center space-y-2"
            >
              <p className="text-[14px] font-bold text-[#244B40]">
                Thank you! Your private note has been sent to {businessName}.
              </p>
              <button
                type="button"
                onClick={() => setSuggestionSent(false)}
                className="text-[12px] font-semibold text-[#252B29] underline cursor-pointer"
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
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[13px] text-[#252B29]"
              />
              <textarea
                rows={3}
                required
                minLength={2}
                maxLength={1000}
                placeholder="Tell us how we can make your table experience even better…"
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                className="block w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] p-3.5 text-[13px] text-[#252B29]"
              />
              <Button
                type="submit"
                variant="primary"
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

export function CustomerTableServiceCallBar({
  businessSlug,
  tableKey,
  tableNumber,
  customerId,
}: {
  businessSlug: string;
  tableKey: string;
  tableNumber: string;
  customerId?: string | null;
}) {
  const [activeCall, setActiveCall] = useState<RestaurantTableCall | null>(
    null,
  );
  const [callingType, setCallingType] =
    useState<RestaurantTableCallType | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  async function handleRequestStaff(callType: RestaurantTableCallType) {
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
    <div className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2] px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-[#244B40]" aria-hidden />
          <span className="text-[13px] font-semibold text-[#252B29]">
            Table Service ({tableNumber}):
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={callingType !== null}
            onClick={() => void handleRequestStaff('assistance')}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
              activeCall?.callType === 'assistance'
                ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF]'
                : 'border-[#87928A] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40] hover:bg-[#EEF3EC]'
            }`}
          >
            <BellRing className="h-3.5 w-3.5" aria-hidden />
            {callingType === 'assistance'
              ? 'Notifying…'
              : activeCall?.callType === 'assistance'
                ? 'Waiter Notified ✓'
                : 'Call Waiter'}
          </button>

          <button
            type="button"
            disabled={callingType !== null}
            onClick={() => void handleRequestStaff('ready_for_bill')}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
              activeCall?.callType === 'ready_for_bill'
                ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF]'
                : 'border-[#87928A] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40] hover:bg-[#EEF3EC]'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" aria-hidden />
            {callingType === 'ready_for_bill'
              ? 'Notifying…'
              : activeCall?.callType === 'ready_for_bill'
                ? 'Bill Requested ✓'
                : 'Ready for Bill'}
          </button>
        </div>
      </div>

      {activeCall && (
        <p
          role="status"
          className="text-[12px] font-medium text-[#244B40]"
        >
          {activeCall.callType === 'ready_for_bill'
            ? `Staff notified that ${tableNumber} is ready for the bill.`
            : `Waiter notified for ${tableNumber} — someone will be right with you!`}
        </p>
      )}
      {callError && (
        <p role="alert" className="text-[12px] font-medium text-red-700">
          {callError}
        </p>
      )}
    </div>
  );
}
