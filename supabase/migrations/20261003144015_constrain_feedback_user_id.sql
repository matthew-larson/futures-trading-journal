/*
  # Constrain vestigial user_id column on feedback

  user_id is a text column that no policy constrained, so a caller could write
  an arbitrary user identifier into their own feedback row. The application
  never reads or writes it, so binding it to the session is behaviour-preserving.
*/

ALTER TABLE public.feedback ALTER COLUMN user_id SET DEFAULT (auth.uid())::text;

DROP POLICY IF EXISTS insert_own_feedback ON public.feedback;
CREATE POLICY insert_own_feedback ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND (user_id IS NULL OR user_id = (auth.uid())::text)
  );

DROP POLICY IF EXISTS update_own_feedback ON public.feedback;
CREATE POLICY update_own_feedback ON public.feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND (user_id IS NULL OR user_id = (auth.uid())::text)
  );
