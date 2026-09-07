import { describe, expect, test } from "vitest";
import { completionRate, streak, rankGoals } from "@/lib/leaderboard";
import type { Goal, ProofEntry } from "@/lib/goals";

function day(offset: number): string {
  return new Date(Date.UTC(2026, 0, 1 + offset)).toISOString();
}

function baseGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal-1",
    user_id: "user-1",
    category: "fitness",
    title: "Test goal",
    description: null,
    goal_type: "cadence",
    cadence_period: "daily",
    cadence_count: 1,
    target_count: null,
    deadline: day(365),
    status: "active",
    created_at: day(0),
    ...overrides,
  };
}

function proof(occurredAtOffset: number, goalId = "goal-1"): ProofEntry {
  return {
    id: `proof-${occurredAtOffset}-${Math.random()}`,
    goal_id: goalId,
    user_id: "user-1",
    occurred_at: day(occurredAtOffset).slice(0, 10),
    submitted_at: day(occurredAtOffset),
    photo_url: "https://example.com/x.png",
    note: null,
  };
}

describe("completionRate", () => {
  test("target goal: proof count over target, capped at 100%", () => {
    const goal = baseGoal({ goal_type: "target", target_count: 10, cadence_period: null, cadence_count: null });
    expect(completionRate(goal, [proof(0), proof(1)])).toBe(0.2);
    expect(completionRate(goal, Array.from({ length: 15 }, (_, i) => proof(i)))).toBe(1);
  });

  test("target goal with no target_count is 0%, not a divide-by-zero error", () => {
    const goal = baseGoal({ goal_type: "target", target_count: null, cadence_period: null, cadence_count: null });
    expect(completionRate(goal, [proof(0)])).toBe(0);
  });

  test("cadence goal: daily, 5 periods elapsed (day0-day4), 1x/day expected", () => {
    const goal = baseGoal({ cadence_period: "daily", cadence_count: 1 });
    const asOf = new Date(day(4));
    expect(completionRate(goal, [proof(0), proof(1), proof(2)], asOf)).toBe(0.6);
    expect(completionRate(goal, [proof(0), proof(1), proof(2), proof(3), proof(4)], asOf)).toBe(1);
  });

  test("cadence goal: weekly, expected scales with elapsed weeks", () => {
    const goal = baseGoal({ cadence_period: "weekly", cadence_count: 3 });
    // day7 = 1 full week elapsed + start day => 2 periods elapsed => expected 6
    const asOf = new Date(day(7));
    expect(completionRate(goal, [proof(0), proof(1), proof(2)], asOf)).toBe(0.5);
  });

  test("cadence goal exceeding expected caps at 100%, doesn't exceed", () => {
    const goal = baseGoal({ cadence_period: "daily", cadence_count: 1 });
    const asOf = new Date(day(0));
    expect(completionRate(goal, [proof(0), proof(0), proof(0)], asOf)).toBe(1);
  });

  test("cadence goal with 0 expected periods (cadence_count 0): any proof means 100%", () => {
    const goal = baseGoal({ cadence_period: "daily", cadence_count: 0 });
    const asOf = new Date(day(0));
    expect(completionRate(goal, [], asOf)).toBe(0);
    expect(completionRate(goal, [proof(0)], asOf)).toBe(1);
  });
});

describe("streak", () => {
  test("target goals have no streak concept", () => {
    const goal = baseGoal({ goal_type: "target", target_count: 5, cadence_period: null, cadence_count: null });
    expect(streak(goal, [proof(0)])).toBeNull();
  });

  test("all periods logged gives a full streak", () => {
    const goal = baseGoal({ cadence_period: "daily", cadence_count: 1 });
    const asOf = new Date(day(2));
    expect(streak(goal, [proof(0), proof(1), proof(2)], asOf)).toBe(3);
  });

  test("a gap breaks the streak, counting back from the most recent period", () => {
    const goal = baseGoal({ cadence_period: "daily", cadence_count: 1 });
    const asOf = new Date(day(2));
    // day0 has proof, day1 does not, day2 has proof -> only the trailing
    // period (day2) counts before hitting the day1 gap.
    expect(streak(goal, [proof(0), proof(2)], asOf)).toBe(1);
  });

  test("missing the most recent period gives a streak of 0", () => {
    const goal = baseGoal({ cadence_period: "daily", cadence_count: 1 });
    const asOf = new Date(day(2));
    expect(streak(goal, [proof(0), proof(1)], asOf)).toBe(0);
  });
});

describe("rankGoals", () => {
  test("sorts by completion rate desc, then streak desc (as a tiebreak for equal rates)", () => {
    // 3 periods elapsed (day0-day2), cadence_count 1 => expected 3.
    const asOf = new Date(day(2));
    const highRate = baseGoal({ id: "high-rate", cadence_period: "daily", cadence_count: 1 });
    const midHigherStreak = baseGoal({ id: "mid-higher-streak", cadence_period: "daily", cadence_count: 1 });
    const midLowerStreak = baseGoal({ id: "mid-lower-streak", cadence_period: "daily", cadence_count: 1 });
    const lowRate = baseGoal({ id: "low-rate", cadence_period: "daily", cadence_count: 1 });

    const entries = new Map<string, ProofEntry[]>([
      ["high-rate", [proof(0), proof(1), proof(2)]], // rate 1.0
      ["mid-higher-streak", [proof(2)]], // rate 0.33, streak 1 (most recent period logged)
      ["mid-lower-streak", [proof(0)]], // rate 0.33, streak 0 (most recent period missed)
      ["low-rate", []], // rate 0
    ]);

    const ranked = rankGoals(
      [lowRate, midLowerStreak, midHigherStreak, highRate],
      entries,
      asOf,
    );

    expect(ranked.map((r) => r.goal.id)).toEqual([
      "high-rate",
      "mid-higher-streak",
      "mid-lower-streak",
      "low-rate",
    ]);
  });
});
