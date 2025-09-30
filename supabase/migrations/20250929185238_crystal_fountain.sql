/*
  # Add delete policy for transactions

  1. Security
    - Add policy for authenticated users to delete their own transactions
    - Ensures users can only delete transactions they own
*/

-- Allow owners to delete their own transactions
CREATE POLICY "Users can delete own transactions"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);