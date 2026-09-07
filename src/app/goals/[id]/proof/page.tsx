"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddProofPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [goalTitle, setGoalTitle] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("goals")
        .select("title")
        .eq("id", id)
        .single();

      if (error || !data) {
        setStatus("error");
        setErrorMessage("Goal not found.");
        return;
      }
      setGoalTitle(data.title);
      setStatus("idle");
    })();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

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

    const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("proof-photos")
      .upload(path, file);

    if (uploadError) {
      setStatus("error");
      setErrorMessage(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("proof-photos").getPublicUrl(path);

    const { error: insertError } = await supabase.from("proof_entries").insert({
      goal_id: id,
      user_id: user.id,
      occurred_at: occurredAt,
      photo_url: publicUrl,
      note: note || null,
    });

    if (insertError) {
      setStatus("error");
      setErrorMessage(insertError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold">Add proof</h1>
      {goalTitle && <p className="text-sm text-zinc-500">for {goalTitle}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Photo
          <input
            required
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            required
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {status === "saving" ? "Submitting…" : "Submit proof"}
        </button>
        {status === "error" && <p className="text-red-600">{errorMessage}</p>}
      </form>
    </main>
  );
}
