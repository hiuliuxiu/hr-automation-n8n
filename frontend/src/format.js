const nf = new Intl.NumberFormat('vi-VN');
export const num = (v) => nf.format(v);
export const vnd = (v) => (v === 0 ? '0 ₫' : nf.format(v) + ' ₫');
export const pct = (v, d = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }).format(v * 100) + '%';

const pad = (n) => String(n).padStart(2, '0');
// mọi giờ hiển thị theo giờ Việt Nam (UTC+7), bất kể máy người xem đặt múi giờ nào
const vn = (d) => new Date(new Date(d).getTime() + 7 * 3600000);
export const time = (d) => { const x = vn(d); return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`; };
export const date = (d) => { const x = vn(d); return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`; };
export const shortDate = (d) => { const x = vn(d); return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}`; };
const WEEKDAY = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export const weekday = (d) => WEEKDAY[vn(d).getUTCDay()];
// ngày theo giờ Việt Nam dạng YYYY-MM-DD, để so với cột date trong DB
export const dayKey = (d) => vn(d).toISOString().slice(0, 10);
export const today = () => dayKey(Date.now());
// "Thứ Năm, 22 tháng 10"
export const longToday = () => { const x = vn(Date.now()); return `${WEEKDAY[x.getUTCDay()]}, ${x.getUTCDate()} tháng ${x.getUTCMonth() + 1}`; };
export const hourNow = () => vn(Date.now()).getUTCHours();

// tuần ISO theo giờ Việt Nam, dạng 2026-W43
export function isoWeek(d) {
  const x = vn(d); x.setUTCHours(0, 0, 0, 0); x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return `${x.getUTCFullYear()}-W${pad(Math.ceil(((x - y0) / 86400000 + 1) / 7))}`;
}

// "hôm nay 15:54", "ngày mai 21:12", "thứ Sáu 23/10 10:07"
export function when(d) {
  const diff = Math.round((new Date(dayKey(d)) - new Date(today())) / 86400000);
  if (diff === 0) return `hôm nay ${time(d)}`;
  if (diff === 1) return `ngày mai ${time(d)}`;
  if (diff === -1) return `hôm qua ${time(d)}`;
  return `${weekday(d).toLowerCase()} ${shortDate(d)} ${time(d)}`;
}

// khoảng thời gian bằng chữ: "6 giờ 14 phút", "1 ngày 11 giờ"
export function span(ms) {
  const m = Math.round(Math.abs(ms) / 60000), dd = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
  if (dd) return `${dd} ngày ${hh} giờ`;
  if (hh) return `${hh} giờ ${pad(mm)} phút`;
  return `${mm} phút`;
}
export const left = (until) => new Date(until) - Date.now();

export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);

export const initials = (name) => { const p = name.trim().split(/\s+/); return (p.at(-1)[0] + (p.length > 1 ? p[0][0] : '')).toUpperCase(); };
// mỗi người một sắc nhạt cố định (chỉ để nhận diện, không phải dữ liệu); năm sắc cách nhau khoảng 60 độ
const HUES = [205, 145, 30, 340, 85];
export const hueOf = (key) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
