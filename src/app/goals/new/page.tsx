"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CADENCE_PERIODS, type GoalType } from "@/lib/goals";

export default function NewGoalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [goalType, setGoalType] = useState<GoalType>("cadence");
  const [cadencePeriod, setCadencePeriod] = useState<string>(CADENCE_PERIODS[0].value);
  const [cadenceCount, setCadenceCount] = useState("3");
  const [targetCount, setTargetCount] = useState("10");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus("error");
      setErrorMessage("You must be signed in.");
      return;
    }

    const payload =
      goalType === "cadence"
        ? {
            cadence_period: cadencePeriod,
            cadence_count: Number(cadenceCount),
            target_count: null,
          }
        : {
            cadence_period: null,
            cadence_count: null,
            target_count: Number(targetCount),
          };

    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      category,
      title,
      description: description || null,
      goal_type: goalType,
      deadline,
      ...payload,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold">Post a goal</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Gym 3x/week"
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend>Goal type</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goalType"
              checked={goalType === "cadence"}
              onChange={() => setGoalType("cadence")}
            />
            Cadence — recurring (e.g. workout 3x/week)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="goalType"
              checked={goalType === "target"}
              onChange={() => setGoalType("target")}
            />
            Target — single count by deadline (e.g. read 12 books)
          </label>
        </fieldset>

        {goalType === "cadence" ? (
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Times per
              <input
                required
                type="number"
                min={1}
                value={cadenceCount}
                onChange={(e) => setCadenceCount(e.target.value)}
                className="rounded border px-3 py-2"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Period
              <select
                value={cadencePeriod}
                onChange={(e) => setCadencePeriod(e.target.value)}
                className="rounded border px-3 py-2"
              >
                {CADENCE_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            Target count
            <input
              required
              type="number"
              min={1}
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              className="rounded border px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Deadline
          <input
            required
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {status === "saving" ? "Posting…" : "Post goal"}
        </button>
        {status === "error" && <p className="text-red-600">{errorMessage}</p>}
      </form>
    </main>
  );
}
