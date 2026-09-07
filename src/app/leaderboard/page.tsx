import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rankGoals } from "@/lib/leaderboard";
import { categoryLabel, type Goal, type ProofEntry } from "@/lib/goals";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: goals }, { data: proofEntries }, { data: profiles }] =
    await Promise.all([
      supabase.from("goals").select("*").returns<Goal[]>(),
      supabase.from("proof_entries").select("*").returns<ProofEntry[]>(),
      supabase.from("profiles").select("id, display_name"),
    ]);

  const displayName = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name as string]),
  );

  const proofByGoal = new Map<string, ProofEntry[]>();
  for (const entry of proofEntries ?? []) {
    const list = proofByGoal.get(entry.goal_id) ?? [];
    list.push(entry);
    proofByGoal.set(entry.goal_id, list);
  }

  const ranked = rankGoals(goals ?? [], proofByGoal);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leaderboard</h1>
        <Link href="/" className="text-sm underline">
          Back
        </Link>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-zinc-500">No goals posted yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ranked.map((stat, i) => (
            <li key={stat.goal.id} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  #{i + 1} {stat.goal.title}
                </span>
                <span>{Math.round(stat.completionRate * 100)}%</span>
              </div>
              <div className="text-zinc-500">
                {displayName.get(stat.goal.user_id) ?? "unknown"} ·{" "}
                {categoryLabel(stat.goal.category)}
                {stat.streak !== null && ` · streak ${stat.streak}`} ·{" "}
                {stat.proofCount} proof{stat.proofCount === 1 ? "" : "s"}
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
