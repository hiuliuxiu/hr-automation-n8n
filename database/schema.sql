-- ============================================================================
-- ABC TECH · HR AUTOMATION — SCHEMA (PostgreSQL 17 / Supabase)
-- Chạy một lần trên schema public trống, trong Supabase SQL Editor. Sau đó chạy seed.sql.
--
-- Nguyên tắc:
--   * Danh mục có mã 3 chữ số (JOB-001, CRS-001, TPL-001); các bảng còn lại có mã TIỀN TỐ-NNNN do DB sinh
--     (CAN-0001, EMP-0001, OB-0001, TRN-0001, FB-0001, ACT-0001). legacy_id giữ mã cũ khi chuyển từ Google Sheets.
--   * Trạng thái là bộ giá trị cố định (CHECK hoặc bảng tra cứu); DB từ chối giá trị lạ.
--   * Thời điểm lưu timestamptz (UTC); ngày nghiệp vụ lưu date.
--   * Không lưu số liệu suy ra được (tỷ lệ, ROI, trạng thái quá hạn, báo cáo tuần): tính bằng VIEW.
--   * Dữ liệu mẫu được đánh dấu is_sample = true trên ứng viên / nhân viên.
--   * Bảo mật: RLS bật trên mọi bảng. Người chưa đăng nhập không đọc được gì. Tài khoản đăng nhập chỉ đọc được
--     khi email nằm trong app_settings.hr_accounts, và chỉ ghi qua các hàm hr_*. n8n kết nối bằng tài khoản
--     postgres nên không bị các quy tắc này chặn.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Hàm dùng chung
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Danh mục: vị trí tuyển dụng, kỹ năng, khoá học, checklist mẫu
-- ---------------------------------------------------------------------------
create sequence public.jobs_code_seq;
create table public.jobs (
  job_id          text primary key default 'JOB-' || lpad(nextval('public.jobs_code_seq')::text, 3, '0'),
  title           text not null,
  department      text not null,
  headcount       smallint not null default 1 check (headcount > 0),
  description     text,
  hiring_manager  text,
  status          text not null default 'open' check (status in ('open', 'paused', 'closed')),
  posted_on       date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.jobs is 'Vị trí tuyển dụng. status = open thì hiện trên form ứng tuyển.';

-- Kỹ năng yêu cầu của từng vị trí = rubric AI dùng để chấm CV (trước đây là chuỗi "a; b; c" trong Jobs.Required Skills)
create table public.job_skills (
  job_id    text not null references public.jobs (job_id) on delete cascade,
  position  smallint not null check (position > 0),
  skill     text not null,
  weight    numeric(5, 2) not null default 1 check (weight > 0),
  primary key (job_id, position),
  unique (job_id, skill)
);
comment on column public.job_skills.weight is 'Trọng số tương đối; điểm tối đa của kỹ năng = 100 * weight / tổng weight của vị trí.';

create sequence public.courses_code_seq;
create table public.courses (
  course_id        text primary key default 'CRS-' || lpad(nextval('public.courses_code_seq')::text, 3, '0'),
  name             text not null,
  skill            text,
  job_id           text references public.jobs (job_id) on delete set null,
  level            text not null default 'basic' check (level in ('basic', 'intermediate', 'advanced')),
  duration_hours   numeric(5, 1) check (duration_hours > 0),
  cost_vnd         numeric(12, 0) not null default 0 check (cost_vnd >= 0),
  material_url     text,
  validity_days    integer check (validity_days > 0),
  prerequisite_id  text references public.courses (course_id) on delete set null,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.courses.job_id is 'NULL = khoá chung cho mọi vị trí.';
comment on column public.courses.validity_days is 'NULL = chứng chỉ không hết hạn.';

create sequence public.onboarding_templates_code_seq;
create table public.onboarding_templates (
  template_id      text primary key default 'TPL-' || lpad(nextval('public.onboarding_templates_code_seq')::text, 3, '0'),
  job_id           text not null references public.jobs (job_id) on delete cascade,
  task_name        text not null,
  category         text not null check (category in ('paperwork', 'access', 'social', 'training', 'practice', 'review')),
  owner_role       text not null check (owner_role in ('hr', 'it', 'employee', 'buddy', 'manager')),
  due_offset_days  integer not null default 0,
  course_id        text references public.courses (course_id) on delete set null,
  required         boolean not null default true,
  status           text not null default 'active' check (status in ('active', 'retired')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.onboarding_templates.due_offset_days is 'Số ngày so với ngày bắt đầu làm; âm = việc chuẩn bị trước ngày đầu.';

-- ---------------------------------------------------------------------------
-- 2. Tuyển dụng: ứng viên, kết quả AI, lịch phỏng vấn, lịch sử trạng thái
-- ---------------------------------------------------------------------------
create table public.candidate_statuses (
  code           text primary key,
  label_vi       text not null,
  kanban_column  text not null check (kanban_column in ('new', 'review', 'invited', 'interviewed', 'hired', 'rejected')),
  is_terminal    boolean not null default false,
  sort_order     smallint not null unique
);
insert into public.candidate_statuses (code, label_vi, kanban_column, is_terminal, sort_order) values
  ('received',            'AI đang đọc CV',          'new',         false, 10),
  ('awaiting_hr',         'Chờ HR duyệt',            'review',      false, 20),
  ('hr_overdue',          'Quá hạn duyệt',           'review',      false, 21),
  ('on_hold',             'Tạm giữ',                 'review',      false, 22),
  ('awaiting_candidate',  'Chờ ứng viên chọn giờ',   'invited',     false, 30),
  ('needs_scheduling',    'Cần HR xếp lịch',         'invited',     false, 31),
  ('interview_scheduled', 'Đã hẹn phỏng vấn',        'invited',     false, 32),
  ('interviewed',         'Chờ kết quả phỏng vấn',   'interviewed', false, 40),
  ('hired',               'Nhận việc',               'hired',       true,  50),
  ('rejected',            'Không phù hợp',           'rejected',    true,  60),
  ('withdrawn',           'Ứng viên rút hồ sơ',      'rejected',    true,  61);
comment on table public.candidate_statuses is 'Bộ trạng thái thống nhất cho workflow, DB và giao diện. needs_scheduling gộp các ca: ứng viên xin đổi giờ, quá hạn chọn giờ, hết khung trống, trùng lịch.';

create sequence public.candidates_code_seq;
create table public.candidates (
  candidate_id      text primary key default 'CAN-' || lpad(nextval('public.candidates_code_seq')::text, 4, '0'),
  legacy_id         text unique,
  job_id            text not null references public.jobs (job_id),
  full_name         text not null check (length(btrim(full_name)) >= 2),
  email             text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone             text,
  status            text not null default 'received' references public.candidate_statuses (code),
  source            text not null default 'application_form' check (source in ('application_form', 'manual')),
  cv_url            text,
  cover_letter      text,
  hr_note           text,
  consent_at        timestamptz,
  applied_at        timestamptz not null default now(),
  n8n_execution_id  text,
  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Chống nộp trùng: một email chỉ có một hồ sơ đang xử lý cho mỗi vị trí
create unique index candidates_one_active_application on public.candidates (lower(email), job_id)
  where status not in ('rejected', 'withdrawn');
create index candidates_status_idx on public.candidates (status);
create index candidates_job_idx on public.candidates (job_id);
comment on column public.candidates.n8n_execution_id is 'Execution của WF1 đang xử lý hồ sơ; WF1 dùng để kiểm tra trước khi đặt lịch.';

create table public.cv_analyses (
  analysis_id          bigint generated always as identity primary key,
  candidate_id         text not null references public.candidates (candidate_id) on delete cascade,
  cv_text              text,
  summary              text,
  score                smallint check (score between 0 and 100),
  criteria             jsonb,
  skills_to_verify     text[] not null default '{}',
  interview_questions  text[] not null default '{}',
  cv_email             text,
  declared_role        text,
  model                text,
  rubric_version       text,
  analyzed_at          timestamptz not null default now()
);
create index cv_analyses_candidate_idx on public.cv_analyses (candidate_id, analyzed_at desc);
comment on table public.cv_analyses is 'Mỗi lần AI đọc CV là một dòng; hồ sơ có thể được chấm lại. Bản mới nhất xem ở v_candidates.';
comment on column public.cv_analyses.criteria is 'Kết quả từng kỹ năng: [{skill, level 0-2, points, max_points, evidence, question}].';

create table public.interviews (
  interview_id       bigint generated always as identity primary key,
  candidate_id       text not null references public.candidates (candidate_id) on delete cascade,
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  meet_url           text,
  calendar_event_id  text unique,
  status             text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  result             text check (result in ('pass', 'fail')),
  note               text,
  created_at         timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index interviews_starts_idx on public.interviews (starts_at);
create index interviews_candidate_idx on public.interviews (candidate_id);

create table public.candidate_events (
  event_id      bigint generated always as identity primary key,
  candidate_id  text not null references public.candidates (candidate_id) on delete cascade,
  from_status   text references public.candidate_statuses (code),
  to_status     text not null references public.candidate_statuses (code),
  actor         text not null default 'system' check (actor in ('system', 'hr', 'candidate', 'migration')),
  note          text,
  occurred_at   timestamptz not null default now()
);
create index candidate_events_candidate_idx on public.candidate_events (candidate_id, occurred_at);
comment on table public.candidate_events is 'Lịch sử đổi trạng thái, trigger tự ghi. Workflow có thể đặt người thực hiện: set local app.actor = ''hr''.';

-- Tự ghi lịch sử khi tạo hồ sơ hoặc đổi trạng thái
create or replace function public.log_candidate_status()
returns trigger language plpgsql set search_path = '' as $$
declare
  who text := coalesce(nullif(pg_catalog.current_setting('app.actor', true), ''), 'system');
begin
  if pg_catalog.current_setting('app.skip_events', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    insert into public.candidate_events (candidate_id, from_status, to_status, actor) values (new.candidate_id, null, new.status, who);
  elsif new.status is distinct from old.status then
    insert into public.candidate_events (candidate_id, from_status, to_status, actor) values (new.candidate_id, old.status, new.status, who);
  end if;
  return new;
end $$;
create trigger candidates_log_status after insert or update of status on public.candidates
  for each row execute function public.log_candidate_status();

-- ---------------------------------------------------------------------------
-- 3. Nhân sự: nhân viên, checklist onboarding, đào tạo
-- ---------------------------------------------------------------------------
create sequence public.employees_code_seq;
create table public.employees (
  employee_id        text primary key default 'EMP-' || lpad(nextval('public.employees_code_seq')::text, 4, '0'),
  legacy_id          text unique,
  candidate_id       text unique references public.candidates (candidate_id) on delete set null,
  job_id             text not null references public.jobs (job_id),
  full_name          text not null,
  email              text not null unique,
  start_date         date not null,
  probation_end      date generated always as (start_date + 90) stored,
  manager            text,
  buddy              text,
  employment_status  text not null default 'probation' check (employment_status in ('probation', 'official', 'resigned')),
  tools_access       text not null default 'pending' check (tools_access in ('pending', 'confirmed')),
  is_sample          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index employees_job_idx on public.employees (job_id);
comment on column public.employees.job_id is 'Phòng ban lấy từ jobs.department (không lưu lặp).';

create sequence public.onboarding_tasks_code_seq;
create table public.onboarding_tasks (
  task_id           text primary key default 'OB-' || lpad(nextval('public.onboarding_tasks_code_seq')::text, 4, '0'),
  legacy_id         text unique,
  employee_id       text not null references public.employees (employee_id) on delete cascade,
  template_id       text references public.onboarding_templates (template_id) on delete set null,
  task_name         text not null,
  category          text not null check (category in ('paperwork', 'access', 'social', 'training', 'practice', 'review')),
  owner_role        text not null check (owner_role in ('hr', 'it', 'employee', 'buddy', 'manager')),
  due_date          date not null,
  status            text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'done', 'blocked')),
  completed_on      date,
  course_id         text references public.courses (course_id) on delete set null,
  employee_note     text,
  submitted_at      timestamptz,
  proof_name        text,
  proof_url         text,
  hr_review         text check (hr_review in ('approved', 'returned')),
  hr_note           text,
  reviewed_at       timestamptz,
  last_reminded_on  date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (status <> 'done' or completed_on is not null)
);
create index onboarding_tasks_employee_idx on public.onboarding_tasks (employee_id, status);
create index onboarding_tasks_due_idx on public.onboarding_tasks (due_date) where status <> 'done';
comment on column public.onboarding_tasks.status is 'submitted = nhân viên đã nộp kết quả, chờ HR duyệt (trước đây WF2 ghi pending_hr).';

create sequence public.trainings_code_seq;
create table public.trainings (
  training_id             text primary key default 'TRN-' || lpad(nextval('public.trainings_code_seq')::text, 4, '0'),
  legacy_id               text unique,
  employee_id             text not null references public.employees (employee_id) on delete cascade,
  course_id               text not null references public.courses (course_id),
  source                  text not null default 'template' check (source in ('template', 'ai_suggested', 'manual')),
  assigned_on             date not null default current_date,
  due_on                  date,
  status                  text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completed_on            date,
  certificate_expires_on  date,
  last_reminded_at        timestamptz,
  cost_vnd                numeric(12, 0) check (cost_vnd >= 0),
  benefit_vnd             numeric(12, 0) check (benefit_vnd >= 0),
  pre_score               numeric(5, 2),
  post_score              numeric(5, 2),
  note                    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (employee_id, course_id),
  check (status <> 'completed' or completed_on is not null)
);
comment on column public.trainings.cost_vnd is 'Chi phí thực tế của lần học này (mặc định lấy theo courses.cost_vnd lúc giao).';
comment on column public.trainings.benefit_vnd is 'Lợi ích quy đổi ra tiền, nhập khi muốn tính ROI. ROI xem ở v_training_roi.';

-- ---------------------------------------------------------------------------
-- 4. Hiệu suất: KPI, phản hồi, hành động hỗ trợ
-- ---------------------------------------------------------------------------
create table public.kpi_records (
  kpi_id       bigint generated always as identity primary key,
  employee_id  text not null references public.employees (employee_id) on delete cascade,
  period       text not null check (period ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  metric       text not null,
  target       numeric(10, 2) not null check (target > 0),
  actual       numeric(10, 2) not null check (actual >= 0),
  unit         text not null,
  source       text,
  recorded_on  date not null default current_date,
  unique (employee_id, period, metric)
);
comment on column public.kpi_records.period is 'Tuần ISO, ví dụ 2026-W40.';

create sequence public.feedback_code_seq;
create table public.feedback (
  feedback_id        text primary key default 'FB-' || lpad(nextval('public.feedback_code_seq')::text, 4, '0'),
  legacy_id          text unique,
  employee_id        text not null references public.employees (employee_id) on delete cascade,
  period             text not null check (period ~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$'),
  submitted_on       date not null default current_date,
  satisfaction       smallint check (satisfaction between 1 and 5),
  message            text not null,
  support_requested  boolean not null default false,
  topic              text not null default 'other' check (topic in ('training', 'tools', 'workload', 'schedule', 'environment', 'other')),
  ai_summary         text,
  suggested_action   text,
  status             text not null default 'pending_hr' check (status in ('pending_hr', 'reviewed', 'action_open', 'declined')),
  created_at         timestamptz not null default now()
);
create index feedback_employee_period_idx on public.feedback (employee_id, period);

create sequence public.support_actions_code_seq;
create table public.support_actions (
  action_id     text primary key default 'ACT-' || lpad(nextval('public.support_actions_code_seq')::text, 4, '0'),
  legacy_id     text unique,
  employee_id   text not null references public.employees (employee_id) on delete cascade,
  feedback_id   text references public.feedback (feedback_id) on delete set null,
  title         text not null,
  owner_role    text not null check (owner_role in ('hr', 'it', 'manager', 'buddy', 'employee')),
  due_on        date,
  status        text not null default 'pending_approval' check (status in ('pending_approval', 'in_progress', 'done', 'cancelled')),
  completed_at  timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'done' or completed_at is not null)
);
create index support_actions_employee_idx on public.support_actions (employee_id, status);
comment on column public.support_actions.status is 'pending_approval = HR chưa duyệt (thay cho cột hr_approved cũ).';

-- ---------------------------------------------------------------------------
-- 5. Hệ thống: cài đặt (giá trị nạp ở seed.sql) và nhật ký tự động
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key          text primary key,
  value        jsonb not null,
  description  text,
  updated_at   timestamptz not null default now()
);

create table public.automation_logs (
  log_id            bigint generated always as identity primary key,
  workflow          text not null check (workflow in ('WF1', 'WF2', 'WF3', 'system')),
  entity_id         text,
  event             text not null,
  level             text not null default 'info' check (level in ('info', 'success', 'waiting', 'skipped', 'warning', 'error')),
  message           text,
  n8n_execution_id  text,
  logged_at         timestamptz not null default now()
);
create index automation_logs_time_idx on public.automation_logs (logged_at desc);
create index automation_logs_workflow_idx on public.automation_logs (workflow, logged_at desc);

-- ---------------------------------------------------------------------------
-- 6. updated_at tự cập nhật
-- ---------------------------------------------------------------------------
create trigger jobs_updated before update on public.jobs for each row execute function public.set_updated_at();
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger onboarding_templates_updated before update on public.onboarding_templates for each row execute function public.set_updated_at();
create trigger candidates_updated before update on public.candidates for each row execute function public.set_updated_at();
create trigger employees_updated before update on public.employees for each row execute function public.set_updated_at();
create trigger onboarding_tasks_updated before update on public.onboarding_tasks for each row execute function public.set_updated_at();
create trigger trainings_updated before update on public.trainings for each row execute function public.set_updated_at();
create trigger support_actions_updated before update on public.support_actions for each row execute function public.set_updated_at();
create trigger app_settings_updated before update on public.app_settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. VIEW: số liệu suy ra (không lưu bảng)
-- ---------------------------------------------------------------------------
-- Ứng viên kèm vị trí, nhãn trạng thái, kết quả AI mới nhất và buổi phỏng vấn gần nhất
create view public.v_candidates with (security_invoker = true) as
select c.*,
       j.title as job_title,
       s.label_vi as status_label,
       s.kanban_column,
       a.score,
       a.summary as ai_summary,
       a.skills_to_verify,
       a.interview_questions,
       a.analyzed_at,
       i.starts_at as interview_starts_at,
       i.ends_at as interview_ends_at,
       i.meet_url,
       i.status as interview_status
from public.candidates c
join public.jobs j on j.job_id = c.job_id
join public.candidate_statuses s on s.code = c.status
left join lateral (select * from public.cv_analyses x where x.candidate_id = c.candidate_id order by x.analyzed_at desc limit 1) a on true
left join lateral (select * from public.interviews y where y.candidate_id = c.candidate_id and y.status <> 'cancelled' order by y.starts_at desc limit 1) i on true;

-- Tiến độ onboarding từng nhân viên (thay cho cột Employees.Onboarding Status và Onboarding.Due Status)
create view public.v_employee_onboarding with (security_invoker = true) as
select e.employee_id,
       e.full_name,
       e.job_id,
       j.department,
       e.start_date,
       e.probation_end,
       e.is_sample,
       count(t.*)                                                           as tasks_total,
       count(t.*) filter (where t.status = 'done')                          as tasks_done,
       count(t.*) filter (where t.status = 'submitted')                     as tasks_submitted,
       count(t.*) filter (where t.status <> 'done' and t.due_date < current_date) as tasks_overdue,
       case
         when count(t.*) = 0 then 'not_started'
         when count(t.*) filter (where t.status = 'done') = count(t.*) then 'completed'
         when count(t.*) filter (where t.status <> 'not_started') = 0 then 'not_started'
         else 'in_progress'
       end                                                                   as onboarding_status
from public.employees e
join public.jobs j on j.job_id = e.job_id
left join public.onboarding_tasks t on t.employee_id = e.employee_id
group by e.employee_id, j.department;

-- Báo cáo tuần theo nhân viên (thay cho tab Reports)
create view public.v_weekly_reports with (security_invoker = true) as
select k.employee_id,
       e.full_name,
       k.period,
       k.metric,
       k.unit,
       k.target,
       k.actual,
       round(k.actual / k.target * 100, 1)                                         as kpi_rate_pct,
       (select round(avg(f.satisfaction), 1) from public.feedback f
         where f.employee_id = k.employee_id and f.period = k.period)               as satisfaction_avg,
       coalesce((select bool_or(f.support_requested) from public.feedback f
         where f.employee_id = k.employee_id and f.period = k.period), false)       as support_requested,
       (select count(*) from public.support_actions a
         where a.employee_id = k.employee_id and a.status in ('pending_approval', 'in_progress')) as open_actions,
       o.tasks_done                                                                 as onboarding_done,
       o.tasks_total                                                                as onboarding_total,
       e.is_sample
from public.kpi_records k
join public.employees e on e.employee_id = k.employee_id
join public.v_employee_onboarding o on o.employee_id = k.employee_id;

-- ROI đào tạo: chỉ tính khi có chi phí > 0 và đã nhập lợi ích
create view public.v_training_roi with (security_invoker = true) as
select t.training_id, t.employee_id, t.course_id, c.name as course_name, t.cost_vnd, t.benefit_vnd,
       case when t.cost_vnd > 0 and t.benefit_vnd is not null
            then round((t.benefit_vnd - t.cost_vnd) / t.cost_vnd * 100, 1) end as roi_pct
from public.trainings t
join public.courses c on c.course_id = t.course_id;

-- ---------------------------------------------------------------------------
-- 8. Bảo mật: bật RLS trên mọi bảng
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.courses enable row level security;
alter table public.onboarding_templates enable row level security;
alter table public.candidate_statuses enable row level security;
alter table public.candidates enable row level security;
alter table public.cv_analyses enable row level security;
alter table public.interviews enable row level security;
alter table public.candidate_events enable row level security;
alter table public.employees enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.trainings enable row level security;
alter table public.kpi_records enable row level security;
alter table public.feedback enable row level security;
alter table public.support_actions enable row level security;
alter table public.app_settings enable row level security;
alter table public.automation_logs enable row level security;

-- ---------------------------------------------------------------------------
-- 9. Link chờ của n8n và kiểm tra tài khoản HR
-- ---------------------------------------------------------------------------
-- WF1 (HR duyệt CV) và WF3 (HR duyệt hỗ trợ) đứng chờ ở form của n8n; link tiếp tục lưu ở đây để giao diện
-- gửi quyết định vào đúng lần chờ đó. Chỉ n8n (tài khoản postgres) đọc/ghi bảng này.
create table public.workflow_waits (
  wait_id           bigint generated always as identity primary key,
  kind              text not null check (kind in ('wf1_hr_review', 'wf3_hr_review')),
  entity_id         text not null,
  resume_url        text not null,
  n8n_execution_id  text,
  created_at        timestamptz not null default now(),
  consumed_at       timestamptz
);
create unique index workflow_waits_one_open on public.workflow_waits (kind, entity_id) where consumed_at is null;
comment on table public.workflow_waits is 'Link tiếp tục của execution n8n đang đứng chờ HR (WF1 duyệt CV, WF3 duyệt hỗ trợ). Giao diện duyệt thì n8n gửi vào link này, nên email và giao diện chạy cùng một nhánh.';
alter table public.workflow_waits enable row level security;

-- true khi email của phiên đăng nhập nằm trong app_settings.hr_accounts
create or replace function public.is_hr()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value ? lower(auth.jwt() ->> 'email') from public.app_settings s where s.key = 'hr_accounts'), false)
$$;

-- ---------------------------------------------------------------------------
-- 10. Quyền trên bảng: bỏ quyền mặc định của Supabase, chỉ mở quyền đọc cho tài khoản HR
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.jobs, public.job_skills, public.courses, public.onboarding_templates, public.candidate_statuses,
  public.candidates, public.cv_analyses, public.interviews, public.candidate_events,
  public.employees, public.onboarding_tasks, public.trainings,
  public.kpi_records, public.feedback, public.support_actions,
  public.app_settings, public.automation_logs,
  public.v_candidates, public.v_employee_onboarding, public.v_weekly_reports, public.v_training_roi
to authenticated;

-- HR: đọc tất cả (trừ khóa bí mật trong app_settings)
do $$
declare t text;
begin
  foreach t in array array['jobs', 'job_skills', 'courses', 'onboarding_templates', 'candidate_statuses',
    'candidates', 'cv_analyses', 'interviews', 'candidate_events', 'employees', 'onboarding_tasks', 'trainings',
    'kpi_records', 'feedback', 'support_actions', 'automation_logs']
  loop
    execute format('create policy hr_read on public.%I for select to authenticated using ((select public.is_hr()))', t);
  end loop;
end $$;
create policy hr_read on public.app_settings for select to authenticated
  using ((select public.is_hr()) and key <> all (array['link_secret', 'hr_accounts']));

-- ---------------------------------------------------------------------------
-- 11. Hàm ghi dành cho giao diện (việc chỉ đổi DB, không gửi email)
-- ---------------------------------------------------------------------------
create or replace function public.hr_guard()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_hr() then
    raise exception 'Tài khoản này không có quyền vào cổng HR.' using errcode = '42501';
  end if;
end $$;

-- Đánh dấu đã phỏng vấn: interview_scheduled → interviewed, buổi phỏng vấn chuyển completed
create or replace function public.hr_mark_interviewed(p_candidate_id text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  perform public.hr_guard();
  select status into v_status from public.candidates where candidate_id = p_candidate_id for update;
  if v_status is null then raise exception 'Không tìm thấy hồ sơ %.', p_candidate_id; end if;
  if v_status <> 'interview_scheduled' then
    raise exception 'Hồ sơ % đang ở trạng thái %, chưa đánh dấu đã phỏng vấn được.', p_candidate_id, v_status;
  end if;
  perform pg_catalog.set_config('app.actor', 'hr', true);
  update public.candidates
     set status = 'interviewed',
         hr_note = case when nullif(btrim(p_note), '') is null then hr_note else concat_ws(E'\n', hr_note, btrim(p_note)) end
   where candidate_id = p_candidate_id;
  update public.interviews set status = 'completed' where candidate_id = p_candidate_id and status = 'scheduled';
  return jsonb_build_object('candidate_id', p_candidate_id, 'status', 'interviewed');
end $$;

-- Mở lại hồ sơ đã đóng: rejected / withdrawn → on_hold (không gửi gì cho ứng viên)
create or replace function public.hr_reopen_candidate(p_candidate_id text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.candidates%rowtype;
begin
  perform public.hr_guard();
  select * into v from public.candidates where candidate_id = p_candidate_id for update;
  if v.candidate_id is null then raise exception 'Không tìm thấy hồ sơ %.', p_candidate_id; end if;
  if v.status not in ('rejected', 'withdrawn') then
    raise exception 'Chỉ mở lại được hồ sơ đã đóng (hồ sơ % đang ở trạng thái %).', p_candidate_id, v.status;
  end if;
  if exists (select 1 from public.candidates x where lower(x.email) = lower(v.email) and x.job_id = v.job_id
             and x.candidate_id <> v.candidate_id and x.status not in ('rejected', 'withdrawn')) then
    raise exception 'Ứng viên này đã có một hồ sơ khác đang xử lý cho cùng vị trí.';
  end if;
  perform pg_catalog.set_config('app.actor', 'hr', true);
  update public.candidates
     set status = 'on_hold',
         hr_note = case when nullif(btrim(p_note), '') is null then hr_note else concat_ws(E'\n', hr_note, btrim(p_note)) end
   where candidate_id = p_candidate_id;
  return jsonb_build_object('candidate_id', p_candidate_id, 'status', 'on_hold');
end $$;

-- Lưu cài đặt: chỉ các khóa trong danh sách, kiểm tra kiểu và khoảng giá trị
create or replace function public.hr_save_settings(p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k text; v jsonb; n numeric; saved text[] := '{}';
  int_keys jsonb := '{"priority_score":[0,100],"hr_review_hours":[1,168],"candidate_choice_hours":[1,168],
                      "interview_minutes":[15,180],"reminder_warn_days":[0,30],"reminder_cooldown_days":[0,30],
                      "blocked_cooldown_days":[0,30]}';
begin
  perform public.hr_guard();
  if jsonb_typeof(p_values) <> 'object' then raise exception 'Dữ liệu cài đặt không hợp lệ.'; end if;
  for k, v in select * from jsonb_each(p_values) loop
    if int_keys ? k then
      if jsonb_typeof(v) <> 'number' then raise exception 'Giá trị % phải là số.', k; end if;
      n := v::text::numeric;
      if n <> trunc(n) or n < (int_keys -> k ->> 0)::numeric or n > (int_keys -> k ->> 1)::numeric then
        raise exception 'Giá trị % phải là số nguyên từ % đến %.', k, int_keys -> k ->> 0, int_keys -> k ->> 1;
      end if;
    elsif k = 'hr_notify_email' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email nhận thông báo không hợp lệ.'; end if;
    elsif k = 'interview_slots' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) not between 1 and 12
         or exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string' or (e #>> '{}') !~ '^([01]\d|2[0-3]):[0-5]\d$') then
        raise exception 'Khung giờ phỏng vấn phải là 1–12 giờ dạng HH:MM.';
      end if;
      select jsonb_agg(distinct e order by e) into v from jsonb_array_elements(v) e;
    elsif k = 'interview_window_days' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) <> 2
         or jsonb_typeof(v -> 0) <> 'number' or jsonb_typeof(v -> 1) <> 'number'
         or (v ->> 0)::numeric < 1 or (v ->> 1)::numeric > 60 or (v ->> 0)::numeric > (v ->> 1)::numeric then
        raise exception 'Khoảng ngày đề xuất phải là [từ, đến] với 1 ≤ từ ≤ đến ≤ 60.';
      end if;
    elsif k in ('require_proof', 'training_ai') then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'Giá trị % phải là bật/tắt.', k; end if;
    else
      raise exception 'Không sửa được cài đặt "%" từ giao diện.', k;
    end if;
    update public.app_settings set value = v where key = k;
    if not found then raise exception 'Chưa có cài đặt "%".', k; end if;
    saved := saved || k;
  end loop;
  return jsonb_build_object('saved', to_jsonb(saved));
end $$;

-- Tạo hoặc sửa vị trí; kỹ năng (rubric AI) thay theo thứ tự truyền vào.
-- Vị trí mới có thể chép checklist onboarding từ một vị trí có sẵn.
create or replace function public.hr_save_job(
  p_job_id text, p_title text, p_department text, p_headcount integer, p_description text,
  p_hiring_manager text, p_skills text[], p_copy_templates_from text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id text; v_skills text[];
begin
  perform public.hr_guard();
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_department), '') is null then
    raise exception 'Cần nhập tên vị trí và phòng ban.';
  end if;
  if p_headcount is null or p_headcount < 1 then raise exception 'Số lượng cần tuyển phải từ 1.'; end if;
  select array_agg(s order by o) into v_skills
    from (select distinct on (lower(btrim(x))) btrim(x) as s, o from unnest(p_skills) with ordinality u(x, o)
          where nullif(btrim(x), '') is not null order by lower(btrim(x)), o) d;
  if coalesce(array_length(v_skills, 1), 0) < 2 or array_length(v_skills, 1) > 10 then
    raise exception 'Cần 2–10 kỹ năng để AI chấm CV.';
  end if;
  if p_job_id is null then
    insert into public.jobs (title, department, headcount, description, hiring_manager)
    values (btrim(p_title), btrim(p_department), p_headcount, nullif(btrim(p_description), ''), nullif(btrim(p_hiring_manager), ''))
    returning job_id into v_id;
    if p_copy_templates_from is not null then
      insert into public.onboarding_templates (job_id, task_name, category, owner_role, due_offset_days, course_id, required)
      select v_id, t.task_name, t.category, t.owner_role, t.due_offset_days, t.course_id, t.required
        from public.onboarding_templates t where t.job_id = p_copy_templates_from and t.status = 'active'
       order by t.due_offset_days, t.template_id;
    end if;
  else
    update public.jobs
       set title = btrim(p_title), department = btrim(p_department), headcount = p_headcount,
           description = nullif(btrim(p_description), ''), hiring_manager = nullif(btrim(p_hiring_manager), '')
     where job_id = p_job_id
    returning job_id into v_id;
    if v_id is null then raise exception 'Không tìm thấy vị trí %.', p_job_id; end if;
    delete from public.job_skills where job_id = v_id;
  end if;
  insert into public.job_skills (job_id, position, skill)
  select v_id, o, s from unnest(v_skills) with ordinality u(s, o);
  return jsonb_build_object('job_id', v_id, 'skills', to_jsonb(v_skills));
end $$;

create or replace function public.hr_set_job_status(p_job_id text, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.hr_guard();
  if p_status not in ('open', 'paused', 'closed') then raise exception 'Trạng thái vị trí không hợp lệ.'; end if;
  update public.jobs set status = p_status where job_id = p_job_id;
  if not found then raise exception 'Không tìm thấy vị trí %.', p_job_id; end if;
  return jsonb_build_object('job_id', p_job_id, 'status', p_status);
end $$;

-- Nhập hoặc sửa KPI (một chỉ tiêu / nhân viên / tuần)
create or replace function public.hr_save_kpi(
  p_employee_id text, p_period text, p_metric text, p_target numeric, p_actual numeric, p_unit text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  perform public.hr_guard();
  if nullif(btrim(p_metric), '') is null or nullif(btrim(p_unit), '') is null then raise exception 'Cần nhập tên chỉ tiêu và đơn vị.'; end if;
  if upper(btrim(coalesce(p_period, ''))) !~ '^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$' then raise exception 'Kỳ phải là tuần ISO, ví dụ 2026-W43.'; end if;
  if p_target is null or p_target <= 0 or p_actual is null or p_actual < 0 then raise exception 'Mục tiêu phải lớn hơn 0 và kết quả không âm.'; end if;
  insert into public.kpi_records (employee_id, period, metric, target, actual, unit, source)
  values (p_employee_id, upper(btrim(p_period)), btrim(p_metric), p_target, p_actual, btrim(p_unit), 'hr_portal')
  on conflict (employee_id, period, metric) do update
     set target = excluded.target, actual = excluded.actual, unit = excluded.unit, source = 'hr_portal', recorded_on = current_date
  returning kpi_id into v_id;
  return jsonb_build_object('kpi_id', v_id);
end $$;

create or replace function public.hr_delete_kpi(p_kpi_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.hr_guard();
  delete from public.kpi_records where kpi_id = p_kpi_id;
  if not found then raise exception 'Không tìm thấy dòng KPI %.', p_kpi_id; end if;
  return jsonb_build_object('deleted', p_kpi_id);
end $$;

-- Cập nhật tiến độ việc hỗ trợ (WF3 tạo ở trạng thái in_progress)
create or replace function public.hr_set_action_status(p_action_id text, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.hr_guard();
  if p_status not in ('in_progress', 'done', 'cancelled') then raise exception 'Trạng thái việc hỗ trợ không hợp lệ.'; end if;
  update public.support_actions
     set status = p_status,
         completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
         note = case when nullif(btrim(p_note), '') is null then note else concat_ws(E'\n', note, btrim(p_note)) end
   where action_id = p_action_id;
  if not found then raise exception 'Không tìm thấy việc hỗ trợ %.', p_action_id; end if;
  return jsonb_build_object('action_id', p_action_id, 'status', p_status);
end $$;

-- Checklist onboarding mẫu của từng vị trí (WF2 dựa vào đây để tạo đầu việc cho nhân viên mới)
create or replace function public.hr_save_template(
  p_template_id text, p_job_id text, p_task_name text, p_category text, p_owner_role text,
  p_due_offset_days integer, p_course_id text default null, p_required boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  perform public.hr_guard();
  if nullif(btrim(p_task_name), '') is null then raise exception 'Cần nhập tên đầu việc.'; end if;
  if p_category not in ('paperwork', 'access', 'social', 'training', 'practice', 'review') then raise exception 'Nhóm đầu việc không hợp lệ.'; end if;
  if p_owner_role not in ('hr', 'it', 'employee', 'buddy', 'manager') then raise exception 'Người phụ trách không hợp lệ.'; end if;
  if p_due_offset_days is null or p_due_offset_days not between -30 and 365 then raise exception 'Hạn phải từ -30 đến 365 ngày so với ngày bắt đầu.'; end if;
  if p_course_id is not null and not exists (select 1 from public.courses c where c.course_id = p_course_id and c.status = 'active') then
    raise exception 'Khoá học % không tồn tại hoặc đã ngừng.', p_course_id;
  end if;
  if p_template_id is null then
    if not exists (select 1 from public.jobs j where j.job_id = p_job_id) then raise exception 'Không tìm thấy vị trí %.', p_job_id; end if;
    insert into public.onboarding_templates (job_id, task_name, category, owner_role, due_offset_days, course_id, required)
    values (p_job_id, btrim(p_task_name), p_category, p_owner_role, p_due_offset_days, p_course_id, coalesce(p_required, true))
    returning template_id into v_id;
  else
    update public.onboarding_templates
       set task_name = btrim(p_task_name), category = p_category, owner_role = p_owner_role,
           due_offset_days = p_due_offset_days, course_id = p_course_id, required = coalesce(p_required, true), status = 'active'
     where template_id = p_template_id
    returning template_id into v_id;
    if v_id is null then raise exception 'Không tìm thấy đầu việc mẫu %.', p_template_id; end if;
  end if;
  return jsonb_build_object('template_id', v_id);
end $$;

-- Ngừng dùng một đầu việc mẫu (không xoá, để các đầu việc đã giao vẫn giữ nguồn gốc)
create or replace function public.hr_retire_template(p_template_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.hr_guard();
  update public.onboarding_templates set status = 'retired' where template_id = p_template_id;
  if not found then raise exception 'Không tìm thấy đầu việc mẫu %.', p_template_id; end if;
  return jsonb_build_object('template_id', p_template_id, 'status', 'retired');
end $$;

-- Chỉ tài khoản đã đăng nhập gọi được các hàm này (trong hàm còn kiểm tra is_hr)
revoke execute on function public.is_hr(), public.hr_guard(),
  public.hr_mark_interviewed(text, text), public.hr_reopen_candidate(text, text), public.hr_save_settings(jsonb),
  public.hr_save_job(text, text, text, integer, text, text, text[], text), public.hr_set_job_status(text, text),
  public.hr_save_kpi(text, text, text, numeric, numeric, text), public.hr_delete_kpi(bigint),
  public.hr_set_action_status(text, text, text),
  public.hr_save_template(text, text, text, text, text, integer, text, boolean), public.hr_retire_template(text)
from public, anon;
grant execute on function public.is_hr(),
  public.hr_mark_interviewed(text, text), public.hr_reopen_candidate(text, text), public.hr_save_settings(jsonb),
  public.hr_save_job(text, text, text, integer, text, text, text[], text), public.hr_set_job_status(text, text),
  public.hr_save_kpi(text, text, text, numeric, numeric, text), public.hr_delete_kpi(bigint),
  public.hr_set_action_status(text, text, text),
  public.hr_save_template(text, text, text, text, text, integer, text, boolean), public.hr_retire_template(text)
to authenticated;
revoke execute on function public.hr_guard() from authenticated;

-- ---------------------------------------------------------------------------
-- 12. Tự cập nhật giao diện (Supabase Realtime, vẫn tuân theo quy tắc đọc ở trên)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.candidates, public.cv_analyses, public.interviews, public.candidate_events,
  public.employees, public.onboarding_tasks, public.trainings,
  public.kpi_records, public.feedback, public.support_actions,
  public.jobs, public.automation_logs;
