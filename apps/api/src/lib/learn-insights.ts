// FHS-384 — Pure aggregation helpers for the parent Learn Insights endpoint.
//
// No auth / middleware here. The route (routes/learn-insights.ts) handles all
// auth guards, then calls `computeLearnInsights` with already-scoped
// (tenantId, memberId, displayName).
//
// Heuristics (where we lack per-attempt accuracy):
//   Maths      — needsHelp when progressPct < 25 AND any proveAvgTime > 10s
//                (slow on Prove means struggling). With zero activity, needsHelp=false.
//   Logic      — needsHelp when progressPct < 20 (few certs, few correct answers).
//   Science    — needsHelp when totalAnswered >= 5 AND accuracy < 0.60.
//   World Flags — needsHelp when explored < 10 (barely started, but keep it
//                 simple — no per-flag accuracy tracked).
//
// weakest = subject with the lowest progressPct that has *some* activity
// (certificatesEarned > 0 OR lastActive != null). If none have any activity,
// weakest = null.
//
// tip — one-line parent-friendly hint per subject.

import { and, count, eq, max, sql, sum } from 'drizzle-orm';
import {
  learnProgress,
  mwLogicCertificates,
  mwLogicProgress,
  mwMathsCertificates,
  mwMathsProgress,
  worldFlagsProgress,
} from '../db/schema.js';
import type { Database } from '../db/client.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** 4 operations × 12 tables = 48 possible Maths certificates. */
export const MATHS_CERTS_TOTAL = 48;

/** 5 game types × 3 difficulties = 15 possible Logic certificates. */
export const LOGIC_CERTS_TOTAL = 15;

/**
 * Total distinct country codes in the World Flags dataset (all ~197 UN-
 * recognized sovereign states tracked by the web app).
 */
export const WORLD_FLAGS_COUNTRIES_TOTAL = 197;

// ─── Response types ───────────────────────────────────────────────────────────

export interface SubjectInsight {
  subject: 'Maths' | 'Logic' | 'Science' | 'World Flags';
  /** 0–100 integer */
  progressPct: number;
  certificatesEarned: number;
  certificatesTotal: number;
  /** ISO 8601 string or null (no activity yet) */
  lastActive: string | null;
  needsHelp: boolean;
}

export interface WeakestDetail {
  subject: 'Maths' | 'Logic' | 'Science' | 'World Flags';
  /** e.g. "division tables", "sorting (easy)", "Animal Classification", "Africa" */
  detail: string;
  /** One-line friendly tip for parents */
  tip: string;
}

export interface LearnInsightsResult {
  memberId: string;
  displayName: string;
  subjects: SubjectInsight[];
  weakest: WeakestDetail | null;
  hasActivity: boolean;
}

// ─── Internal raw aggregates ──────────────────────────────────────────────────

interface MathsRaw {
  certsEarned: number;
  lastActive: Date | null;
  /** Average proveAvgTime across all rows where proveAvgTime > 0, or 0 */
  avgProveTime: number;
}

interface LogicRaw {
  certsEarned: number;
  lastActive: Date | null;
  /** { gameType: totalCorrectAcrossDifficulties } */
  correctByGame: Record<string, number>;
  /** The game_type with the fewest certs (or fewest correct if tied) */
  weakestGame: string | null;
}

interface ScienceRaw {
  progress: number;
  totalCorrect: number;
  totalAnswered: number;
  certificateAt: Date | null;
  lastActive: Date | null;
}

interface WorldFlagsRaw {
  explored: number;
  lastActive: Date | null;
}

// ─── Per-subject DB queries ───────────────────────────────────────────────────

async function fetchMaths(db: Database, tenantId: string, memberId: string): Promise<MathsRaw> {
  const [certsRow] = await db
    .select({ certsEarned: count() })
    .from(mwMathsCertificates)
    .where(
      and(eq(mwMathsCertificates.tenantId, tenantId), eq(mwMathsCertificates.memberId, memberId)),
    );

  const [progressRow] = await db
    .select({
      lastActive: max(mwMathsProgress.updatedAt),
      avgProveTime: sql<number>`coalesce(avg(nullif(${mwMathsProgress.proveAvgTime}, 0)), 0)`,
    })
    .from(mwMathsProgress)
    .where(and(eq(mwMathsProgress.tenantId, tenantId), eq(mwMathsProgress.memberId, memberId)));

  return {
    certsEarned: Number(certsRow?.certsEarned ?? 0),
    lastActive: progressRow?.lastActive ?? null,
    avgProveTime: Number(progressRow?.avgProveTime ?? 0),
  };
}

async function fetchLogic(db: Database, tenantId: string, memberId: string): Promise<LogicRaw> {
  const [certsRow] = await db
    .select({ certsEarned: count() })
    .from(mwLogicCertificates)
    .where(
      and(eq(mwLogicCertificates.tenantId, tenantId), eq(mwLogicCertificates.memberId, memberId)),
    );

  // Progress rows grouped by game_type — for weakest game detection.
  const progressRows = await db
    .select({
      gameType: mwLogicProgress.gameType,
      totalCorrect: sum(mwLogicProgress.correctCount),
      lastUpdated: max(mwLogicProgress.updatedAt),
    })
    .from(mwLogicProgress)
    .where(and(eq(mwLogicProgress.tenantId, tenantId), eq(mwLogicProgress.memberId, memberId)))
    .groupBy(mwLogicProgress.gameType);

  // Certs per game type.
  const certsPerGame = await db
    .select({ gameType: mwLogicCertificates.gameType, certCount: count() })
    .from(mwLogicCertificates)
    .where(
      and(eq(mwLogicCertificates.tenantId, tenantId), eq(mwLogicCertificates.memberId, memberId)),
    )
    .groupBy(mwLogicCertificates.gameType);

  const certsByGame: Record<string, number> = {};
  for (const r of certsPerGame) certsByGame[r.gameType] = Number(r.certCount);

  const correctByGame: Record<string, number> = {};
  let lastActive: Date | null = null;
  for (const r of progressRows) {
    correctByGame[r.gameType] = Number(r.totalCorrect ?? 0);
    if (r.lastUpdated && (!lastActive || r.lastUpdated > lastActive)) {
      lastActive = r.lastUpdated;
    }
  }

  // Weakest game = game with fewest certs; tie-break by fewest total correct answers.
  let weakestGame: string | null = null;
  if (progressRows.length > 0) {
    const allGames = progressRows.map((r) => r.gameType);
    allGames.sort((a, b) => {
      const certDiff = (certsByGame[a] ?? 0) - (certsByGame[b] ?? 0);
      if (certDiff !== 0) return certDiff;
      return (correctByGame[a] ?? 0) - (correctByGame[b] ?? 0);
    });
    weakestGame = allGames[0] ?? null;
  }

  return {
    certsEarned: Number(certsRow?.certsEarned ?? 0),
    lastActive,
    correctByGame,
    weakestGame,
  };
}

async function fetchScience(db: Database, tenantId: string, memberId: string): Promise<ScienceRaw> {
  const [row] = await db
    .select({
      progress: learnProgress.progress,
      totalCorrect: learnProgress.totalCorrect,
      totalAnswered: learnProgress.totalAnswered,
      certificateAt: learnProgress.certificateAt,
      lastActive: learnProgress.updatedAt,
    })
    .from(learnProgress)
    .where(
      and(
        eq(learnProgress.tenantId, tenantId),
        eq(learnProgress.memberId, memberId),
        eq(learnProgress.subject, 'Science'),
      ),
    )
    .limit(1);

  return {
    progress: row?.progress ?? 0,
    totalCorrect: row?.totalCorrect ?? 0,
    totalAnswered: row?.totalAnswered ?? 0,
    certificateAt: row?.certificateAt ?? null,
    lastActive: row?.lastActive ?? null,
  };
}

async function fetchWorldFlags(
  db: Database,
  tenantId: string,
  memberId: string,
): Promise<WorldFlagsRaw> {
  const [row] = await db
    .select({
      explored: count(),
      lastActive: max(worldFlagsProgress.exploredAt),
    })
    .from(worldFlagsProgress)
    .where(
      and(eq(worldFlagsProgress.tenantId, tenantId), eq(worldFlagsProgress.memberId, memberId)),
    );

  return {
    explored: Number(row?.explored ?? 0),
    lastActive: row?.lastActive ?? null,
  };
}

// ─── Heuristic helpers ────────────────────────────────────────────────────────

function mathsNeedsHelp(certsEarned: number, avgProveTime: number): boolean {
  // No activity → not "needs help" (don't flag a kid who hasn't started).
  if (certsEarned === 0) return false;
  const progressPct = Math.round((certsEarned / MATHS_CERTS_TOTAL) * 100);
  // Low progress AND slow on Prove = struggling.
  return progressPct < 25 && avgProveTime > 10;
}

function logicNeedsHelp(certsEarned: number): boolean {
  if (certsEarned === 0) return false;
  return Math.round((certsEarned / LOGIC_CERTS_TOTAL) * 100) < 20;
}

function scienceNeedsHelp(totalAnswered: number, totalCorrect: number): boolean {
  if (totalAnswered < 5) return false;
  return totalCorrect / totalAnswered < 0.6;
}

function worldFlagsNeedsHelp(explored: number): boolean {
  // Started exploring but < 10 countries — nudge parent.
  return explored > 0 && explored < 10;
}

// ─── Tip map ─────────────────────────────────────────────────────────────────

const TIPS: Record<string, string> = {
  Maths: 'Try the Prove stage daily to build speed — even one table a day helps.',
  Logic: 'Play logic games together; talk through the "why" behind each answer.',
  Science: 'Re-read the Learn cards before answering questions to boost accuracy.',
  'World Flags': 'Explore a new continent together and quiz each other on the flags.',
};

function gameTypeLabel(gameType: string): string {
  const labels: Record<string, string> = {
    truefalse: 'true or false',
    patterns: 'patterns',
    oddoneout: 'odd one out',
    ifthen: 'if-then',
    sorting: 'sorting',
  };
  return labels[gameType] ?? gameType;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches member's display name, aggregates Learn data from four subjects,
 * and returns the full insights payload.
 *
 * Scoped exclusively to (tenantId, memberId) — callers must have already
 * verified that the target member belongs to the caller's tenant.
 */
export async function computeLearnInsights(
  db: Database,
  tenantId: string,
  memberId: string,
): Promise<Omit<LearnInsightsResult, 'displayName'>> {
  // Run all four subject queries concurrently.
  const [maths, logic, science, flags] = await Promise.all([
    fetchMaths(db, tenantId, memberId),
    fetchLogic(db, tenantId, memberId),
    fetchScience(db, tenantId, memberId),
    fetchWorldFlags(db, tenantId, memberId),
  ]);

  // ── Maths subject ────────────────────────────────────────────────────────
  const mathsPct = Math.min(100, Math.round((maths.certsEarned / MATHS_CERTS_TOTAL) * 100));
  const mathsSubject: SubjectInsight = {
    subject: 'Maths',
    progressPct: mathsPct,
    certificatesEarned: maths.certsEarned,
    certificatesTotal: MATHS_CERTS_TOTAL,
    lastActive: maths.lastActive?.toISOString() ?? null,
    needsHelp: mathsNeedsHelp(maths.certsEarned, maths.avgProveTime),
  };

  // ── Logic subject ────────────────────────────────────────────────────────
  const logicPct = Math.min(100, Math.round((logic.certsEarned / LOGIC_CERTS_TOTAL) * 100));
  const logicSubject: SubjectInsight = {
    subject: 'Logic',
    progressPct: logicPct,
    certificatesEarned: logic.certsEarned,
    certificatesTotal: LOGIC_CERTS_TOTAL,
    lastActive: logic.lastActive?.toISOString() ?? null,
    needsHelp: logicNeedsHelp(logic.certsEarned),
  };

  // ── Science subject ──────────────────────────────────────────────────────
  // progressPct = learn_progress.progress column (0–100 integer), which the
  // Learn flow sets. certificatesEarned = 1 if certificate_at is set, else 0.
  const scienceCerts = science.certificateAt ? 1 : 0;
  const scienceSubject: SubjectInsight = {
    subject: 'Science',
    progressPct: science.progress,
    certificatesEarned: scienceCerts,
    certificatesTotal: 1,
    lastActive: science.lastActive?.toISOString() ?? null,
    needsHelp: scienceNeedsHelp(science.totalAnswered, science.totalCorrect),
  };

  // ── World Flags subject ──────────────────────────────────────────────────
  const flagsPct = Math.min(100, Math.round((flags.explored / WORLD_FLAGS_COUNTRIES_TOTAL) * 100));
  // No cert table for World Flags — we treat explored count as progress signal;
  // certificates = 0 / total = 0 (not applicable for this subject).
  const flagsSubject: SubjectInsight = {
    subject: 'World Flags',
    progressPct: flagsPct,
    certificatesEarned: flags.explored,
    certificatesTotal: WORLD_FLAGS_COUNTRIES_TOTAL,
    lastActive: flags.lastActive?.toISOString() ?? null,
    needsHelp: worldFlagsNeedsHelp(flags.explored),
  };

  const subjects: SubjectInsight[] = [mathsSubject, logicSubject, scienceSubject, flagsSubject];

  // ── hasActivity ──────────────────────────────────────────────────────────
  const hasActivity = subjects.some((s) => s.lastActive !== null || s.certificatesEarned > 0);

  // ── weakest ──────────────────────────────────────────────────────────────
  // Only consider subjects that have some activity (lastActive or certs).
  const active = subjects.filter((s) => s.lastActive !== null || s.certificatesEarned > 0);
  let weakest: WeakestDetail | null = null;

  if (active.length > 0) {
    const lowest = active.reduce((a, b) => (a.progressPct <= b.progressPct ? a : b));

    let detail: string;
    if (lowest.subject === 'Logic' && logic.weakestGame) {
      detail = `${gameTypeLabel(logic.weakestGame)} (needs most practice)`;
    } else if (lowest.subject === 'Maths') {
      detail = 'low certificate count — keep practising tables';
    } else if (lowest.subject === 'Science') {
      const acc =
        science.totalAnswered > 0
          ? Math.round((science.totalCorrect / science.totalAnswered) * 100)
          : 0;
      detail = `${acc}% accuracy in Science questions`;
    } else {
      // World Flags
      detail = `explored ${flags.explored} of ${WORLD_FLAGS_COUNTRIES_TOTAL} countries`;
    }

    weakest = {
      subject: lowest.subject,
      detail,
      tip: TIPS[lowest.subject] ?? 'Keep practising together!',
    };
  }

  return { memberId, subjects, weakest, hasActivity };
}
