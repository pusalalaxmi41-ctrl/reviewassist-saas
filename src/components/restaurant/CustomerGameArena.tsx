import { useEffect, useState } from 'react';
import {
  Gamepad2,
  Trophy,
  UserCheck,
  Sparkles,
  Users,
  User,
  RotateCcw,
  History,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import type {
  RestaurantCustomerWalletState,
  RestaurantGameCompletionResponse,
  RestaurantGameConfig,
  RestaurantGameSlug,
  RestaurantGameStartResponse,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  DEFAULT_GAME_CATALOG,
  getDefaultRestaurantGameConfigs,
} from '../../utils/restaurantValidation';
import { Button } from '../common/Button';

interface Props {
  businessId: string;
  businessSlug: string;
  businessName: string;
  tableKey?: string | null;
  tableNumber?: string | null;
  availableGames?: RestaurantGameConfig[];
  onWalletUpdated?: (wallet: RestaurantCustomerWalletState) => void;
  onClose?: () => void;
}

const CUSTOMER_STORAGE_KEY = 'vitaran_diner_session_v1';

interface StoredDinerIdentity {
  displayName: string;
  phoneOrEmail: string | null;
  guestTokenHash: string;
}

function getOrCreateGuestTokenHash(): string {
  const randomPart = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `guest-${randomPart}`;
}

function loadStoredDinerIdentity(): StoredDinerIdentity | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as StoredDinerIdentity;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveStoredDinerIdentity(identity: StoredDinerIdentity): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify(identity),
      );
    }
  } catch {
    // ignore storage errors
  }
}

export function CustomerGameArena({
  businessId,
  businessSlug,
  businessName,
  tableKey,
  tableNumber,
  availableGames,
  onWalletUpdated,
  onClose,
}: Props) {
  const [wallet, setWallet] = useState<RestaurantCustomerWalletState | null>(
    null,
  );
  const [displayName, setDisplayName] = useState(
    () => loadStoredDinerIdentity()?.displayName ?? '',
  );
  const [phoneOrEmail, setPhoneOrEmail] = useState(
    () => loadStoredDinerIdentity()?.phoneOrEmail ?? '',
  );
  const [checkingIn, setCheckingIn] = useState(false);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Game Session state
  const [activeSession, setActiveSession] =
    useState<RestaurantGameStartResponse | null>(null);
  const [sessionIdempotencyKey, setSessionIdempotencyKey] =
    useState<string>('');
  const [startingGameSlug, setStartingGameSlug] = useState<string | null>(null);
  const [submittingGame, setSubmittingGame] = useState(false);
  const [completionResult, setCompletionResult] =
    useState<RestaurantGameCompletionResponse | null>(null);

  // Trivia & Table Word Chain state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(
    {},
  );
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

  // Memory Match state
  const [memoryDeck, setMemoryDeck] = useState<string[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedIndices, setMatchedIndices] = useState<number[]>([]);
  const [movesTaken, setMovesTaken] = useState(0);

  const gamesList =
    availableGames && availableGames.length > 0
      ? availableGames.filter((g) => g.isEnabled)
      : getDefaultRestaurantGameConfigs(businessId);

  useEffect(() => {
    const stored = loadStoredDinerIdentity();
    if (!stored) return;

    async function resume() {
      try {
        const state = await businessRepository.registerOrResumeRestaurantCustomer(
          {
            displayName: stored!.displayName,
            phoneOrEmail: stored!.phoneOrEmail,
            guestTokenHash: stored!.guestTokenHash,
            businessSlug,
          },
        );
        setWallet(state);
        onWalletUpdated?.(state);
      } catch {
        // ignore auto-resume error
      }
    }
    void resume();
  }, [businessSlug, onWalletUpdated]);

  async function handleCheckIn(
    e?: React.FormEvent,
    instantGuest = false,
  ) {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setCheckingIn(true);

    try {
      const existing = loadStoredDinerIdentity();
      const guestTokenHash =
        existing?.guestTokenHash ?? getOrCreateGuestTokenHash();
      const finalName = instantGuest
        ? displayName.trim() || 'Guest Diner'
        : displayName.trim();
      const finalContact = instantGuest
        ? null
        : phoneOrEmail.trim() || null;

      const state = await businessRepository.registerOrResumeRestaurantCustomer(
        {
          displayName: finalName,
          phoneOrEmail: finalContact,
          guestTokenHash,
          businessSlug,
        },
      );

      saveStoredDinerIdentity({
        displayName: state.customer.displayName,
        phoneOrEmail: state.customer.phoneOrEmail,
        guestTokenHash,
      });

      setWallet(state);
      onWalletUpdated?.(state);
      setDisplayName(state.customer.displayName);
      setPhoneOrEmail(state.customer.phoneOrEmail ?? '');
      setShowCheckInForm(false);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleStartGame(gameSlug: RestaurantGameSlug) {
    setErrorMessage(null);
    setCompletionResult(null);

    let activeWallet = wallet;
    if (!activeWallet) {
      try {
        const guestTokenHash = getOrCreateGuestTokenHash();
        activeWallet =
          await businessRepository.registerOrResumeRestaurantCustomer({
            displayName: displayName.trim() || 'Guest Diner',
            phoneOrEmail: phoneOrEmail.trim() || null,
            guestTokenHash,
            businessSlug,
          });
        saveStoredDinerIdentity({
          displayName: activeWallet.customer.displayName,
          phoneOrEmail: activeWallet.customer.phoneOrEmail,
          guestTokenHash,
        });
        setWallet(activeWallet);
        onWalletUpdated?.(activeWallet);
        setDisplayName(activeWallet.customer.displayName);
      } catch (err) {
        setErrorMessage((err as Error).message);
        return;
      }
    }

    setStartingGameSlug(gameSlug);
    try {
      const started = await businessRepository.startRestaurantGameSession({
        businessSlug,
        tableKey: tableKey ?? null,
        customerId: activeWallet.customer.id,
        gameSlug,
      });

      setActiveSession(started);
      setSessionIdempotencyKey(`idem-${started.sessionId}`);
      setSelectedAnswers({});
      setCurrentRoundIndex(0);

      if (started.gameSlug === 'memory-match') {
        const sourceCards = started.challenge.cards ?? [
          '🍛',
          '🍛',
          '🥗',
          '🥗',
          '🍹',
          '🍹',
          '🥘',
          '🥘',
        ];
        const shuffled = [...sourceCards].sort(() => Math.random() - 0.5);
        setMemoryDeck(shuffled);
        setFlippedIndices([]);
        setMatchedIndices([]);
        setMovesTaken(0);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setStartingGameSlug(null);
    }
  }

  function handleFlipMemoryCard(idx: number) {
    if (
      !activeSession ||
      submittingGame ||
      completionResult ||
      flippedIndices.includes(idx) ||
      matchedIndices.includes(idx) ||
      flippedIndices.length >= 2
    ) {
      return;
    }

    const nextFlipped = [...flippedIndices, idx];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = movesTaken + 1;
      setMovesTaken(nextMoves);
      const [firstIdx, secondIdx] = nextFlipped;

      if (memoryDeck[firstIdx] === memoryDeck[secondIdx]) {
        const nextMatched = [...matchedIndices, firstIdx, secondIdx];
        setMatchedIndices(nextMatched);
        setFlippedIndices([]);

        if (nextMatched.length === memoryDeck.length) {
          void handleSubmitGame({
            matchedPairs: nextMatched.length / 2,
            movesTaken: nextMoves,
          });
        }
      } else {
        window.setTimeout(() => {
          setFlippedIndices([]);
        }, 650);
      }
    }
  }

  async function handleSubmitGame(customSubmission?: {
    matchedPairs?: number;
    movesTaken?: number;
  }) {
    if (!activeSession || !wallet || submittingGame) return;
    setSubmittingGame(true);
    setErrorMessage(null);

    try {
      const totalItems =
        activeSession.gameSlug === 'dish-trivia'
          ? (activeSession.challenge.questions?.length ?? 0)
          : activeSession.gameSlug === 'table-word-chain'
            ? (activeSession.challenge.rounds?.length ?? 0)
            : 0;

      const orderedAnswers: number[] = [];
      for (let i = 0; i < totalItems; i++) {
        orderedAnswers.push(selectedAnswers[i] ?? -1);
      }

      const res = await businessRepository.completeRestaurantGameSession({
        sessionId: activeSession.sessionId,
        customerId: wallet.customer.id,
        submission: customSubmission ?? { answers: orderedAnswers },
        idempotencyKey: sessionIdempotencyKey || `idem-${activeSession.sessionId}`,
      });

      setCompletionResult(res);

      const stored = loadStoredDinerIdentity();
      const refreshed =
        await businessRepository.registerOrResumeRestaurantCustomer({
          displayName: wallet.customer.displayName,
          phoneOrEmail: wallet.customer.phoneOrEmail,
          guestTokenHash: stored?.guestTokenHash ?? null,
          businessSlug,
        });
      setWallet(refreshed);
      onWalletUpdated?.(refreshed);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmittingGame(false);
    }
  }

  return (
    <div className="space-y-4 animate-fadeSlideUp">
      {/* Top Back to Menu Bar */}
      <div className="flex items-center justify-between">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3.5 py-1.5 text-[13px] font-bold text-[#111827] shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Table Hub
          </button>
        ) : (
          <span />
        )}

        <div
          data-testid="game-points-wallet-badge"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#D2DB76]/60 px-3.5 py-1 text-[12px] font-extrabold text-[#1E1B4B] tabular-nums"
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          <span>{wallet?.gamePointsBalance ?? 0} Game Points</span>
        </div>
      </div>

      {/* Top Game Points Wallet & Customer Check-In Card */}
      <div className="bistro-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-extrabold text-[#111827] flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
                Table Game Arena
              </h2>
              {tableNumber && (
                <span className="rounded-full bg-[#D2DB76]/55 px-2.5 py-0.5 text-[11px] font-bold text-[#1E1B4B]">
                  {tableNumber}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-[#6B7280]">
              Win Game Points while your meal is prepared at {businessName}.
            </p>
          </div>
        </div>

        {/* Customer Identity Bar / 1-Step Check-In */}
        {!wallet || showCheckInForm ? (
          <form
            onSubmit={(e) => void handleCheckIn(e, false)}
            className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#111827] flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Save Your Game Points &amp; Stars Across Visits
              </p>
              {wallet && (
                <button
                  type="button"
                  onClick={() => setShowCheckInForm(false)}
                  className="text-[12px] font-medium text-[#6B7280] hover:text-[#111827] cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>

            <div className="grid gap-2.5">
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Your Name (e.g. Aarav)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="block h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] text-[#111827]"
              />
              <input
                type="text"
                maxLength={160}
                placeholder="Phone or Email (Optional — saves across visits)"
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                className="block h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] text-[#111827]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" disabled={checkingIn}>
                {checkingIn ? 'Saving…' : 'Save Diner Profile'}
              </Button>
              {!wallet && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={checkingIn}
                  onClick={() => void handleCheckIn(undefined, true)}
                >
                  Play as Instant Guest
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] px-3.5 py-2.5 text-[12px]">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
              <span className="font-bold text-[#111827]">
                {wallet.customer.displayName}
              </span>
              {wallet.customer.phoneOrEmail ? (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
                  Linked
                </span>
              ) : (
                <span className="rounded-full bg-[#D2DB76]/45 px-2 py-0.5 text-[11px] font-semibold text-[#1E1B4B]">
                  Guest
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCheckInForm(true)}
                className="font-bold text-[#1E1B4B] hover:underline cursor-pointer"
              >
                {wallet.customer.phoneOrEmail ? 'Edit' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={() => setShowLedger((prev) => !prev)}
                className="inline-flex items-center gap-1 font-bold text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <History className="h-3.5 w-3.5" aria-hidden />
                {showLedger ? 'Hide History' : 'Ledger'}
              </button>
            </div>
          </div>
        )}

        {/* Expandable Game-Points Ledger History */}
        {showLedger && wallet && (
          <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-3.5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
              Game Points Ledger (Separate from Loyalty Stars)
            </p>
            {wallet.recentTransactions.length === 0 ? (
              <p className="text-[12px] text-[#6B7280]">
                No game point transactions yet. Win a game below to earn your first points!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {wallet.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl bg-[#FFFFFF] border border-[#1E1B4B]/10 px-3 py-2 text-[12px] tabular-nums"
                  >
                    <div>
                      <span className="font-bold text-[#111827]">
                        {tx.txType === 'game_win'
                          ? `Game Win (${String(tx.metadata?.gameSlug ?? 'Table Game')})`
                          : tx.txType}
                      </span>
                      <p className="text-[11px] text-[#6B7280]">
                        Balance: {tx.balanceAfter} pts
                      </p>
                    </div>
                    <span
                      className={`font-extrabold ${
                        tx.pointsDelta >= 0 ? 'text-[#059669]' : 'text-red-700'
                      }`}
                    >
                      {tx.pointsDelta >= 0 ? `+${tx.pointsDelta}` : tx.pointsDelta} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ACTIVE GAME PLAY VIEW vs. GAME SELECTION LOBBY */}
      {activeSession ? (
        <div className="bistro-card p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#1E1B4B]/10 pb-3.5">
            <div>
              <span className="rounded-full bg-[#D2DB76]/60 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B] tabular-nums">
                Win +{activeSession.pointsPerWin} Game Points
              </span>
              <h3 className="mt-1 text-[19px] font-extrabold text-[#111827]">
                {activeSession.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setCompletionResult(null);
              }}
              className="rounded-full border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3.5 py-1.5 text-[12px] font-bold text-[#111827] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors cursor-pointer"
            >
              All Games
            </button>
          </div>

          {completionResult ? (
            <div className="rounded-2xl border border-[#D2DB76] bg-[#D2DB76]/20 p-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
                {completionResult.passed ? (
                  <Trophy className="h-6 w-6" aria-hidden />
                ) : (
                  <RotateCcw className="h-6 w-6" aria-hidden />
                )}
              </div>
              <h4 className="text-[20px] font-extrabold text-[#111827]">
                {completionResult.passed
                  ? `You Won +${completionResult.pointsAwarded} Game Points!`
                  : 'Good Try! Almost There'}
              </h4>
              <p className="text-[13px] text-[#6B7280] tabular-nums">
                {completionResult.passed
                  ? `Score: ${completionResult.score} • Updated balance: ${completionResult.newBalance} pts.`
                  : `Score: ${completionResult.score}. Try another game to earn points!`}
              </p>
              <div className="flex justify-center gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setActiveSession(null);
                    setCompletionResult(null);
                  }}
                >
                  Back to Game Lobby
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* GAME 1: CHEF'S TABLE TRIVIA (dish-trivia) */}
              {activeSession.gameSlug === 'dish-trivia' &&
                activeSession.challenge.questions && (
                  <div className="space-y-4">
                    {activeSession.challenge.questions.map((q) => (
                      <div
                        key={q.index}
                        className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-4 space-y-2.5"
                      >
                        <p className="text-[14px] font-bold text-[#111827]">
                          {q.index + 1}. {q.prompt}
                        </p>
                        <div className="grid gap-2">
                          {q.options.map((opt, optIdx) => {
                            const selected =
                              selectedAnswers[q.index] === optIdx;
                            return (
                              <button
                                key={`${q.index}-${optIdx}`}
                                type="button"
                                onClick={() =>
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [q.index]: optIdx,
                                  }))
                                }
                                className={`rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                                  selected
                                    ? 'border-[#1E1B4B] bg-[#1E1B4B] text-[#FFFFFF]'
                                    : 'border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] hover:border-[#1E1B4B]'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="primary"
                      className="w-full"
                      disabled={
                        submittingGame ||
                        Object.keys(selectedAnswers).length <
                          activeSession.challenge.questions.length
                      }
                      onClick={() => void handleSubmitGame()}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {submittingGame
                        ? 'Verifying Answers…'
                        : 'Submit Answers & Claim Points'}
                    </Button>
                  </div>
                )}

              {/* GAME 2: FLAVOR MEMORY MATCH (memory-match) */}
              {activeSession.gameSlug === 'memory-match' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[13px] font-bold text-[#6B7280] tabular-nums">
                    <span>
                      Matched: {matchedIndices.length / 2} /{' '}
                      {activeSession.challenge.pairsRequired ?? 4}
                    </span>
                    <span>
                      Moves: {movesTaken} (Max{' '}
                      {activeSession.challenge.maxMovesAllowed ?? 14})
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    {memoryDeck.map((emoji, idx) => {
                      const isFaceUp =
                        flippedIndices.includes(idx) ||
                        matchedIndices.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleFlipMemoryCard(idx)}
                          className={`flex h-20 items-center justify-center rounded-2xl border text-[28px] transition-all active:scale-[0.96] cursor-pointer ${
                            isFaceUp
                              ? 'border-[#1E1B4B] bg-[#D2DB76]/35'
                              : 'border-[#1E1B4B] bg-[#1E1B4B] text-[#FFFFFF]'
                          }`}
                        >
                          {isFaceUp ? emoji : '🍽️'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GAME 3: PASS-THE-PHONE TABLE CHALLENGE (table-word-chain) */}
              {activeSession.gameSlug === 'table-word-chain' &&
                activeSession.challenge.rounds && (
                  <div className="space-y-4">
                    {(() => {
                      const rounds = activeSession.challenge.rounds;
                      const currentRound = rounds[currentRoundIndex];
                      if (!currentRound) return null;

                      return (
                        <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-[#1E1B4B] px-3 py-0.5 text-[11px] font-bold text-[#FFFFFF]">
                              Round {currentRoundIndex + 1} of {rounds.length}
                            </span>
                            <span className="text-[12px] font-semibold text-[#6B7280]">
                              Pass-the-Phone Challenge
                            </span>
                          </div>

                          <p className="text-[15px] font-extrabold text-[#111827]">
                            {currentRound.prompt}
                          </p>

                          <div className="grid gap-2.5">
                            {currentRound.options.map((opt, optIdx) => {
                              const selected =
                                selectedAnswers[currentRoundIndex] === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAnswers((prev) => ({
                                      ...prev,
                                      [currentRoundIndex]: optIdx,
                                    }))
                                  }
                                  className={`rounded-xl border px-4 py-3 text-left text-[14px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                                    selected
                                      ? 'border-[#1E1B4B] bg-[#1E1B4B] text-[#FFFFFF]'
                                      : 'border-[#1E1B4B]/15 bg-[#FFFFFF] text-[#111827] hover:border-[#1E1B4B]'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex justify-between pt-2">
                            {currentRoundIndex < rounds.length - 1 ? (
                              <Button
                                type="button"
                                variant="primary"
                                className="w-full"
                                disabled={
                                  selectedAnswers[currentRoundIndex] ===
                                  undefined
                                }
                                onClick={() =>
                                  setCurrentRoundIndex((i) => i + 1)
                                }
                              >
                                Lock In &amp; Pass Phone →
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="primary"
                                className="w-full"
                                disabled={
                                  submittingGame ||
                                  selectedAnswers[currentRoundIndex] ===
                                    undefined
                                }
                                onClick={() => void handleSubmitGame()}
                              >
                                {submittingGame
                                  ? 'Verifying Score…'
                                  : 'Finish Challenge & Claim Points'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
            </>
          )}
        </div>
      ) : (
        /* GAME LOBBY CARDS */
        <div className="grid gap-3.5">
          {gamesList.map((game) => {
            const meta = DEFAULT_GAME_CATALOG.find(
              (m) => m.gameSlug === game.gameSlug,
            );
            const isStarting = startingGameSlug === game.gameSlug;

            return (
              <div
                key={game.gameSlug}
                className="bistro-card p-5 flex items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F8F9FA] border border-[#1E1B4B]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#1E1B4B]">
                      {game.category === 'same_table' ? (
                        <>
                          <Users className="h-3 w-3" aria-hidden /> Table Group
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" aria-hidden /> Solo
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#D2DB76]/60 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B] tabular-nums">
                      <Sparkles className="h-3 w-3" aria-hidden />+{game.pointsPerWin} pts
                    </span>
                  </div>

                  <h3 className="text-[16px] font-extrabold text-[#111827]">
                    {game.title}
                  </h3>
                  <p className="text-[12px] text-[#6B7280] line-clamp-2">
                    {meta?.description}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isStarting}
                  onClick={() => void handleStartGame(game.gameSlug)}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#1E1B4B] px-5 text-[13px] font-extrabold text-[#FFFFFF] shadow-sm hover:bg-[#2E2A6E] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Gamepad2 className="h-4 w-4 text-[#D2DB76]" aria-hidden />
                  {isStarting ? 'Starting…' : 'Play'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
