import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cnxtpimhbcgffgacwlpa.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_Mb_GZqoBwMk5CnjymwwXAA_66jTiNau';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
