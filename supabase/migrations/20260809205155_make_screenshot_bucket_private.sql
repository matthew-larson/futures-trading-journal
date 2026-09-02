/*
  # Make the trade screenshot bucket private

  1. Change
     - `storage.buckets.trade-screenshots` is switched from public to private so
       objects can no longer be fetched through the unauthenticated public object
       endpoint, which bypasses row level security entirely.

  2. Security
     - The existing owner-scoped policies on `storage.objects`
       (user_read_screenshots / user_insert_screenshots / user_update_screenshots /
       user_delete_screenshots) now actually govern reads.
     - Clients must obtain a short-lived signed URL, which is issued only to a
       caller the SELECT policy already allows.
     - The 5 MB size limit and the image-only mime allow list are left unchanged.
*/

UPDATE storage.buckets
SET public = false
WHERE id = 'trade-screenshots';
