import { supabase } from './supabase.js';

// Thao tác có gửi email, đụng lịch hoặc đánh thức workflow đang chờ đi qua "API cổng HR" của n8n.
// API tự kiểm tra phiên đăng nhập và quyền HR, trả về { ok, message }.
export async function callApi(action, payload = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  let res;
  try {
    res = await fetch(import.meta.env.VITE_HR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error('Không kết nối được tới hệ thống tự động (n8n). Kiểm tra mạng rồi thử lại.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) throw new Error(body.message || `Hệ thống tự động báo lỗi ${res.status}.`);
  return body;
}

// Ghi đơn giản đi thẳng vào DB qua các hàm hr_* (trong hàm có kiểm tra quyền HR và dữ liệu hợp lệ).
export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
