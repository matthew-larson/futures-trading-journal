/*
  # Validate the discovered_patterns bounds

  All 53 existing rows were confirmed to satisfy the new checks, so the
  constraints are promoted from NOT VALID to fully validated.
*/

ALTER TABLE public.discovered_patterns
  VALIDATE CONSTRAINT discovered_patterns_text_bounds;

ALTER TABLE public.discovered_patterns
  VALIDATE CONSTRAINT discovered_patterns_supporting_ids_bounds;
