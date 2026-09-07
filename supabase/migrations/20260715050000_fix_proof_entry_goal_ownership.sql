-- The original insert policy only checked that the submitter owned the
-- proof_entries row (user_id = auth.uid()) but never checked that goal_id
-- pointed at a goal *they* own. Any authenticated user could submit proof
-- against someone else's goal, inflating that goal's leaderboard standing
-- with entries the owner never made.

drop policy "users can insert own proof entries" on proof_entries;

create policy "users can insert own proof entries"
  on proof_entries for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from goals
      where goals.id = goal_id
        and goals.user_id = auth.uid()
    )
  );
