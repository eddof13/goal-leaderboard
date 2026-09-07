export const CATEGORIES = [
  { value: "fitness", label: "Fitness" },
  { value: "reading", label: "Reading" },
  { value: "cold_exposure_approach", label: "Cold Exposure / Approach" },
  { value: "sobriety", label: "Sobriety" },
  { value: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

export const CADENCE_PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

export type CadencePeriod = (typeof CADENCE_PERIODS)[number]["value"];

export type GoalType = "cadence" | "target";

export type Goal = {
  id: string;
  user_id: string;
  category: Category;
  title: string;
  description: string | null;
  goal_type: GoalType;
  cadence_period: CadencePeriod | null;
  cadence_count: number | null;
  target_count: number | null;
  deadline: string;
  status: "active" | "completed" | "failed" | "abandoned";
  created_at: string;
};

export type ProofEntry = {
  id: string;
  goal_id: string;
  user_id: string;
  occurred_at: string;
  submitted_at: string;
  photo_url: string;
  note: string | null;
};

export function categoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function goalSummary(goal: Goal): string {
  if (goal.goal_type === "cadence") {
    const period = CADENCE_PERIODS.find((p) => p.value === goal.cadence_period)?.label;
    return `${goal.cadence_count}x ${period}`;
  }
  return `${goal.target_count} total by deadline`;
}
