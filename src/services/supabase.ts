import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  '';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : ({
      from: () => ({
        upsert: async () => ({ error: null, data: null }),
        select: async () => ({ error: null, data: [] }),
      }),
    } as any);

/**
 * Helper to sync state to Supabase table
 */
export async function syncToSupabase(tableName: string, data: any) {
  try {
    const { error } = await supabase
      .from(tableName)
      .upsert(data, { onConflict: 'id' });
    if (error) {
      console.warn(`[Supabase Sync Warning - ${tableName}]:`, error.message);
    } else {
      console.log(`[Supabase Sync Success - ${tableName}]`);
    }
  } catch (err) {
    console.warn(`[Supabase Exception - ${tableName}]:`, err);
  }
}

/**
 * Fetch data from Supabase with local fallback
 */
export async function fetchFromSupabase<T>(tableName: string): Promise<T[] | null> {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error || !data) {
      console.warn(`[Supabase Fetch Warning - ${tableName}]:`, error?.message);
      return null;
    }
    return data as T[];
  } catch (err) {
    console.warn(`[Supabase Fetch Exception - ${tableName}]:`, err);
    return null;
  }
}
