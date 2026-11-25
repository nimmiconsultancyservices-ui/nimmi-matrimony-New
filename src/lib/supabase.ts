import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-supabase-anon-key')
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export const supabase = getSupabaseClient();

const tableColumnsCache = new Map<string, string[]>();

export async function inspectSupabaseTableColumns(
  tableName: string,
  accessToken?: string
): Promise<string[]> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) return [];
  const cached = tableColumnsCache.get(tableName);
  if (cached && cached.length > 0) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const headers: Record<string, string> = {
      apikey: supabaseAnonKey,
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const spec = (await response.json()) as {
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
    };
    const props = spec?.definitions?.[tableName]?.properties;
    if (!props || typeof props !== 'object') return [];
    const cols = Object.keys(props);
    if (cols.length > 0) {
      tableColumnsCache.set(tableName, cols);
    }
    return cols;
  } catch {
    return [];
  }
}

