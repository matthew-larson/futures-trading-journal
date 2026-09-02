/*
  # Bound free-text columns written directly by the client

  1. Changes
     - `feedback.message` limited to 5000 characters, `feedback.page` to 100.
     - `coach_conversations.question` limited to 4000 characters and
       `coach_conversations.answer` to 50000.

  2. Security
     - These rows are inserted straight from the browser through the data API,
       so the only ceiling on their size was the UI. A signed-in caller could
       insert arbitrarily large strings repeatedly and inflate storage.
     - Limits are generously above legitimate use, matching the bounds already
       enforced on trades and trading rules.
     - NULL values remain allowed so existing behaviour is unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_message_len'
  ) THEN
    ALTER TABLE feedback
      ADD CONSTRAINT feedback_message_len
      CHECK (message IS NULL OR char_length(message) <= 5000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_page_len'
  ) THEN
    ALTER TABLE feedback
      ADD CONSTRAINT feedback_page_len
      CHECK (page IS NULL OR char_length(page) <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_conversations_question_len'
  ) THEN
    ALTER TABLE coach_conversations
      ADD CONSTRAINT coach_conversations_question_len
      CHECK (question IS NULL OR char_length(question) <= 4000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_conversations_answer_len'
  ) THEN
    ALTER TABLE coach_conversations
      ADD CONSTRAINT coach_conversations_answer_len
      CHECK (answer IS NULL OR char_length(answer) <= 50000);
  END IF;
END $$;
