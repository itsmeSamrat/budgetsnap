/*
  # Add notes column to transactions table

  1. Schema Changes
    - Add `notes` column to `transactions` table
    - `notes` (text, nullable) - Optional user notes for transactions

  2. Security
    - No RLS changes needed (inherits existing policies)
    - Notes are user-scoped through existing user_id policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'notes'
  ) THEN
    ALTER TABLE transactions ADD COLUMN notes text;
  END IF;
END $$;