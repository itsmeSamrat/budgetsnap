/*
  # BudgetSnap Database Schema

  1. New Tables
    - `profiles`
      - `user_id` (uuid, primary key, references auth.users)
      - `display_name` (text)
      - `currency` (text, default 'USD')
      - `created_at` (timestamptz)
    - `transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, not null)
      - `date` (date, not null)
      - `description` (text, not null)
      - `amount` (numeric(12,2), not null)
      - `type` (text, check constraint for debit/credit)
      - `category` (text, default 'Uncategorized')
      - `image_path` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for user-specific access
    - Create indexes for performance

  3. Storage
    - Create receipts bucket with private access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  type text CHECK (type IN ('debit', 'credit')) NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  image_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create storage bucket (this will be done via Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Storage policy for receipts bucket
-- CREATE POLICY "Users can upload own receipts" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- CREATE POLICY "Users can view own receipts" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);