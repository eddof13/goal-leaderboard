import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel, goalSummary, type Goal, type ProofEntry } from "@/lib/goals";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Goal[]>();

  const goalIds = goals?.map((g) => g.id) ?? [];
  const { data: proofEntries } =
    goalIds.length > 0
      ? await supabase
          .from("proof_entries")
          .select("*")
          .in("goal_id", goalIds)
          .returns<ProofEntry[]>()
      : { data: [] as ProofEntry[] };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold">Goal Leaderboard</h1>
      <p>Signed in as {user.email}.</p>

      <div className="flex gap-2">
        <Link
          href="/goals/new"
          className="flex-1 rounded bg-black px-3 py-2 text-center text-white"
        >
          Post a goal
        </Link>
        <Link
          href="/leaderboard"
          className="flex-1 rounded border px-3 py-2 text-center"
        >
          Leaderboard
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Your goals</h2>
        {!goals || goals.length === 0 ? (
          <p className="text-sm text-zinc-500">No goals posted yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.map((goal) => {
              const proofCount = (proofEntries ?? []).filter(
                (p) => p.goal_id === goal.id,
              ).length;
              return (
                <li key={goal.id} className="rounded border p-3 text-sm">
                  <div className="font-medium">{goal.title}</div>
                  <div className="text-zinc-500">
                    {categoryLabel(goal.category)} · {goalSummary(goal)} · due{" "}
                    {goal.deadline}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-zinc-500">
                      {proofCount} proof {proofCount === 1 ? "entry" : "entries"}
                    </span>
                    <Link href={`/goals/${goal.id}/proof`} className="underline">
                      Add proof
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded border px-3 py-2 text-sm">
          Sign out
        </button>
      </form>
    </main>
  );
}
