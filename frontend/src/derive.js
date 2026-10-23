import { addDays, isoWeek, today } from './format.js';

// Các số liệu tổng hợp, luôn tính từ từng dòng dữ liệu (không gõ tay số tổng).
const RANK = { received: 0, awaiting_hr: 1, hr_overdue: 1, on_hold: 1, rejected: 1, withdrawn: 1, awaiting_candidate: 2, needs_scheduling: 2, interview_scheduled: 2, interviewed: 3, hired: 4 };

export function funnel(list) {
  const reach = (r) => list.filter((c) => RANK[c.status] >= r).length;
  const rows = [
    { label: 'Nộp hồ sơ', n: reach(0) },
    { label: 'AI đã đánh giá', n: reach(1) },
    { label: 'Mời phỏng vấn', n: reach(2) },
    { label: 'Nhận việc', n: reach(4) },
  ];
  return rows.map((r, i) => ({ ...r, rate: i === 0 ? null : rows[i - 1].n ? r.n / rows[i - 1].n : 0 }));
}

// Số hồ sơ nhận được trong từng tuần ISO, `weeks` tuần gần nhất tính tới tuần này
export function perWeek(list, weeks = 8) {
  const keys = [];
  for (let i = weeks - 1; i >= 0; i--) keys.push(isoWeek(addDays(Date.now(), -7 * i)));
  return keys.map((k) => ({ w: 'W' + k.slice(6), n: list.filter((c) => isoWeek(c.applied) === k).length }));
}

export function taskState(t) {
  if (t.status === 'done') return 'done';
  if (t.status === 'submitted') return 'submitted';
  if (t.status === 'blocked') return 'blocked';
  return t.due < today() ? 'late' : 'pending';
}
export function onboarding(employees, tasks) {
  return employees.filter((e) => e.status !== 'resigned').map((e) => {
    const mine = tasks.filter((t) => t.emp === e.id).map((t) => ({ ...t, state: taskState(t) }));
    const done = mine.filter((t) => t.state === 'done').length;
    return { ...e, tasks: mine, total: mine.length, done, late: mine.filter((t) => t.state === 'late').length, blocked: mine.filter((t) => t.state === 'blocked').length, submitted: mine.filter((t) => t.state === 'submitted').length };
  });
}

// Tỷ lệ đạt KPI của một người trong một kỳ: trung bình tỷ lệ các chỉ tiêu (như WF3)
export function kpiRate(kpi, emp, period) {
  const xs = kpi.filter((k) => k.emp === emp && k.period === period && k.target > 0);
  return xs.length ? Math.round(xs.reduce((s, k) => s + (k.actual / k.target) * 100, 0) / xs.length) : null;
}
export const periodsOf = (rows, n = 4) => [...new Set(rows.map((r) => r.period))].sort().slice(-n);

// Tên ngắn trên biểu đồ; trùng tên thì thêm chữ lót
function shortNames(people) {
  const last = (p, n) => p.name.trim().split(/\s+/).slice(-n).join(' ');
  return people.map((p) => (people.filter((x) => last(x, 1) === last(p, 1)).length > 1 ? last(p, 2) : last(p, 1)));
}

// Biểu đồ KPI: tối đa 3 người có số liệu gần nhất, 4 kỳ gần nhất
export function kpiSeries(kpi, employeeById) {
  const periods = periodsOf(kpi);
  const ids = [...new Set([...kpi].filter((k) => periods.includes(k.period)).sort((a, b) => b.period.localeCompare(a.period) || a.emp.localeCompare(b.emp)).map((k) => k.emp))]
    .filter((id) => employeeById[id]).slice(0, 3).sort();
  const people = ids.map((id) => employeeById[id]);
  const names = shortNames(people);
  const data = periods.map((p) => {
    const row = { p: p.slice(5) };
    ids.forEach((id, i) => { row[names[i]] = kpiRate(kpi, id, p); });
    return row;
  });
  return { names, ids, data, periods };
}

export function satisfaction(feedback, TOPIC) {
  const periods = periodsOf(feedback);
  const data = periods.map((p) => {
    const xs = feedback.filter((f) => f.period === p && f.satisfaction != null);
    const avg = xs.length ? Math.round((xs.reduce((a, f) => a + f.satisfaction, 0) / xs.length) * 10) / 10 : null;
    return { p: p.slice(5), avg, n: xs.length };
  });
  const topics = Object.entries(feedback.reduce((m, f) => ({ ...m, [f.topic]: (m[f.topic] || 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: TOPIC[k] || k, n }));
  return { data, topics };
}
