import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a mock client for development when Supabase is not configured
const createMockClient = () => ({
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signUp: () => Promise.resolve({ data: null, error: { message: 'Please configure Supabase' } }),
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Please configure Supabase' } }),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () => Promise.resolve({ data: null, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null })
  },
  from: () => ({
    select: () => ({ 
      eq: () => ({ 
        single: () => Promise.resolve({ data: null, error: { message: 'Please configure Supabase' } }),
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }),
        limit: () => Promise.resolve({ data: [], error: null })
      }),
      order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
      gte: () => Promise.resolve({ data: [], error: null }),
      lte: () => Promise.resolve({ data: [], error: null }),
      ilike: () => ({ eq: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }) }) })
    }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Please configure Supabase' } }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: { message: 'Please configure Supabase' } }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: { message: 'Please configure Supabase' } }) }),
    upsert: () => Promise.resolve({ error: { message: 'Please configure Supabase' } })
  }),
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ error: { message: 'Please configure Supabase' } }),
      createSignedUrl: () => Promise.resolve({ data: null, error: { message: 'Please configure Supabase' } })
    })
  }
});

// Export the appropriate client
export const supabase = (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-url-here') 
  ? createMockClient() as any
  : createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          currency: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          currency?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          currency?: string;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          type: 'debit' | 'credit';
          category: string;
          image_path: string | null;
          created_at: string;
          updated_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          type: 'debit' | 'credit';
          category?: string;
          image_path?: string | null;
          created_at?: string;
          updated_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          description?: string;
          amount?: number;
          type?: 'debit' | 'credit';
          category?: string;
          image_path?: string | null;
          created_at?: string;
          updated_at?: string;
          notes?: string | null;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          month: number;
          target_amount: number;
          actual_amount: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          month: number;
          target_amount: number;
          actual_amount?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          month?: number;
          target_amount?: number;
          actual_amount?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          amount: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type?: string;
          amount: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          amount?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      goal_notes: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};