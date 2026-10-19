-- ============================================================================
-- ABC TECH - HR AUTOMATION LAB (POSTGRESQL SCHEMA)
-- ============================================================================

-- Xóa các bảng cũ nếu cần chạy lại từ đầu (theo thứ tự ngược lại của khóa ngoại)
DROP VIEW IF EXISTS vw_dashboard_summary;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS kpi CASCADE;
DROP TABLE IF EXISTS training CASCADE;
DROP TABLE IF EXISTS onboarding CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS onboarding_templates CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- ============================================================================
-- NHÓM 1: MASTER DATA (DỮ LIỆU DANH MỤC GỐC)
-- ============================================================================

-- 1. Bảng Jobs (Vị trí tuyển dụng)
CREATE TABLE jobs (
    job_id VARCHAR(50) PRIMARY KEY,              -- VD: JOB-001
    job_title VARCHAR(255) NOT NULL,             -- VD: IT Helpdesk
    department VARCHAR(100) NOT NULL,            -- VD: IT Support, Engineering
    headcount INTEGER DEFAULT 1,
    job_description TEXT,
    required_skills TEXT,
    hiring_manager VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open',           -- open, closed, draft
    posted_at DATE DEFAULT CURRENT_DATE
);

-- 2. Bảng Courses (Danh mục khóa học nội bộ)
CREATE TABLE courses (
    course_id VARCHAR(50) PRIMARY KEY,           -- VD: CRS-001
    course_name VARCHAR(255) NOT NULL,
    skill VARCHAR(255),
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE SET NULL, -- Có thể NULL với khóa học chung toàn công ty
    duration_hours NUMERIC(5, 2) DEFAULT 0,
    cost_vnd NUMERIC(15, 2) DEFAULT 0,           -- Lưu dạng số (VD: 500000) để dễ tính tổng
    material_url TEXT,
    validity_days INTEGER DEFAULT 0,             -- 0 nếu vô thời hạn, 365 nếu có hạn 1 năm
    status VARCHAR(50) DEFAULT 'active',         -- active, inactive
    level VARCHAR(50) DEFAULT 'basic',           -- basic, intermediate, advanced
    prerequisite_course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE SET NULL
);

-- 3. Bảng OnboardingTemplates (Khung chương trình Onboarding chuẩn theo Job)
CREATE TABLE onboarding_templates (
    template_id VARCHAR(50) PRIMARY KEY,         -- VD: TPL-001
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),                       -- paperwork, access, training
    due_offset_days INTEGER DEFAULT 0,           -- Số ngày cộng thêm từ start_date
    owner_role VARCHAR(100),                     -- HR, IT, Employee, Buddy
    course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE SET NULL,
    required BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'active'          -- active, retired
);

-- ============================================================================
-- NHÓM 2: CORE ENTITIES (ỨNG VIÊN & NHÂN VIÊN)
-- ============================================================================

-- 4. Bảng Candidates (Hồ sơ ứng viên - WF1_Recruitment)
CREATE TABLE candidates (
    candidate_id VARCHAR(50) PRIMARY KEY,        -- VD: CAN-001, CAN-44, CAN-V3-54
    full_name VARCHAR(255) NOT NULL,
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE SET NULL,
    hr_decision VARCHAR(50),                     -- hire, interview, reject
    status VARCHAR(50) DEFAULT 'applied',        -- applied, interview_scheduled, hired, rejected
    email VARCHAR(255),
    phone VARCHAR(50),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cv_url TEXT,
    interview_start TIMESTAMP WITH TIME ZONE,
    meet_url TEXT,
    ai_score VARCHAR(50),                        -- Cột "AI tính điểm" (VD: "40 / 100")
    ai_summary TEXT,
    skills_to_verify TEXT,
    review_notes TEXT,
    hired_date TIMESTAMP WITH TIME ZONE,
    cv_text TEXT,
    calendar_event_id VARCHAR(255),
    onboarding_started BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source_type VARCHAR(100),                    -- synthetic_demo, application_form
    cv_source VARCHAR(255),                      -- Google Drive, ...
    cv_email VARCHAR(255),                       -- Email trích xuất từ trong CV
    declared_role VARCHAR(255),
    cover_letter TEXT,
    consent_at TIMESTAMP WITH TIME ZONE,
    hr_reviewed_at TIMESTAMP WITH TIME ZONE,
    interview_end TIMESTAMP WITH TIME ZONE,
    processing_execution_id VARCHAR(100)
);

-- 5. Bảng Employees (Nhân viên chính thức/thử việc - WF2_Onboarding)
CREATE TABLE employees (
    employee_id VARCHAR(50) PRIMARY KEY,         -- VD: EMP-001
    candidate_id VARCHAR(50) UNIQUE REFERENCES candidates(candidate_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE SET NULL,
    department VARCHAR(100),
    start_date DATE,
    manager VARCHAR(255),
    buddy VARCHAR(255),
    employment_status VARCHAR(50) DEFAULT 'probation',     -- probation, official, resigned
    onboarding_status VARCHAR(50) DEFAULT 'not_started',   -- not_started, in_progress, completed
    tools_access_status VARCHAR(50) DEFAULT 'pending'      -- pending, confirmed
);

-- ============================================================================
-- NHÓM 3: OPERATIONAL DATA (ONBOARDING, ĐÀO TẠO & HIỆU SUẤT)
-- ============================================================================

-- 6. Bảng Onboarding (Checklist đầu việc hội nhập của từng nhân viên)
CREATE TABLE onboarding (
    task_id VARCHAR(50) PRIMARY KEY,             -- VD: OB-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    template_id VARCHAR(50) REFERENCES onboarding_templates(template_id) ON DELETE SET NULL,
    task_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),                       -- paperwork, access, training
    owner_role VARCHAR(100),                     -- HR, IT, Employee, Buddy
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending',        -- pending, in_progress, done
    completed_at DATE,
    course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE SET NULL,
    note TEXT,
    due_status VARCHAR(100),                     -- Đã xong, Quá hạn, Đang chờ...
    reported_at TIMESTAMP WITH TIME ZONE,
    hr_review VARCHAR(100),
    hr_note TEXT,
    proof_url TEXT
);

-- 7. Bảng Training (Theo dõi quá trình đào tạo & ROI của nhân viên)
CREATE TABLE training (
    training_id VARCHAR(50) PRIMARY KEY,         -- VD: TRN-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE CASCADE,
    assigned_date DATE,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'in_progress',    -- in_progress, completed
    completed_date DATE,
    certificate_expiry DATE,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    cost_vnd NUMERIC(15, 2) DEFAULT 0,
    benefit_vnd NUMERIC(15, 2),
    roi NUMERIC(6, 2),                           -- Lưu phần trăm (VD: 60.00 ứng với 60%)
    note TEXT,
    pre_score NUMERIC(5, 2),
    post_score NUMERIC(5, 2)
);

-- 8. Bảng KPI (Chỉ số hiệu suất tuần - WF3_Performance)
CREATE TABLE kpi (
    kpi_id VARCHAR(50) PRIMARY KEY,              -- VD: KPI-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL,                 -- VD: 2026-W39, 2026-W40
    metric_name VARCHAR(100) NOT NULL,           -- helpdesk_tickets_resolved, accepted_dev_tasks...
    target NUMERIC(10, 2) NOT NULL,
    actual NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(50),                            -- ticket, accepted_task, maintenance_check
    source TEXT,
    updated_at DATE DEFAULT CURRENT_DATE,
    record_key VARCHAR(100) UNIQUE               -- VD: EMP-001|2026-W39 (Dùng để UPSERT trong n8n rất tiện)
);

-- 9. Bảng Feedback (Phản hồi của nhân viên theo kỳ)
CREATE TABLE feedback (
    feedback_id VARCHAR(50) PRIMARY KEY,         -- VD: FB-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL,                 -- VD: 2026-W39
    submitted_at DATE DEFAULT CURRENT_DATE,
    satisfaction NUMERIC(3, 1),                  -- Điểm hài lòng (1.0 - 5.0)
    feedback_text TEXT,
    support_requested BOOLEAN DEFAULT FALSE,
    topic VARCHAR(100),                          -- training, tools, workload...
    ai_summary TEXT,
    suggested_action TEXT,
    status VARCHAR(50) DEFAULT 'pending'         -- pending, reviewed, action_open
);

-- 10. Bảng Actions (Hành động xử lý phát sinh từ Feedback)
CREATE TABLE actions (
    action_id VARCHAR(50) PRIMARY KEY,           -- VD: ACT-001, ACT-DEMO-29
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    feedback_id VARCHAR(50) REFERENCES feedback(feedback_id) ON DELETE SET NULL,
    action_title TEXT NOT NULL,
    owner_role VARCHAR(100),                     -- IT, Manager, Buddy, HR
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending_approval', -- pending_approval, in_progress, done
    hr_approved BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    note TEXT
);

-- 11. Bảng Reports (Báo cáo tổng hợp theo nhân viên và kỳ đánh giá)
CREATE TABLE reports (
    report_id VARCHAR(50) PRIMARY KEY,           -- VD: RPT-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    period VARCHAR(20) NOT NULL,                 -- VD: 2026-W39
    target NUMERIC(10, 2),
    actual NUMERIC(10, 2),
    kpi_rate NUMERIC(5, 2),                      -- VD: 84.00 (ứng với 84%)
    onboarding_total INTEGER DEFAULT 0,
    onboarding_done INTEGER DEFAULT 0,
    onboarding_rate NUMERIC(5, 2),               -- VD: 100.00 (ứng với 100%)
    satisfaction NUMERIC(3, 1),
    support_requested BOOLEAN DEFAULT FALSE,
    open_actions INTEGER DEFAULT 0,
    kpi_data_status VARCHAR(50) DEFAULT 'ok',
    metric_name VARCHAR(100),
    unit VARCHAR(50),
    UNIQUE (employee_id, period)                 -- Chống trùng lặp báo cáo của cùng 1 người trong 1 tuần
);

-- ============================================================================
-- NHÓM 4: SYSTEM LOGS & VIEWS
-- ============================================================================

-- 12. Bảng Logs (Nhật ký chạy n8n)
CREATE TABLE logs (
    log_id VARCHAR(50) PRIMARY KEY,              -- VD: LOG-001 (Hoặc có thể đổi sang SERIAL nếu muốn tự tăng)
    workflow VARCHAR(100) NOT NULL,              -- WF1_Recruitment, WF2_Onboarding, WF3_Performance
    entity_id VARCHAR(50),                       -- CAN-004, EMP-002...
    event VARCHAR(100),                          -- cv_review_pending, extract_cv, check_access...
    status VARCHAR(50),                          -- sample, success, error
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_id VARCHAR(100),
    message TEXT
);

-- 13. View hỗ trợ tính nhanh số liệu cho tab Dashboard
CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM candidates) AS total_candidates,
    (SELECT COUNT(*) FROM employees) AS total_employees,
    ROUND(
        COALESCE(
            (SELECT COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / NULLIF(COUNT(*), 0) * 100 FROM onboarding), 
            0
        ), 1
    ) AS onboarding_completion_rate;

-- ============================================================================
-- INDEXES (TỐI ƯU TỐC ĐỘ TRUY VẤN CHO N8N)
-- ============================================================================
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_job_id ON candidates(job_id);
CREATE INDEX idx_employees_job_id ON employees(job_id);
CREATE INDEX idx_onboarding_emp_status ON onboarding(employee_id, status);
CREATE INDEX idx_kpi_emp_period ON kpi(employee_id, period);
CREATE INDEX idx_feedback_emp_period ON feedback(employee_id, period);
CREATE INDEX idx_actions_emp_status ON actions(employee_id, status);
CREATE INDEX idx_logs_workflow ON logs(workflow);-- ============================================================================
-- ABC TECH - HR AUTOMATION LAB (POSTGRESQL SCHEMA)
-- ============================================================================

-- Xóa các bảng cũ nếu cần chạy lại từ đầu (theo thứ tự ngược lại của khóa ngoại)
DROP VIEW IF EXISTS vw_dashboard_summary;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS actions CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS kpi CASCADE;
DROP TABLE IF EXISTS training CASCADE;
DROP TABLE IF EXISTS onboarding CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS onboarding_templates CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- ============================================================================
-- NHÓM 1: MASTER DATA (DỮ LIỆU DANH MỤC GỐC)
-- ============================================================================

-- 1. Bảng Jobs (Vị trí tuyển dụng)
CREATE TABLE jobs (
    job_id VARCHAR(50) PRIMARY KEY,              -- VD: JOB-001
    job_title VARCHAR(255) NOT NULL,             -- VD: IT Helpdesk
    department VARCHAR(100) NOT NULL,            -- VD: IT Support, Engineering
    headcount INTEGER DEFAULT 1,
    job_description TEXT,
    required_skills TEXT,
    hiring_manager VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open',           -- open, closed, draft
    posted_at DATE DEFAULT CURRENT_DATE
);

-- 2. Bảng Courses (Danh mục khóa học nội bộ)
CREATE TABLE courses (
    course_id VARCHAR(50) PRIMARY KEY,           -- VD: CRS-001
    course_name VARCHAR(255) NOT NULL,
    skill VARCHAR(255),
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE SET NULL, -- Có thể NULL với khóa học chung toàn công ty
    duration_hours NUMERIC(5, 2) DEFAULT 0,
    cost_vnd NUMERIC(15, 2) DEFAULT 0,           -- Lưu dạng số (VD: 500000) để dễ tính tổng
    material_url TEXT,
    validity_days INTEGER DEFAULT 0,             -- 0 nếu vô thời hạn, 365 nếu có hạn 1 năm
    status VARCHAR(50) DEFAULT 'active',         -- active, inactive
    level VARCHAR(50) DEFAULT 'basic',           -- basic, intermediate, advanced
    prerequisite_course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE SET NULL
);

-- 3. Bảng OnboardingTemplates (Khung chương trình Onboarding chuẩn theo Job)
CREATE TABLE onboarding_templates (
    template_id VARCHAR(50) PRIMARY KEY,         -- VD: TPL-001
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),                       -- paperwork, access, training
    due_offset_days INTEGER DEFAULT 0,           -- Số ngày cộng thêm từ start_date
    owner_role VARCHAR(100),                     -- HR, IT, Employee, Buddy
    course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE SET NULL,
    required BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'active'          -- active, retired
);

-- ============================================================================
-- NHÓM 2: CORE ENTITIES (ỨNG VIÊN & NHÂN VIÊN)
-- ============================================================================

-- 4. Bảng Candidates (Hồ sơ ứng viên - WF1_Recruitment)
CREATE TABLE candidates (
    candidate_id VARCHAR(50) PRIMARY KEY,        -- VD: CAN-001, CAN-44, CAN-V3-54
    full_name VARCHAR(255) NOT NULL,
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE SET NULL,
    hr_decision VARCHAR(50),                     -- hire, interview, reject
    status VARCHAR(50) DEFAULT 'applied',        -- applied, interview_scheduled, hired, rejected
    email VARCHAR(255),
    phone VARCHAR(50),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cv_url TEXT,
    interview_start TIMESTAMP WITH TIME ZONE,
    meet_url TEXT,
    ai_score VARCHAR(50),                        -- Cột "AI tính điểm" (VD: "40 / 100")
    ai_summary TEXT,
    skills_to_verify TEXT,
    review_notes TEXT,
    hired_date TIMESTAMP WITH TIME ZONE,
    cv_text TEXT,
    calendar_event_id VARCHAR(255),
    onboarding_started BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source_type VARCHAR(100),                    -- synthetic_demo, application_form
    cv_source VARCHAR(255),                      -- Google Drive, ...
    cv_email VARCHAR(255),                       -- Email trích xuất từ trong CV
    declared_role VARCHAR(255),
    cover_letter TEXT,
    consent_at TIMESTAMP WITH TIME ZONE,
    hr_reviewed_at TIMESTAMP WITH TIME ZONE,
    interview_end TIMESTAMP WITH TIME ZONE,
    processing_execution_id VARCHAR(100)
);

-- 5. Bảng Employees (Nhân viên chính thức/thử việc - WF2_Onboarding)
CREATE TABLE employees (
    employee_id VARCHAR(50) PRIMARY KEY,         -- VD: EMP-001
    candidate_id VARCHAR(50) UNIQUE REFERENCES candidates(candidate_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    job_id VARCHAR(50) REFERENCES jobs(job_id) ON DELETE SET NULL,
    department VARCHAR(100),
    start_date DATE,
    manager VARCHAR(255),
    buddy VARCHAR(255),
    employment_status VARCHAR(50) DEFAULT 'probation',     -- probation, official, resigned
    onboarding_status VARCHAR(50) DEFAULT 'not_started',   -- not_started, in_progress, completed
    tools_access_status VARCHAR(50) DEFAULT 'pending'      -- pending, confirmed
);

-- ============================================================================
-- NHÓM 3: OPERATIONAL DATA (ONBOARDING, ĐÀO TẠO & HIỆU SUẤT)
-- ============================================================================

-- 6. Bảng Onboarding (Checklist đầu việc hội nhập của từng nhân viên)
CREATE TABLE onboarding (
    task_id VARCHAR(50) PRIMARY KEY,             -- VD: OB-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    template_id VARCHAR(50) REFERENCES onboarding_templates(template_id) ON DELETE SET NULL,
    task_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),                       -- paperwork, access, training
    owner_role VARCHAR(100),                     -- HR, IT, Employee, Buddy
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending',        -- pending, in_progress, done
    completed_at DATE,
    course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE SET NULL,
    note TEXT,
    due_status VARCHAR(100),                     -- Đã xong, Quá hạn, Đang chờ...
    reported_at TIMESTAMP WITH TIME ZONE,
    hr_review VARCHAR(100),
    hr_note TEXT,
    proof_url TEXT
);

-- 7. Bảng Training (Theo dõi quá trình đào tạo & ROI của nhân viên)
CREATE TABLE training (
    training_id VARCHAR(50) PRIMARY KEY,         -- VD: TRN-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    course_id VARCHAR(50) REFERENCES courses(course_id) ON DELETE CASCADE,
    assigned_date DATE,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'in_progress',    -- in_progress, completed
    completed_date DATE,
    certificate_expiry DATE,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    cost_vnd NUMERIC(15, 2) DEFAULT 0,
    benefit_vnd NUMERIC(15, 2),
    roi NUMERIC(6, 2),                           -- Lưu phần trăm (VD: 60.00 ứng với 60%)
    note TEXT,
    pre_score NUMERIC(5, 2),
    post_score NUMERIC(5, 2)
);

-- 8. Bảng KPI (Chỉ số hiệu suất tuần - WF3_Performance)
CREATE TABLE kpi (
    kpi_id VARCHAR(50) PRIMARY KEY,              -- VD: KPI-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL,                 -- VD: 2026-W39, 2026-W40
    metric_name VARCHAR(100) NOT NULL,           -- helpdesk_tickets_resolved, accepted_dev_tasks...
    target NUMERIC(10, 2) NOT NULL,
    actual NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(50),                            -- ticket, accepted_task, maintenance_check
    source TEXT,
    updated_at DATE DEFAULT CURRENT_DATE,
    record_key VARCHAR(100) UNIQUE               -- VD: EMP-001|2026-W39 (Dùng để UPSERT trong n8n rất tiện)
);

-- 9. Bảng Feedback (Phản hồi của nhân viên theo kỳ)
CREATE TABLE feedback (
    feedback_id VARCHAR(50) PRIMARY KEY,         -- VD: FB-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL,                 -- VD: 2026-W39
    submitted_at DATE DEFAULT CURRENT_DATE,
    satisfaction NUMERIC(3, 1),                  -- Điểm hài lòng (1.0 - 5.0)
    feedback_text TEXT,
    support_requested BOOLEAN DEFAULT FALSE,
    topic VARCHAR(100),                          -- training, tools, workload...
    ai_summary TEXT,
    suggested_action TEXT,
    status VARCHAR(50) DEFAULT 'pending'         -- pending, reviewed, action_open
);

-- 10. Bảng Actions (Hành động xử lý phát sinh từ Feedback)
CREATE TABLE actions (
    action_id VARCHAR(50) PRIMARY KEY,           -- VD: ACT-001, ACT-DEMO-29
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    feedback_id VARCHAR(50) REFERENCES feedback(feedback_id) ON DELETE SET NULL,
    action_title TEXT NOT NULL,
    owner_role VARCHAR(100),                     -- IT, Manager, Buddy, HR
    due_date DATE,
    status VARCHAR(50) DEFAULT 'pending_approval', -- pending_approval, in_progress, done
    hr_approved BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    note TEXT
);

-- 11. Bảng Reports (Báo cáo tổng hợp theo nhân viên và kỳ đánh giá)
CREATE TABLE reports (
    report_id VARCHAR(50) PRIMARY KEY,           -- VD: RPT-001
    employee_id VARCHAR(50) REFERENCES employees(employee_id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    period VARCHAR(20) NOT NULL,                 -- VD: 2026-W39
    target NUMERIC(10, 2),
    actual NUMERIC(10, 2),
    kpi_rate NUMERIC(5, 2),                      -- VD: 84.00 (ứng với 84%)
    onboarding_total INTEGER DEFAULT 0,
    onboarding_done INTEGER DEFAULT 0,
    onboarding_rate NUMERIC(5, 2),               -- VD: 100.00 (ứng với 100%)
    satisfaction NUMERIC(3, 1),
    support_requested BOOLEAN DEFAULT FALSE,
    open_actions INTEGER DEFAULT 0,
    kpi_data_status VARCHAR(50) DEFAULT 'ok',
    metric_name VARCHAR(100),
    unit VARCHAR(50),
    UNIQUE (employee_id, period)                 -- Chống trùng lặp báo cáo của cùng 1 người trong 1 tuần
);

-- ============================================================================
-- NHÓM 4: SYSTEM LOGS & VIEWS
-- ============================================================================

-- 12. Bảng Logs (Nhật ký chạy n8n)
CREATE TABLE logs (
    log_id VARCHAR(50) PRIMARY KEY,              -- VD: LOG-001 (Hoặc có thể đổi sang SERIAL nếu muốn tự tăng)
    workflow VARCHAR(100) NOT NULL,              -- WF1_Recruitment, WF2_Onboarding, WF3_Performance
    entity_id VARCHAR(50),                       -- CAN-004, EMP-002...
    event VARCHAR(100),                          -- cv_review_pending, extract_cv, check_access...
    status VARCHAR(50),                          -- sample, success, error
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_id VARCHAR(100),
    message TEXT
);

-- 13. View hỗ trợ tính nhanh số liệu cho tab Dashboard
CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM candidates) AS total_candidates,
    (SELECT COUNT(*) FROM employees) AS total_employees,
    ROUND(
        COALESCE(
            (SELECT COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / NULLIF(COUNT(*), 0) * 100 FROM onboarding), 
            0
        ), 1
    ) AS onboarding_completion_rate;

-- ============================================================================
-- INDEXES (TỐI ƯU TỐC ĐỘ TRUY VẤN CHO N8N)
-- ============================================================================
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_job_id ON candidates(job_id);
CREATE INDEX idx_employees_job_id ON employees(job_id);
CREATE INDEX idx_onboarding_emp_status ON onboarding(employee_id, status);
CREATE INDEX idx_kpi_emp_period ON kpi(employee_id, period);
CREATE INDEX idx_feedback_emp_period ON feedback(employee_id, period);
CREATE INDEX idx_actions_emp_status ON actions(employee_id, status);
CREATE INDEX idx_logs_workflow ON logs(workflow);