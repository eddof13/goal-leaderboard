import type { Goal, ProofEntry } from "./goals";

export type GoalStats = {
  goal: Goal;
  proofCount: number;
  completionRate: number; // 0-1
  streak: number | null; // null for target goals, which don't have a cadence
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// How many cadence periods (days or weeks) have elapsed since the goal was
// posted, up to today or the deadline, whichever is sooner. Inclusive of the
// starting period, so a goal posted today has 1 period elapsed, not 0.
function periodsElapsed(goal: Goal, asOf: Date): number {
  const start = new Date(goal.created_at);
  const cutoff = new Date(Math.min(asOf.getTime(), new Date(goal.deadline).getTime()));
  const days = Math.max(0, daysBetween(start, cutoff));

  if (goal.cadence_period === "weekly") {
    return Math.floor(days / 7) + 1;
  }
  return days + 1;
}

export function completionRate(
  goal: Goal,
  proofEntries: ProofEntry[],
  asOf: Date = new Date(),
): number {
  const proofCount = proofEntries.length;

  if (goal.goal_type === "target") {
    if (!goal.target_count || goal.target_count <= 0) return 0;
    return Math.min(1, proofCount / goal.target_count);
  }

  const expected = periodsElapsed(goal, asOf) * (goal.cadence_count ?? 0);
  if (expected <= 0) return proofCount > 0 ? 1 : 0;
  return Math.min(1, proofCount / expected);
}

// Which period-bucket a date falls into, relative to the goal's start date —
// used to check for gaps when walking the streak backwards.
function periodIndex(goal: Goal, date: Date): number {
  const start = new Date(goal.created_at);
  const days = daysBetween(start, date);
  return goal.cadence_period === "weekly" ? Math.floor(days / 7) : days;
}

export function streak(
  goal: Goal,
  proofEntries: ProofEntry[],
  asOf: Date = new Date(),
): number | null {
  if (goal.goal_type !== "cadence" || !goal.cadence_period) return null;

  const totalPeriods = periodsElapsed(goal, asOf);
  const periodsWithProof = new Set(
    proofEntries.map((p) => periodIndex(goal, new Date(p.occurred_at))),
  );

  let count = 0;
  for (let i = totalPeriods - 1; i >= 0; i--) {
    if (!periodsWithProof.has(i)) break;
    count++;
  }
  return count;
}

export function rankGoals(
  goals: Goal[],
  proofEntriesByGoal: Map<string, ProofEntry[]>,
  asOf: Date = new Date(),
): GoalStats[] {
  const stats: GoalStats[] = goals.map((goal) => {
    const entries = proofEntriesByGoal.get(goal.id) ?? [];
    return {
      goal,
      proofCount: entries.length,
      completionRate: completionRate(goal, entries, asOf),
      streak: streak(goal, entries, asOf),
    };
  });

  return stats.sort((a, b) => {
    if (b.completionRate !== a.completionRate) {
      return b.completionRate - a.completionRate;
    }
    const streakDiff = (b.streak ?? -1) - (a.streak ?? -1);
    if (streakDiff !== 0) return streakDiff;
    return b.proofCount - a.proofCount;
  });
}
