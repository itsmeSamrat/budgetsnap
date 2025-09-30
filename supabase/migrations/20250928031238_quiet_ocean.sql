/*
  # Fix RLS Policies for Profile Creation

  1. Security Updates
    - Update profiles table RLS policies to allow proper user creation
    - Ensure users can create their own profiles during signup
    - Fix policy conditions for authenticated users

  2. Policy Changes
    - Allow INSERT for authenticated users creating their own profile
    - Allow SELECT for users viewing their own profile
    - Allow UPDATE for users modifying their own profile
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies with correct conditions
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);