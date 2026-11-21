import { useEffect, useState } from 'react';
import {
  Gamepad2,
  Trophy,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Users,
  User,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  RestaurantGameConfig,
  RestaurantGameParticipationStats,
  RestaurantTriviaQuestion,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  DEFAULT_DISH_TRIVIA_QUESTIONS,
  DEFAULT_GAME_CATALOG,
} from '../../utils/restaurantValidation';
import { Button } from '../common/Button';

interface Props {
  business: Business;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

export function RestaurantGamesConfigPanel({
  business,
  onStatus,
  onError,
}: Props) {
  const [configs, setConfigs] = useState<RestaurantGameConfig[]>([]);
  const [stats, setStats] = useState<RestaurantGameParticipationStats>({
    totalSessionsPlayed: 0,
    sessionsCompletedToday: 0,
    gamePointsIssuedToday: 0,
    totalGamePointsIssued: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  // New custom trivia question form state
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newOptionC, setNewOptionC] = useState('');
  const [newOptionD, setNewOptionD] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);

  useEffect(() => {
    async function loadGamesAndStats() {
      setLoading(true);
      try {
        const [loadedConfigs, loadedStats] = await Promise.all([
          businessRepository.getRestaurantGameConfigs(business.id),
          businessRepository.getRestaurantGameStats(business.id),
        ]);
        setConfigs(loadedConfigs);
        setStats(loadedStats);
      } catch (err) {
        onError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void loadGamesAndStats();
  }, [business.id, onError]);

  function updateLocalConfig(
    gameSlug: string,
    patch: Partial<RestaurantGameConfig>,
  ) {
    setConfigs((prev) =>
      prev.map((c) => (c.gameSlug === gameSlug ? { ...c, ...patch } : c)),
    );
  }

  async function handleSaveGameConfig(cfg: RestaurantGameConfig) {
    setSavingSlug(cfg.gameSlug);
    try {
      const saved = await businessRepository.updateRestaurantGameConfig(
        business.id,
        {
          gameSlug: cfg.gameSlug,
          title: cfg.title,
          category: cfg.category,
          isEnabled: cfg.isEnabled,
          pointsPerWin: cfg.pointsPerWin,
          maxPointsPerDayPerCustomer: cfg.maxPointsPerDayPerCustomer,
          cooldownMinutes: cfg.cooldownMinutes,
          customQuestions: cfg.customQuestions,
        },
      );
      setConfigs((prev) =>
        prev.map((c) => (c.gameSlug === saved.gameSlug ? saved : c)),
      );
      onStatus(`Saved settings for "${saved.title}".`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleAddCustomTriviaQuestion(e: React.FormEvent) {
    e.preventDefault();
    const triviaCfg = configs.find((c) => c.gameSlug === 'dish-trivia');
    if (!triviaCfg) return;

    const options = [newOptionA, newOptionB, newOptionC, newOptionD]
      .map((o) => o.trim())
      .filter(Boolean);

    if (options.length < 2) {
      onError('Please provide at least 2 answer options for the trivia question.');
      return;
    }

    const safeCorrectIdx =
      newCorrectIndex >= 0 && newCorrectIndex < options.length
        ? newCorrectIndex
        : 0;

    const nextQuestions: RestaurantTriviaQuestion[] = [
      ...(triviaCfg.customQuestions ?? [...DEFAULT_DISH_TRIVIA_QUESTIONS]),
      {
        prompt: newQuestionPrompt.trim(),
        options,
        correctIndex: safeCorrectIdx,
      },
    ];

    try {
      const saved = await businessRepository.updateRestaurantGameConfig(
        business.id,
        {
          gameSlug: triviaCfg.gameSlug,
          title: triviaCfg.title,
          category: triviaCfg.category,
          isEnabled: triviaCfg.isEnabled,
          pointsPerWin: triviaCfg.pointsPerWin,
          maxPointsPerDayPerCustomer: triviaCfg.maxPointsPerDayPerCustomer,
          cooldownMinutes: triviaCfg.cooldownMinutes,
          customQuestions: nextQuestions,
        },
      );
      setConfigs((prev) =>
        prev.map((c) => (c.gameSlug === saved.gameSlug ? saved : c)),
      );
      setNewQuestionPrompt('');
      setNewOptionA('');
      setNewOptionB('');
      setNewOptionC('');
      setNewOptionD('');
      setNewCorrectIndex(0);
      onStatus('Added custom restaurant trivia question.');
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function handleRemoveTriviaQuestion(idxToRemove: number) {
    const triviaCfg = configs.find((c) => c.gameSlug === 'dish-trivia');
    if (!triviaCfg) return;

    const currentList =
      triviaCfg.customQuestions ?? [...DEFAULT_DISH_TRIVIA_QUESTIONS];
    const nextQuestions = currentList.filter((_, idx) => idx !== idxToRemove);

    try {
      const saved = await businessRepository.updateRestaurantGameConfig(
        business.id,
        {
          gameSlug: triviaCfg.gameSlug,
          title: triviaCfg.title,
          category: triviaCfg.category,
          isEnabled: triviaCfg.isEnabled,
          pointsPerWin: triviaCfg.pointsPerWin,
          maxPointsPerDayPerCustomer: triviaCfg.maxPointsPerDayPerCustomer,
          cooldownMinutes: triviaCfg.cooldownMinutes,
          customQuestions: nextQuestions.length > 0 ? nextQuestions : null,
        },
      );
      setConfigs((prev) =>
        prev.map((c) => (c.gameSlug === saved.gameSlug ? saved : c)),
      );
      onStatus('Removed trivia question.');
    } catch (err) {
      onError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center">
        <p className="text-[14px] text-[#626B65]">Loading game controls…</p>
      </div>
    );
  }

  const triviaConfig = configs.find((c) => c.gameSlug === 'dish-trivia');
  const activeTriviaQuestions =
    triviaConfig?.customQuestions && triviaConfig.customQuestions.length > 0
      ? triviaConfig.customQuestions
      : DEFAULT_DISH_TRIVIA_QUESTIONS;

  return (
    <div className="space-y-6">
      {/* Participation Metrics Bar */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 shadow-2xs">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
            Sessions Played Today
          </p>
          <p className="mt-1 text-[24px] font-bold text-[#252B29]">
            {stats.sessionsCompletedToday}
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 shadow-2xs">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
            Total Sessions Played
          </p>
          <p className="mt-1 text-[24px] font-bold text-[#252B29]">
            {stats.totalSessionsPlayed}
          </p>
        </div>

        <div className="rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC]/60 p-4 shadow-2xs">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#244B40]">
            Game Points Issued Today
          </p>
          <p className="mt-1 text-[24px] font-bold text-[#244B40]">
            {stats.gamePointsIssuedToday} pts
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 shadow-2xs">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
            All-Time Game Points
          </p>
          <p className="mt-1 text-[24px] font-bold text-[#252B29]">
            {stats.totalGamePointsIssued} pts
          </p>
        </div>
      </div>

      {/* Individual Game Rule Cards */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-5">
        <div>
          <h3 className="text-[18px] font-semibold text-[#252B29] flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-[#244B40]" aria-hidden />
            Restaurant-Controlled Games &amp; Point Rules
          </h3>
          <p className="text-[13px] text-[#626B65] mt-0.5">
            Configure which games appear on your digital menu, how many Game Points a diner earns per win, daily customer caps, and replay cooldowns. Game Points are stored in an anti-cheat ledger separate from Loyalty Stars.
          </p>
        </div>

        <div className="grid gap-4">
          {configs.map((cfg) => {
            const meta = DEFAULT_GAME_CATALOG.find(
              (m) => m.gameSlug === cfg.gameSlug,
            );
            const isSaving = savingSlug === cfg.gameSlug;

            return (
              <div
                key={cfg.gameSlug}
                className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/50 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[16px] font-bold text-[#252B29]">
                        {cfg.title}
                      </h4>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE4DC] bg-[#FFFFFF] px-2.5 py-0.5 text-[11px] font-semibold text-[#244B40]">
                        {cfg.category === 'same_table' ? (
                          <>
                            <Users className="h-3 w-3" aria-hidden /> Same-Table Group Game
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3" aria-hidden /> Solo Table Game
                          </>
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          cfg.isEnabled
                            ? 'bg-[#EEF3EC] text-[#244B40]'
                            : 'bg-[#E8EBE7] text-[#626B65]'
                        }`}
                      >
                        {cfg.isEnabled ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" aria-hidden /> Enabled
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" aria-hidden /> Disabled
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#626B65]">
                      {meta?.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...cfg, isEnabled: !cfg.isEnabled };
                      updateLocalConfig(cfg.gameSlug, {
                        isEnabled: next.isEnabled,
                      });
                      void handleSaveGameConfig(next);
                    }}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold cursor-pointer ${
                      cfg.isEnabled
                        ? 'bg-[#244B40] text-[#FFFFFF]'
                        : 'border border-[#87928A] bg-[#FFFFFF] text-[#252B29]'
                    }`}
                  >
                    {cfg.isEnabled ? 'Turn Off Game' : 'Turn On Game'}
                  </button>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#252B29]">
                      Points Awarded Per Win
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={cfg.pointsPerWin}
                      onChange={(e) =>
                        updateLocalConfig(cfg.gameSlug, {
                          pointsPerWin: Math.max(
                            0,
                            Number.parseInt(e.target.value || '0', 10),
                          ),
                        })
                      }
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[14px] text-[#252B29]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#252B29]">
                      Daily Cap Per Customer (pts)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={cfg.maxPointsPerDayPerCustomer}
                      onChange={(e) =>
                        updateLocalConfig(cfg.gameSlug, {
                          maxPointsPerDayPerCustomer: Math.max(
                            0,
                            Number.parseInt(e.target.value || '0', 10),
                          ),
                        })
                      }
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[14px] text-[#252B29]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-[#252B29]">
                      Replay Cooldown (minutes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={cfg.cooldownMinutes}
                      onChange={(e) =>
                        updateLocalConfig(cfg.gameSlug, {
                          cooldownMinutes: Math.max(
                            0,
                            Number.parseInt(e.target.value || '0', 10),
                          ),
                        })
                      }
                      className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[14px] text-[#252B29]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isSaving}
                    onClick={() => void handleSaveGameConfig(cfg)}
                  >
                    <Trophy className="h-3.5 w-3.5" aria-hidden />
                    {isSaving ? 'Saving…' : 'Save Point Rules'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Restaurant Trivia Builder */}
      {triviaConfig && (
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-5">
          <div>
            <h3 className="text-[17px] font-semibold text-[#252B29] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#244B40]" aria-hidden />
              Custom Restaurant Trivia Questions (&ldquo;Chef&apos;s Table Trivia&rdquo;)
            </h3>
            <p className="text-[13px] text-[#626B65] mt-0.5">
              Customize questions about your signature dishes, chef&apos;s spices, or restaurant story. Correct answers are verified strictly on the server so guests cannot inspect them from their browser.
            </p>
          </div>

          <form
            onSubmit={(e) => void handleAddCustomTriviaQuestion(e)}
            className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4 space-y-3.5"
          >
            <div className="space-y-1">
              <label
                htmlFor="triviaPromptInput"
                className="block text-[13px] font-semibold text-[#252B29]"
              >
                Question Prompt
              </label>
              <input
                id="triviaPromptInput"
                type="text"
                required
                minLength={5}
                maxLength={220}
                placeholder="e.g. What is our chef's secret spice in our signature Dum Biryani?"
                value={newQuestionPrompt}
                onChange={(e) => setNewQuestionPrompt(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] text-[#252B29]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Option 1 (e.g. Kashmiri Saffron)"
                value={newOptionA}
                onChange={(e) => setNewOptionA(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
              />
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Option 2 (e.g. Black Pepper)"
                value={newOptionB}
                onChange={(e) => setNewOptionB(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
              />
              <input
                type="text"
                maxLength={80}
                placeholder="Option 3 (Optional)"
                value={newOptionC}
                onChange={(e) => setNewOptionC(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
              />
              <input
                type="text"
                maxLength={80}
                placeholder="Option 4 (Optional)"
                value={newOptionD}
                onChange={(e) => setNewOptionD(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="triviaCorrectIdxSelect"
                  className="text-[13px] font-medium text-[#252B29]"
                >
                  Correct Option:
                </label>
                <select
                  id="triviaCorrectIdxSelect"
                  value={newCorrectIndex}
                  onChange={(e) =>
                    setNewCorrectIndex(Number.parseInt(e.target.value, 10))
                  }
                  className="rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] text-[#252B29]"
                >
                  <option value={0}>Option 1</option>
                  <option value={1}>Option 2</option>
                  <option value={2}>Option 3</option>
                  <option value={3}>Option 4</option>
                </select>
              </div>

              <Button type="submit" variant="primary">
                <Plus className="h-4 w-4" aria-hidden /> Add Trivia Question
              </Button>
            </div>
          </form>

          <div className="space-y-2.5">
            {activeTriviaQuestions.map((q, idx) => (
              <div
                key={`${q.prompt}-${idx}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-3.5"
              >
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-[#252B29]">
                    Q{idx + 1}. {q.prompt}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt, optIdx) => (
                      <span
                        key={`${opt}-${optIdx}`}
                        className={`rounded-lg px-2.5 py-0.5 text-[12px] font-medium ${
                          optIdx === q.correctIndex
                            ? 'bg-[#EEF3EC] text-[#244B40] font-semibold border border-[#A8BFA5]'
                            : 'bg-[#F7F7F2] text-[#626B65]'
                        }`}
                      >
                        {opt} {optIdx === q.correctIndex ? '✓' : ''}
                      </span>
                    ))}
                  </div>
                </div>

                {activeTriviaQuestions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveTriviaQuestion(idx)}
                    aria-label={`Remove question ${idx + 1}`}
                    className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
