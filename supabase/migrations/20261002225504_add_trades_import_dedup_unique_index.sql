/*
# Enforce import de-duplication in the database

1. Problem
   The import flow checked for an existing trade with the same
   (import_source, import_ref) and then inserted in a separate statement.
   Two concurrent imports could both pass the check and insert the same
   trade twice. The client already handles unique-violation errors (23505),
   but no unique constraint existed for it to catch.

2. Changes
   - Adds a partial unique index `trades_import_dedup_uniq` on
     (user_id, import_source, import_ref) for rows where import_ref is not null.
   - Manually entered trades (import_ref IS NULL) are unaffected and can
     still be created freely.

3. Security / integrity notes
   1. No data is modified or removed; this only adds an index.
   2. Verified beforehand that no duplicate groups exist, so the index builds cleanly.
   3. The index is scoped per user, so one user's import refs cannot collide
      with another user's.
*/

CREATE UNIQUE INDEX IF NOT EXISTS trades_import_dedup_uniq
  ON public.trades (user_id, import_source, import_ref)
  WHERE import_ref IS NOT NULL;
