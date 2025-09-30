/*
  # Fix delete policies for user data deletion

  1. Security Policies
    - Add policy for users to delete their own transactions
    - Add policy for users to delete their own profiles
    - Ensure proper RLS is enabled

  2. Notes
    - Users can only delete their own data (user_id = auth.uid())
    - These policies are required for the "Delete All Data" feature in settings
*/

-- Ensure RLS is enabled on both tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add delete policy for transactions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'transactions' 
    AND policyname = 'Users can delete own transactions'
  ) THEN
    CREATE POLICY "Users can delete own transactions"
      ON transactions
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Add delete policy for profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can delete own profile'
  ) THEN
    CREATE POLICY "Users can delete own profile"
      ON profiles
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;