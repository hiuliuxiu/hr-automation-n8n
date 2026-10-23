import { createClient } from '@supabase/supabase-js';

// Khóa publishable là khóa công khai: quyền đọc/ghi thật do RLS và danh sách hr_accounts trong DB quyết định.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY trong .env.local');

export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
