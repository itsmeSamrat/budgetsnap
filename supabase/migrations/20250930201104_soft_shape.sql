/*
  # Add yearly target column to goals table

  1. Changes
    - Add yearly_target column to goals table for fixed yearly targets
    - Add index for better query performance

  2. Security
    - Column is nullable to maintain backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'yearly_target'
  ) THEN
    ALTER TABLE goals ADD COLUMN yearly_target numeric(12,2) DEFAULT NULL;
  END IF;
END $$;

-- Add index for yearly target queries
CREATE INDEX IF NOT EXISTS idx_goals_yearly_target ON goals(user_id, year, yearly_target);