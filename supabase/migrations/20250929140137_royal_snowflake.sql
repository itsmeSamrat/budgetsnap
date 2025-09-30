/*
  # Create Storage RLS Policies

  1. Storage Policies
    - Allow authenticated users to upload their own receipts
    - Allow authenticated users to view their own receipts
    - Allow authenticated users to delete their own receipts

  2. Security
    - Users can only access files in their own folder (user_id)
    - All operations are scoped to the 'receipts' bucket
*/

-- Policy for users to upload their own receipts
CREATE POLICY "Users can upload own receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy for users to view their own receipts
CREATE POLICY "Users can view own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy for users to delete their own receipts
CREATE POLICY "Users can delete own receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy for users to update their own receipts (if needed)
CREATE POLICY "Users can update own receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );