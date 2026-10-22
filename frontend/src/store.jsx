import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { callApi, rpc } from './lib/api.js';
import { columnOf, OWNER } from './constants.js';
import { Splash } from './auth.jsx';
import { Btn } from './components/ui.jsx';

// Dữ liệu dùng chung cho mọi trang, đọc thẳng từ Supabase (RLS chỉ cho tài khoản HR đọc).
// Khi workflow n8n hoặc HR khác ghi vào DB, Realtime báo về và trang tự tải lại.
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const HOUR = 3600000;
// Bảng đã bật Realtime trong migration frontend_access
const REALTIME = ['candidates', 'cv_analyses', 'interviews', 'candidate_events', 'employees', 'onboarding_tasks', 'trainings', 'kpi_records', 'feedback', 'support_actions', 'jobs', 'automation_logs'];

async function fetchAll() {
  const q = (table, build = (x) => x) => build(supabase.from(table).select('*'));
  const parts = {
    jobs: q('jobs', (x) => x.order('job_id')),
    skills: q('job_skills', (x) => x.order('position')),
    candidates: q('candidates'),
    analyses: q('cv_analyses', (x) => x.order('analyzed_at')),
    interviews: q('interviews', (x) => x.order('starts_at')),
    events: q('candidate_events', (x) => x.order('occurred_at').order('event_id')),
    employees: q('employees', (x) => x.order('employee_id')),
    tasks: q('onboarding_tasks', (x) => x.order('due_date').order('task_id')),
    trainings: q('trainings', (x) => x.order('due_on')),
    courses: q('courses', (x) => x.order('course_id')),
    kpi: q('kpi_records', (x) => x.order('period').order('employee_id')),
    feedback: q('feedback', (x) => x.order('submitted_on', { ascending: false }).order('feedback_id', { ascending: false })),
    actions: q('support_actions', (x) => x.order('action_id')),
    logs: q('automation_logs', (x) => x.order('logged_at', { ascending: false }).limit(200)),
    settings: q('app_settings'),
    templates: q('onboarding_templates', (x) => x.order('due_offset_days').order('template_id')),
  };
  const keys = Object.keys(parts);
  const res = await Promise.all(Object.values(parts));
  const out = {};
  res.forEach((r, i) => { if (r.error) throw new Error(`${keys[i]}: ${r.error.message}`); out[keys[i]] = r.data; });
  return out;
}

const num = (v) => (v == null ? null : Number(v));

// Đổi dòng DB sang dạng các trang đang dùng
function shape(raw) {
  const settings = Object.fromEntries(raw.settings.map((s) => [s.key, s.value]));
  const hrHours = Number(settings.hr_review_hours) || 72;
  const choiceHours = Number(settings.candidate_choice_hours) || 24;

  const jobs = raw.jobs.map((j) => ({
    id: j.job_id, title: j.title, department: j.department, headcount: j.headcount, manager: j.hiring_manager || '',
    posted: j.posted_on, status: j.status, open: j.status === 'open', summary: j.description || '',
    skills: raw.skills.filter((s) => s.job_id === j.job_id).map((s) => s.skill),
  }));
  const jobById = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const employees = raw.employees.map((e) => ({
    id: e.employee_id, candidate: e.candidate_id, name: e.full_name, email: e.email, job: e.job_id, start: e.start_date,
    probationEnd: e.probation_end, manager: e.manager || '', buddy: e.buddy || '', status: e.employment_status,
    tools: e.tools_access, sample: e.is_sample,
  }));
  const employeeById = Object.fromEntries(employees.map((e) => [e.id, e]));

  const latestAnalysis = {};
  for (const a of raw.analyses) latestAnalysis[a.candidate_id] = a; // đã sắp theo thời gian, dòng sau là mới nhất
  const candidates = raw.candidates.map((c) => {
    const a = latestAnalysis[c.candidate_id];
    const events = raw.events.filter((e) => e.candidate_id === c.candidate_id);
    const iv = raw.interviews.filter((i) => i.candidate_id === c.candidate_id && i.status !== 'cancelled').at(-1);
    const invitedAt = events.filter((e) => e.to_status === 'awaiting_candidate').at(-1)?.occurred_at || null;
    const aiAt = a?.analyzed_at || null;
    const rubric = Array.isArray(a?.criteria) && a.criteria.length ? a.criteria.map((r, k) => ({
      id: 'R' + (k + 1), criterion: r.skill, max: num(r.max_points), level: r.level, points: num(r.points),
      quote: r.evidence || '', question: r.question || '', verified: r.verified !== false, reason: r.reason || '',
    })) : null;
    // n8n đang chờ ai, và đến khi nào
    let waitFor = null;
    if (['awaiting_hr', 'hr_overdue'].includes(c.status)) waitFor = { who: 'HR', hours: hrHours, until: new Date(new Date(aiAt || c.applied_at).getTime() + hrHours * HOUR) };
    if (c.status === 'awaiting_candidate' && invitedAt) waitFor = { who: 'Ứng viên', hours: choiceHours, until: new Date(new Date(invitedAt).getTime() + choiceHours * HOUR) };
    return {
      id: c.candidate_id, name: c.full_name, job: c.job_id, jobTitle: jobById[c.job_id]?.title || c.job_id, status: c.status,
      email: c.email, phone: c.phone || '', applied: c.applied_at, consent: c.consent_at, cover: c.cover_letter || '',
      hrNote: c.hr_note || '', cvUrl: c.cv_url || '', sample: c.is_sample,
      score: a?.score ?? null, summary: a?.summary || '', cv: a?.cv_text || '', declared: a?.declared_role || '', aiAt,
      rubric, verify: a?.skills_to_verify || [], questions: a?.interview_questions || [], analyzed: !!a,
      interview: iv ? { id: iv.interview_id, start: iv.starts_at, end: iv.ends_at || iv.starts_at, meet: iv.meet_url || '', status: iv.status, result: iv.result } : null,
      events, invitedAt, waitFor,
      employee: employees.find((e) => e.candidate === c.candidate_id)?.id || null,
    };
  });

  const tasks = raw.tasks.map((t) => ({
    id: t.task_id, emp: t.employee_id, name: t.task_name, ownerRole: t.owner_role, owner: OWNER[t.owner_role] || t.owner_role,
    category: t.category, due: t.due_date, status: t.status, done: t.completed_on, submitted: t.submitted_at,
    proof: t.proof_name || '', proofUrl: t.proof_url || '', note: t.employee_note || '', hrReview: t.hr_review, hrNote: t.hr_note || '',
  }));
  const courses = raw.courses.map((c) => ({ id: c.course_id, name: c.name, hours: num(c.duration_hours), cost: num(c.cost_vnd) || 0, status: c.status }));
  const trainings = raw.trainings.map((t) => ({ id: t.training_id, emp: t.employee_id, course: t.course_id, due: t.due_on, status: t.status, done: t.completed_on }));
  const kpi = raw.kpi.map((k) => ({ id: k.kpi_id, emp: k.employee_id, period: k.period, metric: k.metric, target: num(k.target), actual: num(k.actual), unit: k.unit, source: k.source }));
  const feedback = raw.feedback.map((f) => ({
    id: f.feedback_id, emp: f.employee_id, period: f.period, submitted: f.submitted_on, satisfaction: f.satisfaction, support: f.support_requested,
    topic: f.topic, status: f.status, text: f.message, summary: f.ai_summary || '', action: f.suggested_action || '',
  }));
  const actions = raw.actions.map((a) => ({
    id: a.action_id, emp: a.employee_id, fb: a.feedback_id, title: a.title, ownerRole: a.owner_role, owner: OWNER[a.owner_role] || a.owner_role,
    due: a.due_on, status: a.status, done: a.completed_at, note: a.note || '',
  }));
  const logs = raw.logs.map((l) => ({ id: l.log_id, at: l.logged_at, wf: l.workflow, entity: l.entity_id, event: l.event, level: l.level, exec: l.n8n_execution_id, msg: l.message || '' }));
  const templates = raw.templates.map((t) => ({
    id: t.template_id, job: t.job_id, name: t.task_name, category: t.category, ownerRole: t.owner_role, offset: t.due_offset_days,
    course: t.course_id, required: t.required, status: t.status,
  }));

  return {
    settings, jobs, jobById, employees, employeeById, candidates, tasks, courses, courseById: Object.fromEntries(courses.map((c) => [c.id, c])),
    trainings, kpi, feedback, actions, logs, templates, events: raw.events,
  };
}

// Mỗi thao tác HR: nói rõ hệ thống sẽ làm gì, rồi gọi API n8n (có email/lịch) hoặc hàm DB.
export const ACTIONS = {
  invite: {
    label: 'Mời phỏng vấn', kind: 'primary',
    allowed: ['awaiting_hr', 'hr_overdue', 'on_hold'],
    title: (c) => `Mời ${c.name} phỏng vấn?`,
    body: (c, s) => `Hệ thống sẽ gửi email kèm các khung giờ còn trống trong lịch Google của bạn. Ứng viên có ${s.candidate_choice_hours || 24} giờ để chọn; khi ứng viên chọn, lịch và link Google Meet được tạo tự động.`,
    confirm: 'Gửi lời mời',
    run: (c, note) => callApi('candidate.decide', { candidate_id: c.id, decision: 'invite', note }),
  },
  reinvite: {
    label: 'Gửi lại khung giờ', kind: 'primary',
    allowed: ['needs_scheduling'],
    title: (c) => `Gửi lại khung giờ cho ${c.name}?`,
    body: (c, s) => `Hệ thống đọc lại lịch của bạn và gửi email với các khung giờ còn trống mới. Ứng viên có ${s.candidate_choice_hours || 24} giờ để chọn.`,
    confirm: 'Gửi khung giờ',
    run: (c, note) => callApi('candidate.decide', { candidate_id: c.id, decision: 'invite', note }),
  },
  hold: {
    label: 'Tạm giữ', kind: 'ghost',
    allowed: ['awaiting_hr', 'hr_overdue', 'needs_scheduling'],
    title: (c) => `Tạm giữ hồ sơ ${c.name}?`,
    body: () => 'Hồ sơ chuyển sang Tạm giữ để xem xét thêm. Không gửi gì cho ứng viên; bạn mời phỏng vấn hoặc đóng hồ sơ sau.',
    confirm: 'Tạm giữ',
    run: (c, note) => callApi('candidate.decide', { candidate_id: c.id, decision: 'hold', note }),
  },
  remind: {
    label: 'Nhắc ứng viên chọn giờ', kind: 'ghost', noNote: true,
    allowed: ['awaiting_candidate'],
    title: (c) => `Nhắc ${c.name} chọn giờ phỏng vấn?`,
    body: () => 'Hệ thống gửi một email ngắn nhắc ứng viên mở thư mời và chọn giờ trước hạn.',
    confirm: 'Gửi nhắc',
    run: (c) => callApi('candidate.remind', { candidate_id: c.id }),
  },
  interviewed: {
    label: 'Đánh dấu đã phỏng vấn', kind: 'ghost',
    allowed: ['interview_scheduled'],
    title: (c) => `Đánh dấu đã phỏng vấn ${c.name}?`,
    body: () => 'Hồ sơ chuyển sang chờ ghi kết quả. Không gửi gì cho ứng viên.',
    confirm: 'Đã phỏng vấn',
    run: async (c, note) => { await rpc('hr_mark_interviewed', { p_candidate_id: c.id, p_note: note || null }); return { message: `${c.name} chuyển sang Đã phỏng vấn.` }; },
  },
  hire: {
    label: 'Xác nhận nhận việc', kind: 'primary',
    allowed: ['interviewed'],
    title: (c) => `Xác nhận ${c.name} nhận việc?`,
    body: () => 'Hệ thống tạo ngay hồ sơ nhân viên, checklist onboarding, khoá học bắt buộc và gửi email chào mừng.',
    confirm: 'Xác nhận nhận việc',
    run: (c, note) => callApi('candidate.hire', { candidate_id: c.id, note }),
  },
  reject: {
    label: 'Không phù hợp', kind: 'plain', danger: true,
    allowed: ['awaiting_hr', 'hr_overdue', 'on_hold', 'needs_scheduling', 'awaiting_candidate', 'interview_scheduled', 'interviewed'],
    title: (c) => (c.status === 'interviewed' ? `${c.name} không đạt phỏng vấn?` : columnOf(c.status) === 'invited' ? `Huỷ lời mời và đóng hồ sơ ${c.name}?` : `Đóng hồ sơ ${c.name}?`),
    body: (c) => (c.status === 'interviewed' ? 'Hệ thống gửi thư cảm ơn sau phỏng vấn và đóng hồ sơ.'
      : columnOf(c.status) === 'invited' ? 'Hệ thống huỷ lịch trên Google Calendar (nếu đã có), gửi thư báo huỷ lời mời và đóng hồ sơ.'
        : 'Hệ thống gửi thư cảm ơn và đóng hồ sơ. Bạn vẫn mở lại được sau.'),
    confirm: 'Gửi thư và đóng',
    run: (c, note) => callApi('candidate.decide', { candidate_id: c.id, decision: 'reject', note }),
  },
  reopen: {
    label: 'Mở lại hồ sơ', kind: 'ghost',
    allowed: ['rejected', 'withdrawn'],
    title: (c) => `Mở lại hồ sơ ${c.name}?`,
    body: () => 'Hồ sơ quay về Cần HR duyệt ở trạng thái Tạm giữ; không gửi gì cho ứng viên.',
    confirm: 'Mở lại',
    run: async (c, note) => { await rpc('hr_reopen_candidate', { p_candidate_id: c.id, p_note: note || null }); return { message: `Đã mở lại hồ sơ ${c.name}.` }; },
  },
};

// Kéo thẻ từ cột này sang cột kia ứng với một thao tác
const MOVES = {
  review: { invited: 'invite', rejected: 'reject' },
  invited: { interviewed: 'interviewed', rejected: 'reject' },
  interviewed: { hired: 'hire', rejected: 'reject' },
  rejected: { review: 'reopen' },
};
const AI_READING = 'AI đang đọc CV này, hãy chờ khoảng 2 phút.';
function blockedReason(c, key) {
  if (c.status === 'received') return AI_READING;
  if (key === 'interviewed' && c.status === 'awaiting_candidate') return 'Ứng viên chưa chọn giờ phỏng vấn.';
  if (key === 'interviewed' && c.status === 'needs_scheduling') return 'Chưa có lịch phỏng vấn. Hãy gửi lại khung giờ hoặc trao đổi với ứng viên.';
  if (!ACTIONS[key].allowed.includes(c.status)) return 'Không chuyển được sang bước này.';
  return null;
}
export function moveFor(c, toCol) {
  const key = MOVES[columnOf(c.status)]?.[toCol];
  if (!key) return { blocked: 'Không chuyển được sang bước này.' };
  const why = blockedReason(c, key);
  return why ? { blocked: why } : { key };
}
// Các nút thao tác hiện trên hồ sơ, theo thứ tự hiển thị
const ORDER = ['invite', 'reinvite', 'remind', 'interviewed', 'hire', 'hold', 'reopen', 'reject'];
export const actionsFor = (c) => ORDER.filter((k) => ACTIONS[k].allowed.includes(c.status));

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const timer = useRef(null);
  const loading = useRef(false);
  const again = useRef(false);

  const load = useCallback(async () => {
    // gộp các lần tải chồng nhau: nếu đang tải thì tải thêm một lần sau khi xong
    if (loading.current) { again.current = true; return; }
    loading.current = true;
    try {
      setData(shape(await fetchAll()));
      setError('');
    } catch (e) {
      setError(e.message || 'Không tải được dữ liệu.');
    } finally {
      loading.current = false;
      if (again.current) { again.current = false; load(); }
    }
  }, []);
  const reload = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(load, 350); }, [load]);

  useEffect(() => {
    load();
    const ch = supabase.channel('hr-portal');
    REALTIME.forEach((table) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, reload));
    ch.subscribe();
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); reload(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { supabase.removeChannel(ch); clearInterval(tick); clearTimeout(timer.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, reload]);

  // Ghi xong thì tải lại ngay, không chờ Realtime
  const act = useCallback(async (p) => { const r = await p; reload(); return r; }, [reload]);
  const ops = useMemo(() => ({
    runAction: (key, c, note) => act(ACTIONS[key].run(c, note)),
    reviewTask: (t, decision, note) => act(callApi('task.review', { task_id: t.id, decision, note })),
    remindEmployee: (e) => act(callApi('employee.remind', { employee_id: e.id })),
    decideFeedback: (f, decision, note) => act(callApi('feedback.decide', { feedback_id: f.id, decision, note })),
    setActionStatus: (a, status, note) => act(rpc('hr_set_action_status', { p_action_id: a.id, p_status: status, p_note: note || null })),
    saveKpi: (k) => act(rpc('hr_save_kpi', { p_employee_id: k.emp, p_period: k.period, p_metric: k.metric, p_target: k.target, p_actual: k.actual, p_unit: k.unit })),
    deleteKpi: (k) => act(rpc('hr_delete_kpi', { p_kpi_id: k.id })),
    saveSettings: (values) => act(rpc('hr_save_settings', { p_values: values })),
    saveJob: (j) => act(rpc('hr_save_job', {
      p_job_id: j.id || null, p_title: j.title, p_department: j.department, p_headcount: j.headcount, p_description: j.summary,
      p_hiring_manager: j.manager, p_skills: j.skills, p_copy_templates_from: j.copyFrom || null,
    })),
    setJobStatus: (j, status) => act(rpc('hr_set_job_status', { p_job_id: j.id, p_status: status })),
    saveTemplate: (t) => act(rpc('hr_save_template', {
      p_template_id: t.id || null, p_job_id: t.job, p_task_name: t.name, p_category: t.category, p_owner_role: t.ownerRole,
      p_due_offset_days: t.offset, p_course_id: t.course || null, p_required: t.required,
    })),
    retireTemplate: (t) => act(rpc('hr_retire_template', { p_template_id: t.id })),
  }), [act]);

  if (!data) {
    return error
      ? <Splash>Không tải được dữ liệu: {error} <Btn size="sm" onClick={load}>Thử lại</Btn></Splash>
      : <Splash>Đang tải dữ liệu…</Splash>;
  }
  return <Ctx.Provider value={{ ...data, now, error, reload, ...ops }}>{children}</Ctx.Provider>;
}
