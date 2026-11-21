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

  // Auto-resume stored diner session on mount
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
      } catch {
        // ignore auto-resume error
      }
    }
    void resume();
  }, [businessSlug]);

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
      // Automatically create an instant guest check-in if they haven't checked in yet
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
        // Deterministic shuffle using current timestamp
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

      // Refresh customer wallet state so ledger and balance update immediately
      const stored = loadStoredDinerIdentity();
      const refreshed =
        await businessRepository.registerOrResumeRestaurantCustomer({
          displayName: wallet.customer.displayName,
          phoneOrEmail: wallet.customer.phoneOrEmail,
          guestTokenHash: stored?.guestTokenHash ?? null,
          businessSlug,
        });
      setWallet(refreshed);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmittingGame(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Game Points Wallet & Customer Check-In Bar */}
      <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to Digital Menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] text-[#252B29] hover:border-[#244B40] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[19px] font-bold text-[#252B29] flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5 text-[#244B40]" aria-hidden />
                  Table Game Arena
                </h2>
                {tableNumber && (
                  <span className="rounded-full bg-[#244B40] px-2.5 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                    {tableNumber}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#626B65]">
                Play restaurant-approved games &amp; earn verified Game Points at {businessName}.
              </p>
            </div>
          </div>

          {/* Distinct Game Points Wallet Badge */}
          <div
            data-testid="game-points-wallet-badge"
            className="flex items-center gap-2.5 rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC] px-3.5 py-2"
          >
            <Trophy className="h-4 w-4 text-[#244B40]" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#626B65]">
                Game Points Wallet
              </p>
              <p className="text-[16px] font-bold text-[#244B40] leading-tight">
                {wallet?.gamePointsBalance ?? 0} pts
              </p>
            </div>
          </div>
        </div>

        {/* Customer Identity Bar / 1-Step Check-In */}
        {!wallet || showCheckInForm ? (
          <form
            onSubmit={(e) => void handleCheckIn(e, false)}
            className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#252B29] flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-[#244B40]" aria-hidden />
                Save Your Game Points &amp; Stars Across Visits
              </p>
              {wallet && (
                <button
                  type="button"
                  onClick={() => setShowCheckInForm(false)}
                  className="text-[12px] font-medium text-[#626B65] hover:text-[#252B29] cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Your Name (e.g. Aarav)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[13px] text-[#252B29]"
              />
              <input
                type="text"
                maxLength={160}
                placeholder="Phone or Email (Optional — saves across visits)"
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[13px] text-[#252B29]"
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
                  Continue as Instant Guest
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/80 px-3.5 py-2.5 text-[12px]">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#244B40]" aria-hidden />
              <span className="font-semibold text-[#252B29]">
                Playing as {wallet.customer.displayName}
              </span>
              {wallet.customer.phoneOrEmail ? (
                <span className="rounded-full bg-[#EEF3EC] px-2 py-0.5 text-[11px] font-medium text-[#244B40]">
                  Saved ({wallet.customer.phoneOrEmail})
                </span>
              ) : (
                <span className="rounded-full bg-[#FAF3DF] border border-[#E4BD63] px-2 py-0.5 text-[11px] font-medium text-[#252B29]">
                  Guest Session
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCheckInForm(true)}
                className="font-semibold text-[#244B40] hover:underline cursor-pointer"
              >
                {wallet.customer.phoneOrEmail
                  ? 'Edit Profile'
                  : 'Link Phone/Email'}
              </button>
              <button
                type="button"
                onClick={() => setShowLedger((prev) => !prev)}
                className="inline-flex items-center gap-1 font-semibold text-[#252B29] hover:text-[#244B40] cursor-pointer"
              >
                <History className="h-3.5 w-3.5" aria-hidden />
                {showLedger ? 'Hide History' : 'Points History'}
              </button>
            </div>
          </div>
        )}

        {/* Expandable Game-Points Ledger History */}
        {showLedger && wallet && (
          <div className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-3.5 space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
              Verified Game Points Ledger (Separate from Loyalty Stars)
            </p>
            {wallet.recentTransactions.length === 0 ? (
              <p className="text-[12px] text-[#626B65]">
                No game point transactions yet. Win a game below to earn your first points!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {wallet.recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl bg-[#FFFFFF] border border-[#DDE4DC] px-3 py-2 text-[12px]"
                  >
                    <div>
                      <span className="font-semibold text-[#252B29]">
                        {tx.txType === 'game_win'
                          ? `Game Win (${String(tx.metadata?.gameSlug ?? 'Table Game')})`
                          : tx.txType}
                      </span>
                      <p className="text-[11px] text-[#626B65]">
                        Balance after: {tx.balanceAfter} pts
                      </p>
                    </div>
                    <span
                      className={`font-bold ${
                        tx.pointsDelta >= 0 ? 'text-[#244B40]' : 'text-red-700'
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
            className="flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ACTIVE GAME PLAY VIEW vs. GAME SELECTION LOBBY */}
      {activeSession ? (
        <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#DDE4DC] pb-3.5">
            <div>
              <span className="rounded-full bg-[#EEF3EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#244B40]">
                Win +{activeSession.pointsPerWin} Game Points
              </span>
              <h3 className="mt-1 text-[20px] font-bold text-[#252B29]">
                {activeSession.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setCompletionResult(null);
              }}
              className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] px-3 py-1.5 text-[12px] font-semibold text-[#252B29] hover:border-[#244B40] cursor-pointer"
            >
              All Games
            </button>
          </div>

          {/* GAME COMPLETION BANNER */}
          {completionResult ? (
            <div className="rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC]/70 p-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#244B40] text-[#FFFFFF]">
                {completionResult.passed ? (
                  <Trophy className="h-6 w-6" aria-hidden />
                ) : (
                  <RotateCcw className="h-6 w-6" aria-hidden />
                )}
              </div>
              <h4 className="text-[20px] font-bold text-[#252B29]">
                {completionResult.passed
                  ? `You Won +${completionResult.pointsAwarded} Game Points!`
                  : 'Good Try! Almost There'}
              </h4>
              <p className="text-[13px] text-[#626B65]">
                {completionResult.passed
                  ? `Verified score: ${completionResult.score} · Your updated Game Points balance is ${completionResult.newBalance} pts.`
                  : `Score: ${completionResult.score}. Try another table game to earn points!`}
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
                        className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4 space-y-2.5"
                      >
                        <p className="text-[14px] font-bold text-[#252B29]">
                          {q.index + 1}. {q.prompt}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
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
                                className={`rounded-xl border px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors cursor-pointer ${
                                  selected
                                    ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF] font-semibold'
                                    : 'border-[#DDE4DC] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40]'
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
                  <div className="flex items-center justify-between text-[13px] font-medium text-[#626B65]">
                    <span>
                      Matched Pairs: {matchedIndices.length / 2} /{' '}
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
                          className={`flex h-20 items-center justify-center rounded-2xl border text-[28px] transition-all cursor-pointer ${
                            isFaceUp
                              ? 'border-[#244B40] bg-[#EEF3EC]'
                              : 'border-[#DDE4DC] bg-[#244B40] text-[#FFFFFF]'
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
                        <div className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/70 p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-[#244B40] px-3 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                              Round {currentRoundIndex + 1} of {rounds.length}
                            </span>
                            <span className="text-[12px] font-medium text-[#626B65]">
                              Same-Table Group Challenge
                            </span>
                          </div>

                          <p className="text-[16px] font-bold text-[#252B29]">
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
                                  className={`rounded-xl border px-4 py-3 text-left text-[14px] font-medium transition-colors cursor-pointer ${
                                    selected
                                      ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF] font-semibold'
                                      : 'border-[#DDE4DC] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40]'
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
                                Lock In &amp; Pass Phone to Next Player →
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
                                  ? 'Verifying Table Score…'
                                  : 'Finish Table Challenge & Claim Points'}
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
                className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF3EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#244B40]">
                      {game.category === 'same_table' ? (
                        <>
                          <Users className="h-3 w-3" aria-hidden /> Same-Table Group
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" aria-hidden /> Solo Game
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-2.5 py-0.5 text-[11px] font-bold text-[#252B29]">
                      <Sparkles className="h-3 w-3 text-[#244B40]" aria-hidden />
                      +{game.pointsPerWin} pts per win
                    </span>
                  </div>

                  <h3 className="text-[17px] font-bold text-[#252B29]">
                    {game.title}
                  </h3>
                  <p className="text-[13px] text-[#626B65]">
                    {meta?.description}
                  </p>
                  <p className="text-[11px] text-[#626B65]">
                    Daily limit: {game.maxPointsPerDayPerCustomer} pts/day · Cooldown: {game.cooldownMinutes}m
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  disabled={isStarting}
                  onClick={() => void handleStartGame(game.gameSlug)}
                >
                  <Gamepad2 className="h-4 w-4" aria-hidden />
                  {isStarting ? 'Starting…' : 'Play Now'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
