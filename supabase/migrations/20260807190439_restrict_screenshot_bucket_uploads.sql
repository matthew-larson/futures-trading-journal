/*
  # Restrict screenshot bucket uploads

  1. Changes
    - Limit `trade-screenshots` bucket to image MIME types only
    - Cap uploaded file size at 5 MB

  2. Security
    - Prevents arbitrary content (e.g. HTML) being hosted from the public bucket
    - Prevents unbounded storage consumption via the public anon key
*/

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
  file_size_limit = 5242880
WHERE id = 'trade-screenshots';
