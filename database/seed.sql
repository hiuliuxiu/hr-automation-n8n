-- ============================================================================
-- ABC TECH · HR AUTOMATION — DỮ LIỆU BAN ĐẦU
-- Chạy một lần sau schema.sql. Gồm ba phần:
--   1. Cài đặt quy trình (app_settings) mà ba workflow n8n và giao diện HR đọc.
--   2. Danh mục: vị trí tuyển dụng, kỹ năng AI dùng để chấm CV, khoá học, checklist onboarding mẫu.
--   3. Dữ liệu demo: ứng viên ở đủ các bước, nhân viên đang onboarding, KPI, phản hồi, việc hỗ trợ.
--      Toàn bộ là dữ liệu giả (is_sample = true, email @example.com). Mốc thời gian tính theo lúc chạy file,
--      nên hạn duyệt và lịch hẹn trên giao diện luôn gần với hiện tại. Không cần demo thì xoá phần 3.
-- Trước khi dùng thật: đổi hr_accounts, hr_notify_email, demo_email, webhook_base và link_secret ở phần 1.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Cài đặt quy trình. Chạy lại thì giữ giá trị đang có.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description) values
  ('hr_accounts', '["whateverholding246@gmail.com"]', 'Email các tài khoản Supabase Auth được vào cổng HR (chữ thường)'),
  ('hr_notify_email', '"whateverholding246@gmail.com"', 'Email HR nhận hồ sơ mới, nhắc quá hạn và cảnh báo lỗi'),
  ('demo_email', '"whateverholding246@gmail.com"', 'Hộp thư nhận mọi thư của WF2 khi wf2_send_to_real_email = false'),
  ('webhook_base', '"https://huylg.app.n8n.cloud/webhook"', 'Địa chỉ webhook production của n8n, không có / ở cuối. WF2 dùng để dựng nút Báo cáo / Duyệt trong email'),
  ('link_secret', '"abctech-DLxnGmSuPZ_n-Fl--ZK0cqAx"', 'Chuỗi ký link trong email WF2. Đổi chuỗi này thì mọi nút trong email cũ hết hiệu lực'),
  ('priority_score', '70', 'Từ điểm này AI đánh dấu nên ưu tiên xem'),
  ('hr_review_hours', '72', 'Thời gian chờ HR duyệt trước khi chuyển hr_overdue'),
  ('candidate_choice_hours', '24', 'Thời gian ứng viên chọn giờ phỏng vấn'),
  ('interview_slots', '["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]', 'Giờ bắt đầu được đề xuất, thứ Hai đến thứ Sáu'),
  ('interview_minutes', '45', 'Thời lượng mỗi buổi phỏng vấn'),
  ('interview_window_days', '[2, 15]', 'Đề xuất khung giờ trong khoảng ngày này kể từ hôm nay'),
  ('reminder_time', '"08:30"', 'Giờ WF2 quét tiến độ và gửi nhắc việc'),
  ('reminder_warn_days', '3', 'WF2: nhắc trước hạn bao nhiêu ngày (ngoài việc đã quá hạn)'),
  ('reminder_cooldown_days', '2', 'WF2: số ngày chờ trước khi nhắc lại cùng một đầu việc'),
  ('blocked_cooldown_days', '3', 'WF2: số ngày chờ trước khi nhắc lại việc đang vướng'),
  ('probation_days', '90', 'Độ dài thử việc'),
  ('require_proof', 'true', 'WF2: báo Đã hoàn thành thì bắt buộc nộp tệp hoặc link'),
  ('training_ai', 'true', 'WF2: dùng AI gợi ý thêm tối đa 2 khoá học khi tạo lộ trình đào tạo'),
  ('proof_drive_folder_id', '"root"', 'WF2: thư mục Google Drive hứng tệp nhân viên nộp (root = My Drive)'),
  ('wf2_dry_run', 'false', 'WF2: true = chạy thử, không gửi email nào'),
  ('wf2_send_to_real_email', 'true', 'WF2: true = gửi đúng email nhân viên; false = dồn mọi thư về demo_email')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Danh mục
-- ---------------------------------------------------------------------------
insert into public.jobs (job_id, title, department, headcount, description, hiring_manager, status, posted_on) values
  ('JOB-001', 'IT Helpdesk', 'IT Support', 2, 'Tiếp nhận ticket; chẩn đoán sự cố máy tính, phần mềm và kết nối mạng; cấp phát thiết bị; viết hướng dẫn người dùng.', 'IT Support Lead', 'open', current_date - 50),
  ('JOB-002', 'Web / Front-end Developer', 'Engineering', 2, 'Phát triển giao diện web; kết nối API; sửa lỗi; kiểm thử đa trình duyệt; tham gia review code và quản lý mã nguồn.', 'Engineering Lead', 'open', current_date - 40),
  ('JOB-003', 'Kỹ sư Hạ tầng & Mạng', 'Infrastructure', 2, 'Bảo trì máy tính và thiết bị mạng; giám sát hạ tầng; xử lý sự cố; thực hiện checklist sao lưu và ghi chép vận hành.', 'Infrastructure Lead', 'open', current_date - 38),
  ('JOB-004', 'IT Manager', 'IT Management', 1, 'Lập kế hoạch dự án CNTT; quản lý đội ngũ, ngân sách và nhà cung cấp; phối hợp với các phòng ban; theo dõi tiến độ và rủi ro.', 'CTO', 'open', current_date - 18);

-- Kỹ năng theo thứ tự: AI chấm CV theo đúng danh sách này, mỗi kỹ năng một phần điểm bằng nhau
insert into public.job_skills (job_id, position, skill) values
  ('JOB-001', 1, 'Windows'),
  ('JOB-001', 2, 'Phần cứng/phần mềm'),
  ('JOB-001', 3, 'Mạng LAN'),
  ('JOB-001', 4, 'Xử lý ticket'),
  ('JOB-001', 5, 'Giao tiếp hỗ trợ'),
  ('JOB-002', 1, 'HTML'),
  ('JOB-002', 2, 'CSS'),
  ('JOB-002', 3, 'JavaScript'),
  ('JOB-002', 4, 'Git'),
  ('JOB-002', 5, 'Tích hợp API'),
  ('JOB-002', 6, 'Kiểm thử giao diện'),
  ('JOB-003', 1, 'Mạng máy tính'),
  ('JOB-003', 2, 'Phần cứng'),
  ('JOB-003', 3, 'Giám sát'),
  ('JOB-003', 4, 'Xử lý sự cố'),
  ('JOB-003', 5, 'Tài liệu vận hành'),
  ('JOB-004', 1, 'Quản lý dự án'),
  ('JOB-004', 2, 'SDLC'),
  ('JOB-004', 3, 'Lập ngân sách'),
  ('JOB-004', 4, 'Quản lý nhóm'),
  ('JOB-004', 5, 'API và hạ tầng');

insert into public.courses (course_id, name, skill, job_id, level, duration_hours, cost_vnd, material_url, validity_days, prerequisite_id) values
  ('CRS-001', 'Bảo mật, MFA và quy định dữ liệu', 'Bảo mật thông tin', null, 'basic', 2, 0, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', 365, null),
  ('CRS-002', 'Xử lý ticket và chẩn đoán sự cố', 'IT Helpdesk', 'JOB-001', 'intermediate', 4, 500000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', 365, 'CRS-001'),
  ('CRS-003', 'Git, pull request và kiểm thử web', 'Phát triển phần mềm', 'JOB-002', 'intermediate', 3, 300000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, 'CRS-001'),
  ('CRS-004', 'Giám sát mạng và kiểm thử khôi phục', 'Hạ tầng và vận hành', 'JOB-003', 'intermediate', 4, 500000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', 365, 'CRS-001'),
  ('CRS-005', 'Quản lý dự án và ngân sách CNTT', 'Quản lý CNTT', 'JOB-004', 'intermediate', 4, 600000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, 'CRS-001'),
  ('CRS-006', 'Chẩn đoán sự cố mạng nâng cao (VPN, DNS)', 'IT Helpdesk', 'JOB-001', 'advanced', 6, 800000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', 365, 'CRS-002'),
  ('CRS-007', 'Tối ưu hiệu năng front-end', 'Phát triển phần mềm', 'JOB-002', 'advanced', 6, 700000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, 'CRS-003'),
  ('CRS-008', 'Tự động hóa giám sát hạ tầng', 'Hạ tầng và vận hành', 'JOB-003', 'advanced', 6, 800000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', 365, 'CRS-004'),
  ('CRS-009', 'Quản lý rủi ro dự án CNTT', 'Quản lý CNTT', 'JOB-004', 'advanced', 5, 900000, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, 'CRS-005'),
  ('CRS-010', 'Kỹ năng giao tiếp với người dùng', 'Kỹ năng mềm', null, 'basic', 3, 0, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, null),
  ('CRS-011', 'Viết tài liệu kỹ thuật', 'Kỹ năng mềm', null, 'basic', 3, 0, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, null),
  ('CRS-012', 'Làm việc nhóm và quy trình Agile', 'Kỹ năng mềm', null, 'basic', 4, 0, 'https://drive.google.com/drive/folders/1WzqcwtSQdyZybNAano3R0rezdVKFox3e', null, null);

-- Checklist onboarding mẫu; due_offset_days tính từ ngày vào làm (âm = việc chuẩn bị trước ngày đầu)
insert into public.onboarding_templates (template_id, job_id, task_name, category, owner_role, due_offset_days, course_id, required) values
  ('TPL-001', 'JOB-001', 'Gửi email chào mừng kèm lịch ngày đầu và tên người đón', 'paperwork', 'hr', -3, null, true),
  ('TPL-002', 'JOB-001', 'Chuẩn bị máy, cài công cụ remote, tạo sẵn tài khoản ticket, email và VPN', 'access', 'it', -2, null, true),
  ('TPL-003', 'JOB-001', 'Buddy nhắn làm quen trước và gửi sơ đồ team', 'social', 'buddy', -1, null, false),
  ('TPL-004', 'JOB-001', 'Gặp buddy 30 phút và đi một vòng giới thiệu team', 'social', 'buddy', 0, null, true),
  ('TPL-005', 'JOB-001', 'Đọc tài liệu quy trình ticket và SLA hỗ trợ nội bộ', 'training', 'employee', 2, null, true),
  ('TPL-006', 'JOB-001', 'Xử lý ticket thật đầu tiên có buddy kèm', 'practice', 'buddy', 5, 'CRS-002', true),
  ('TPL-007', 'JOB-001', 'Check-in 1-1 với quản lý lần 1', 'review', 'manager', 14, null, true),
  ('TPL-008', 'JOB-001', 'Hoàn thành khóa Xử lý ticket và chẩn đoán sự cố', 'training', 'employee', 21, 'CRS-002', true),
  ('TPL-009', 'JOB-001', 'Trực một ca hỗ trợ độc lập, không cần buddy kèm', 'practice', 'manager', 30, null, true),
  ('TPL-010', 'JOB-001', 'Khảo sát trải nghiệm onboarding 30 ngày', 'review', 'employee', 30, null, true),
  ('TPL-011', 'JOB-001', 'Học khóa nâng cao: chẩn đoán sự cố mạng VPN và DNS', 'training', 'employee', 45, 'CRS-006', true),
  ('TPL-012', 'JOB-001', 'Ghi nhận KPI lần đầu vào tab KPI làm mốc so sánh', 'review', 'manager', 60, null, true),
  ('TPL-013', 'JOB-001', 'Trình bày lại cho team một nội dung đã học', 'practice', 'employee', 60, null, false),
  ('TPL-014', 'JOB-001', 'Đánh giá hết thử việc theo required_skills của JOB-001', 'review', 'manager', 85, null, true),
  ('TPL-015', 'JOB-002', 'Gửi email chào mừng kèm lịch ngày đầu và tên người đón', 'paperwork', 'hr', -3, null, true),
  ('TPL-016', 'JOB-002', 'Chuẩn bị máy, cài IDE, tạo sẵn tài khoản Git và Jira', 'access', 'it', -2, null, true),
  ('TPL-017', 'JOB-002', 'Buddy nhắn làm quen trước và gửi sơ đồ team', 'social', 'buddy', -1, null, false),
  ('TPL-018', 'JOB-002', 'Gặp buddy 30 phút và đi một vòng giới thiệu team', 'social', 'buddy', 0, null, true),
  ('TPL-019', 'JOB-002', 'Đọc tài liệu kiến trúc hệ thống và quy trình code review', 'training', 'employee', 2, null, true),
  ('TPL-020', 'JOB-002', 'Hoàn thành pull request thật đầu tiên (một fix nhỏ)', 'practice', 'buddy', 5, 'CRS-003', true),
  ('TPL-021', 'JOB-002', 'Check-in 1-1 với quản lý lần 1', 'review', 'manager', 14, null, true),
  ('TPL-022', 'JOB-002', 'Hoàn thành khóa Git, pull request và kiểm thử web', 'training', 'employee', 21, 'CRS-003', true),
  ('TPL-023', 'JOB-002', 'Nhận và hoàn thành một task thật không cần buddy kèm', 'practice', 'manager', 30, null, true),
  ('TPL-024', 'JOB-002', 'Khảo sát trải nghiệm onboarding 30 ngày', 'review', 'employee', 30, null, true),
  ('TPL-025', 'JOB-002', 'Học khóa nâng cao: tối ưu hiệu năng front-end', 'training', 'employee', 45, 'CRS-007', true),
  ('TPL-026', 'JOB-002', 'Ghi nhận KPI lần đầu vào tab KPI làm mốc so sánh', 'review', 'manager', 60, null, true),
  ('TPL-027', 'JOB-002', 'Trình bày lại cho team một nội dung đã học', 'practice', 'employee', 60, null, false),
  ('TPL-028', 'JOB-002', 'Đánh giá hết thử việc theo required_skills của JOB-002', 'review', 'manager', 85, null, true),
  ('TPL-029', 'JOB-003', 'Gửi email chào mừng kèm lịch ngày đầu và tên người đón', 'paperwork', 'hr', -3, null, true),
  ('TPL-030', 'JOB-003', 'Chuẩn bị máy, cấp VPN và tạo sẵn tài khoản hệ thống giám sát', 'access', 'it', -2, null, true),
  ('TPL-031', 'JOB-003', 'Buddy nhắn làm quen trước và gửi sơ đồ team', 'social', 'buddy', -1, null, false),
  ('TPL-032', 'JOB-003', 'Gặp buddy 30 phút và đi một vòng giới thiệu team', 'social', 'buddy', 0, null, true),
  ('TPL-033', 'JOB-003', 'Đọc tài liệu sơ đồ mạng và quy trình bảo trì định kỳ', 'training', 'employee', 2, null, true),
  ('TPL-034', 'JOB-003', 'Thực hiện một lượt kiểm tra giám sát thật có buddy kèm', 'practice', 'buddy', 5, 'CRS-004', true),
  ('TPL-035', 'JOB-003', 'Check-in 1-1 với quản lý lần 1', 'review', 'manager', 14, null, true),
  ('TPL-036', 'JOB-003', 'Hoàn thành khóa Giám sát mạng và kiểm thử khôi phục', 'training', 'employee', 21, 'CRS-004', true),
  ('TPL-037', 'JOB-003', 'Tự thực hiện một ca bảo trì theo lịch, không cần buddy kèm', 'practice', 'manager', 30, null, true),
  ('TPL-038', 'JOB-003', 'Khảo sát trải nghiệm onboarding 30 ngày', 'review', 'employee', 30, null, true),
  ('TPL-039', 'JOB-003', 'Học khóa nâng cao: tự động hóa giám sát hạ tầng', 'training', 'employee', 45, 'CRS-008', true),
  ('TPL-040', 'JOB-003', 'Ghi nhận KPI lần đầu vào tab KPI làm mốc so sánh', 'review', 'manager', 60, null, true),
  ('TPL-041', 'JOB-003', 'Trình bày lại cho team một nội dung đã học', 'practice', 'employee', 60, null, false),
  ('TPL-042', 'JOB-003', 'Đánh giá hết thử việc theo required_skills của JOB-003', 'review', 'manager', 85, null, true),
  ('TPL-043', 'JOB-004', 'Gửi email chào mừng kèm lịch ngày đầu và tên người đón', 'paperwork', 'hr', -3, null, true),
  ('TPL-044', 'JOB-004', 'Chuẩn bị máy và cấp quyền công cụ quản lý dự án, báo cáo ngân sách', 'access', 'it', -2, null, true),
  ('TPL-045', 'JOB-004', 'Buddy nhắn làm quen trước và gửi sơ đồ team', 'social', 'buddy', -1, null, false),
  ('TPL-046', 'JOB-004', 'Gặp buddy 30 phút và đi một vòng giới thiệu team', 'social', 'buddy', 0, null, true),
  ('TPL-047', 'JOB-004', 'Đọc tài liệu danh mục dự án đang chạy và quy trình phê duyệt', 'training', 'employee', 2, null, true),
  ('TPL-048', 'JOB-004', 'Lập kế hoạch sơ bộ cho một hạng mục nhỏ có quản lý kèm', 'practice', 'buddy', 5, 'CRS-005', true),
  ('TPL-049', 'JOB-004', 'Check-in 1-1 với quản lý lần 1', 'review', 'manager', 14, null, true),
  ('TPL-050', 'JOB-004', 'Hoàn thành khóa Quản lý dự án và ngân sách CNTT', 'training', 'employee', 21, 'CRS-005', true),
  ('TPL-051', 'JOB-004', 'Chủ trì một cuộc họp dự án độc lập', 'practice', 'manager', 30, null, true),
  ('TPL-052', 'JOB-004', 'Khảo sát trải nghiệm onboarding 30 ngày', 'review', 'employee', 30, null, true),
  ('TPL-053', 'JOB-004', 'Học khóa nâng cao: quản lý rủi ro dự án CNTT', 'training', 'employee', 45, 'CRS-009', true),
  ('TPL-054', 'JOB-004', 'Ghi nhận KPI lần đầu vào tab KPI làm mốc so sánh', 'review', 'manager', 60, null, true),
  ('TPL-055', 'JOB-004', 'Trình bày lại cho team một nội dung đã học', 'practice', 'employee', 60, null, false),
  ('TPL-056', 'JOB-004', 'Đánh giá hết thử việc theo required_skills của JOB-004', 'review', 'manager', 85, null, true);

-- ---------------------------------------------------------------------------
-- 3. Dữ liệu demo (giả). Lịch sử trạng thái ghi tay bên dưới nên tạm tắt trigger tự ghi.
-- ---------------------------------------------------------------------------
select set_config('app.skip_events', 'on', true);

insert into public.candidates (candidate_id, job_id, full_name, email, phone, status, applied_at, consent_at, hr_note, is_sample) values
  ('CAN-0001', 'JOB-001', 'Trần Thị Mai Anh', 'mai.anh.tran@example.com', '0900 000 101', 'hired', now() - interval '1080 hours', now() - interval '1080 hours', null, true),
  ('CAN-0002', 'JOB-002', 'Lê Hoàng Phúc', 'hoang.phuc.le@example.com', '0900 000 102', 'hired', now() - interval '960 hours', now() - interval '960 hours', null, true),
  ('CAN-0003', 'JOB-003', 'Phạm Minh Tuấn', 'minh.tuan.pham@example.com', '0900 000 103', 'hired', now() - interval '672 hours', now() - interval '672 hours', null, true),
  ('CAN-0004', 'JOB-002', 'Đỗ Thu Hương', 'thu.huong.do@example.com', '0900 000 104', 'hired', now() - interval '432 hours', now() - interval '432 hours', null, true),
  ('CAN-0005', 'JOB-003', 'Nguyễn Văn Khoa', 'van.khoa.nguyen@example.com', '0900 000 105', 'interviewed', now() - interval '216 hours', now() - interval '216 hours', null, true),
  ('CAN-0006', 'JOB-001', 'Vũ Ngọc Hân', 'ngoc.han.vu@example.com', '0900 000 106', 'interview_scheduled', now() - interval '144 hours', now() - interval '144 hours', null, true),
  ('CAN-0007', 'JOB-002', 'Bùi Quốc Bảo', 'quoc.bao.bui@example.com', '0900 000 107', 'awaiting_candidate', now() - interval '96 hours', now() - interval '96 hours', null, true),
  ('CAN-0008', 'JOB-004', 'Hồ Thanh Tâm', 'thanh.tam.ho@example.com', '0900 000 108', 'needs_scheduling', now() - interval '192 hours', now() - interval '192 hours', null, true),
  ('CAN-0009', 'JOB-001', 'Đặng Khánh Linh', 'khanh.linh.dang@example.com', '0900 000 109', 'awaiting_hr', now() - interval '10 hours', now() - interval '10 hours', null, true),
  ('CAN-0010', 'JOB-002', 'Mai Đức Long', 'duc.long.mai@example.com', '0900 000 110', 'awaiting_hr', now() - interval '50 hours', now() - interval '50 hours', null, true),
  ('CAN-0011', 'JOB-003', 'Trịnh Thảo Vy', 'thao.vy.trinh@example.com', '0900 000 111', 'hr_overdue', now() - interval '80 hours', now() - interval '80 hours', null, true),
  ('CAN-0012', 'JOB-004', 'Cao Minh Nhật', 'minh.nhat.cao@example.com', '0900 000 112', 'on_hold', now() - interval '144 hours', now() - interval '144 hours', 'Chờ CTO xem thêm kinh nghiệm quản lý ngân sách trước khi mời.', true),
  ('CAN-0013', 'JOB-001', 'Phan Hữu Nghĩa', 'huu.nghia.phan@example.com', '0900 000 113', 'rejected', now() - interval '288 hours', now() - interval '288 hours', 'Chưa có kinh nghiệm thực tế về mạng LAN và hỗ trợ người dùng.', true),
  ('CAN-0014', 'JOB-002', 'Tô Bảo Ngọc', 'bao.ngoc.to@example.com', '0900 000 114', 'withdrawn', now() - interval '336 hours', now() - interval '336 hours', 'Ứng viên báo đã nhận việc nơi khác.', true);

insert into public.cv_analyses (candidate_id, cv_text, summary, score, criteria, skills_to_verify, interview_questions, cv_email, declared_role, model, rubric_version, analyzed_at) values
  ('CAN-0001', 'TRẦN THỊ MAI ANH
Kỹ thuật viên IT

KINH NGHIỆM
- Cài đặt và cấu hình Windows 11 cho 80 máy trạm của văn phòng
- Thay RAM, ổ SSD và cài lại phần mềm văn phòng khi máy lỗi
- Bấm cáp, cấu hình switch và chia sẻ máy in trong mạng LAN tầng 3
- Xử lý trung bình 20 ticket mỗi ngày trên hệ thống GLPI

KỸ NĂNG
giao tiếp', 'Ba năm hỗ trợ kỹ thuật cho văn phòng 80 người, quản lý ticket trên GLPI; giao tiếp với người dùng mới chỉ được liệt kê.', 90, '[{"skill": "Windows", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Cài đặt và cấu hình Windows 11 cho 80 máy trạm của văn phòng", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?"}, {"skill": "Phần cứng/phần mềm", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Thay RAM, ổ SSD và cài lại phần mềm văn phòng khi máy lỗi", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?"}, {"skill": "Mạng LAN", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Bấm cáp, cấu hình switch và chia sẻ máy in trong mạng LAN tầng 3", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?"}, {"skill": "Xử lý ticket", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Xử lý trung bình 20 ticket mỗi ngày trên hệ thống GLPI", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?"}, {"skill": "Giao tiếp hỗ trợ", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "giao tiếp", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ."}]'::jsonb, array['Giao tiếp hỗ trợ']::text[], array['Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?', 'Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?', 'Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?', 'Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?', 'Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ.']::text[], 'mai.anh.tran@example.com', 'Kỹ thuật viên IT', 'demo', 'job-skills-weighted-v1', now() - interval '1079.95 hours'),
  ('CAN-0002', 'LÊ HOÀNG PHÚC
Front-end Developer

KINH NGHIỆM
- Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập
- Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình
- Xây dựng giỏ hàng bằng React và TypeScript
- Làm việc theo Git flow, tạo pull request và review code hằng tuần
- Kết nối REST API thanh toán và xử lý lỗi mạng

KỸ NĂNG
Jest', 'Hai năm làm front-end React cho trang thương mại điện tử, quen Git flow và tích hợp API thanh toán.', 92, '[{"skill": "HTML", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra khả năng truy cập của một trang như thế nào?"}, {"skill": "CSS", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?"}, {"skill": "JavaScript", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Xây dựng giỏ hàng bằng React và TypeScript", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?"}, {"skill": "Git", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Làm việc theo Git flow, tạo pull request và review code hằng tuần", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý xung đột khi gộp nhánh như thế nào?"}, {"skill": "Tích hợp API", "level": 2, "points": 16.0, "max_points": 16, "verified": true, "evidence": "Kết nối REST API thanh toán và xử lý lỗi mạng", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?"}, {"skill": "Kiểm thử giao diện", "level": 1, "points": 8.0, "max_points": 16, "verified": true, "evidence": "Jest", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn chọn kiểm thử những luồng nào trước?"}]'::jsonb, array['Kiểm thử giao diện']::text[], array['Bạn kiểm tra khả năng truy cập của một trang như thế nào?', 'Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?', 'Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?', 'Bạn xử lý xung đột khi gộp nhánh như thế nào?', 'Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?', 'Bạn chọn kiểm thử những luồng nào trước?']::text[], 'hoang.phuc.le@example.com', 'Front-end Developer', 'demo', 'job-skills-weighted-v1', now() - interval '959.95 hours'),
  ('CAN-0003', 'PHẠM MINH TUẤN
Kỹ sư mạng

KINH NGHIỆM
- Cấu hình VLAN, DHCP và DNS cho mạng ba chi nhánh
- Bảo trì định kỳ máy chủ và thiết bị mạng trong phòng máy
- Khôi phục dịch vụ sau sự cố mất điện trong vòng 30 phút
- Viết quy trình sao lưu và tài liệu vận hành cho đội trực

KỸ NĂNG
Zabbix', 'Bốn năm vận hành mạng cho chuỗi ba chi nhánh, có kinh nghiệm xử lý sự cố; công cụ giám sát mới chỉ được liệt kê.', 90, '[{"skill": "Mạng máy tính", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Cấu hình VLAN, DHCP và DNS cho mạng ba chi nhánh", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn chia VLAN cho một văn phòng 100 người như thế nào?"}, {"skill": "Phần cứng", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Bảo trì định kỳ máy chủ và thiết bị mạng trong phòng máy", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Lịch bảo trì phần cứng bạn từng làm gồm những bước nào?"}, {"skill": "Giám sát", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "Zabbix", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn đặt ngưỡng cảnh báo thế nào để không bị báo động giả?"}, {"skill": "Xử lý sự cố", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Khôi phục dịch vụ sau sự cố mất điện trong vòng 30 phút", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Kể một sự cố thực tế bạn đã xử lý: các bước và thời gian khắc phục?"}, {"skill": "Tài liệu vận hành", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Viết quy trình sao lưu và tài liệu vận hành cho đội trực", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Tài liệu vận hành bạn viết gồm những phần nào?"}]'::jsonb, array['Giám sát']::text[], array['Bạn chia VLAN cho một văn phòng 100 người như thế nào?', 'Lịch bảo trì phần cứng bạn từng làm gồm những bước nào?', 'Bạn đặt ngưỡng cảnh báo thế nào để không bị báo động giả?', 'Kể một sự cố thực tế bạn đã xử lý: các bước và thời gian khắc phục?', 'Tài liệu vận hành bạn viết gồm những phần nào?']::text[], 'minh.tuan.pham@example.com', 'Kỹ sư mạng', 'demo', 'job-skills-weighted-v1', now() - interval '671.95 hours'),
  ('CAN-0004', 'ĐỖ THU HƯƠNG
Front-end Developer

KINH NGHIỆM
- Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập
- Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình
- Xây dựng giỏ hàng bằng React và TypeScript
- Kết nối REST API thanh toán và xử lý lỗi mạng

KỸ NĂNG
Git, Jest', 'Làm giao diện web hai năm, tích hợp REST API; quy trình Git và kiểm thử mới ở mức liệt kê.', 84, '[{"skill": "HTML", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra khả năng truy cập của một trang như thế nào?"}, {"skill": "CSS", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?"}, {"skill": "JavaScript", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Xây dựng giỏ hàng bằng React và TypeScript", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?"}, {"skill": "Git", "level": 1, "points": 8.5, "max_points": 17, "verified": true, "evidence": "Git", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý xung đột khi gộp nhánh như thế nào?"}, {"skill": "Tích hợp API", "level": 2, "points": 16.0, "max_points": 16, "verified": true, "evidence": "Kết nối REST API thanh toán và xử lý lỗi mạng", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?"}, {"skill": "Kiểm thử giao diện", "level": 1, "points": 8.0, "max_points": 16, "verified": true, "evidence": "Jest", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn chọn kiểm thử những luồng nào trước?"}]'::jsonb, array['Git', 'Kiểm thử giao diện']::text[], array['Bạn kiểm tra khả năng truy cập của một trang như thế nào?', 'Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?', 'Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?', 'Bạn xử lý xung đột khi gộp nhánh như thế nào?', 'Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?', 'Bạn chọn kiểm thử những luồng nào trước?']::text[], 'thu.huong.do@example.com', 'Front-end Developer', 'demo', 'job-skills-weighted-v1', now() - interval '431.95 hours'),
  ('CAN-0005', 'NGUYỄN VĂN KHOA
Kỹ sư mạng

KINH NGHIỆM
- Cấu hình VLAN, DHCP và DNS cho mạng ba chi nhánh
- Dựng giám sát hạ tầng bằng Zabbix, cảnh báo qua email
- Khôi phục dịch vụ sau sự cố mất điện trong vòng 30 phút

KỸ NĂNG
phần cứng máy chủ, viết tài liệu', 'Ba năm quản trị mạng và giám sát bằng Zabbix; phần cứng máy chủ và tài liệu vận hành cần xác minh thêm.', 80, '[{"skill": "Mạng máy tính", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Cấu hình VLAN, DHCP và DNS cho mạng ba chi nhánh", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn chia VLAN cho một văn phòng 100 người như thế nào?"}, {"skill": "Phần cứng", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "phần cứng máy chủ", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Lịch bảo trì phần cứng bạn từng làm gồm những bước nào?"}, {"skill": "Giám sát", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Dựng giám sát hạ tầng bằng Zabbix, cảnh báo qua email", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn đặt ngưỡng cảnh báo thế nào để không bị báo động giả?"}, {"skill": "Xử lý sự cố", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Khôi phục dịch vụ sau sự cố mất điện trong vòng 30 phút", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Kể một sự cố thực tế bạn đã xử lý: các bước và thời gian khắc phục?"}, {"skill": "Tài liệu vận hành", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "viết tài liệu", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Tài liệu vận hành bạn viết gồm những phần nào?"}]'::jsonb, array['Phần cứng', 'Tài liệu vận hành']::text[], array['Bạn chia VLAN cho một văn phòng 100 người như thế nào?', 'Lịch bảo trì phần cứng bạn từng làm gồm những bước nào?', 'Bạn đặt ngưỡng cảnh báo thế nào để không bị báo động giả?', 'Kể một sự cố thực tế bạn đã xử lý: các bước và thời gian khắc phục?', 'Tài liệu vận hành bạn viết gồm những phần nào?']::text[], 'van.khoa.nguyen@example.com', 'Kỹ sư mạng', 'demo', 'job-skills-weighted-v1', now() - interval '215.95 hours'),
  ('CAN-0006', 'VŨ NGỌC HÂN
Kỹ thuật viên IT

KINH NGHIỆM
- Cài đặt và cấu hình Windows 11 cho 80 máy trạm của văn phòng
- Thay RAM, ổ SSD và cài lại phần mềm văn phòng khi máy lỗi
- Xử lý trung bình 20 ticket mỗi ngày trên hệ thống GLPI
- Hướng dẫn người dùng qua điện thoại và viết tài liệu hỏi đáp nội bộ

KỸ NĂNG
mạng LAN cơ bản', 'Hai năm Helpdesk cho văn phòng 50 người, giao tiếp tốt; mạng LAN mới ở mức cơ bản.', 90, '[{"skill": "Windows", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Cài đặt và cấu hình Windows 11 cho 80 máy trạm của văn phòng", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?"}, {"skill": "Phần cứng/phần mềm", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Thay RAM, ổ SSD và cài lại phần mềm văn phòng khi máy lỗi", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?"}, {"skill": "Mạng LAN", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "mạng LAN cơ bản", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?"}, {"skill": "Xử lý ticket", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Xử lý trung bình 20 ticket mỗi ngày trên hệ thống GLPI", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?"}, {"skill": "Giao tiếp hỗ trợ", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Hướng dẫn người dùng qua điện thoại và viết tài liệu hỏi đáp nội bộ", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ."}]'::jsonb, array['Mạng LAN']::text[], array['Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?', 'Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?', 'Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?', 'Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?', 'Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ.']::text[], 'ngoc.han.vu@example.com', 'Kỹ thuật viên IT', 'demo', 'job-skills-weighted-v1', now() - interval '143.95 hours'),
  ('CAN-0007', 'BÙI QUỐC BẢO
Front-end Developer

KINH NGHIỆM
- Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập
- Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình
- Xây dựng giỏ hàng bằng React và TypeScript

KỸ NĂNG
Git, REST API', 'Một năm làm giao diện React; chưa thấy kinh nghiệm kiểm thử giao diện, Git và API mới được liệt kê.', 68, '[{"skill": "HTML", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra khả năng truy cập của một trang như thế nào?"}, {"skill": "CSS", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?"}, {"skill": "JavaScript", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Xây dựng giỏ hàng bằng React và TypeScript", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?"}, {"skill": "Git", "level": 1, "points": 8.5, "max_points": 17, "verified": true, "evidence": "Git", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý xung đột khi gộp nhánh như thế nào?"}, {"skill": "Tích hợp API", "level": 1, "points": 8.0, "max_points": 16, "verified": true, "evidence": "REST API", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?"}, {"skill": "Kiểm thử giao diện", "level": 0, "points": 0.0, "max_points": 16, "verified": true, "evidence": "", "reason": "Chưa thấy trong CV.", "question": "Bạn chọn kiểm thử những luồng nào trước?"}]'::jsonb, array['Git', 'Tích hợp API', 'Kiểm thử giao diện']::text[], array['Bạn kiểm tra khả năng truy cập của một trang như thế nào?', 'Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?', 'Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?', 'Bạn xử lý xung đột khi gộp nhánh như thế nào?', 'Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?', 'Bạn chọn kiểm thử những luồng nào trước?']::text[], 'quoc.bao.bui@example.com', 'Front-end Developer', 'demo', 'job-skills-weighted-v1', now() - interval '95.95 hours'),
  ('CAN-0008', 'HỒ THANH TÂM
Trưởng nhóm dự án

KINH NGHIỆM
- Quản lý bốn dự án triển khai ERP đúng hạn với Jira
- Lập và theo dõi ngân sách CNTT hai tỷ đồng mỗi năm
- Dẫn dắt nhóm tám kỹ sư, đánh giá hiệu suất hằng quý

KỸ NĂNG
SDLC, hạ tầng cloud', 'Năm năm quản lý dự án ERP, có kinh nghiệm lập ngân sách và dẫn dắt nhóm; SDLC và hạ tầng cần xác minh.', 80, '[{"skill": "Quản lý dự án", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Quản lý bốn dự án triển khai ERP đúng hạn với Jira", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý thế nào khi một dự án có nguy cơ trễ hạn?"}, {"skill": "SDLC", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "SDLC", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn kiểm soát thay đổi yêu cầu giữa dự án ra sao?"}, {"skill": "Lập ngân sách", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Lập và theo dõi ngân sách CNTT hai tỷ đồng mỗi năm", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn ưu tiên khoản chi nào khi ngân sách bị cắt?"}, {"skill": "Quản lý nhóm", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Dẫn dắt nhóm tám kỹ sư, đánh giá hiệu suất hằng quý", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý thế nào khi một thành viên liên tục trễ việc?"}, {"skill": "API và hạ tầng", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "hạ tầng cloud", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn đánh giá nhà cung cấp hạ tầng theo tiêu chí nào?"}]'::jsonb, array['SDLC', 'API và hạ tầng']::text[], array['Bạn xử lý thế nào khi một dự án có nguy cơ trễ hạn?', 'Bạn kiểm soát thay đổi yêu cầu giữa dự án ra sao?', 'Bạn ưu tiên khoản chi nào khi ngân sách bị cắt?', 'Bạn xử lý thế nào khi một thành viên liên tục trễ việc?', 'Bạn đánh giá nhà cung cấp hạ tầng theo tiêu chí nào?']::text[], 'thanh.tam.ho@example.com', 'Trưởng nhóm dự án', 'demo', 'job-skills-weighted-v1', now() - interval '191.95 hours'),
  ('CAN-0009', 'ĐẶNG KHÁNH LINH
Kỹ thuật viên IT

KINH NGHIỆM
- Cài đặt và cấu hình Windows 11 cho 80 máy trạm của văn phòng
- Thay RAM, ổ SSD và cài lại phần mềm văn phòng khi máy lỗi
- Xử lý trung bình 20 ticket mỗi ngày trên hệ thống GLPI

KỸ NĂNG
mạng LAN cơ bản, giao tiếp', 'Hai năm hỗ trợ kỹ thuật tại công ty phần mềm kế toán, xử lý ticket hằng ngày; mạng LAN và giao tiếp cần xác minh.', 80, '[{"skill": "Windows", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Cài đặt và cấu hình Windows 11 cho 80 máy trạm của văn phòng", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?"}, {"skill": "Phần cứng/phần mềm", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Thay RAM, ổ SSD và cài lại phần mềm văn phòng khi máy lỗi", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?"}, {"skill": "Mạng LAN", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "mạng LAN cơ bản", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?"}, {"skill": "Xử lý ticket", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Xử lý trung bình 20 ticket mỗi ngày trên hệ thống GLPI", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?"}, {"skill": "Giao tiếp hỗ trợ", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "giao tiếp", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ."}]'::jsonb, array['Mạng LAN', 'Giao tiếp hỗ trợ']::text[], array['Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?', 'Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?', 'Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?', 'Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?', 'Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ.']::text[], 'khanh.linh.dang@example.com', 'Kỹ thuật viên IT', 'demo', 'job-skills-weighted-v1', now() - interval '9.95 hours'),
  ('CAN-0010', 'MAI ĐỨC LONG
Front-end Developer

KINH NGHIỆM
- Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập
- Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình
- Kết nối REST API thanh toán và xử lý lỗi mạng

KỸ NĂNG
JavaScript, Git', 'Làm website cho agency, mạnh HTML/CSS và tích hợp API; JavaScript và Git mới được liệt kê, chưa có kiểm thử.', 67, '[{"skill": "HTML", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra khả năng truy cập của một trang như thế nào?"}, {"skill": "CSS", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?"}, {"skill": "JavaScript", "level": 1, "points": 8.5, "max_points": 17, "verified": true, "evidence": "JavaScript", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?"}, {"skill": "Git", "level": 1, "points": 8.5, "max_points": 17, "verified": true, "evidence": "Git", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý xung đột khi gộp nhánh như thế nào?"}, {"skill": "Tích hợp API", "level": 2, "points": 16.0, "max_points": 16, "verified": true, "evidence": "Kết nối REST API thanh toán và xử lý lỗi mạng", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?"}, {"skill": "Kiểm thử giao diện", "level": 0, "points": 0.0, "max_points": 16, "verified": true, "evidence": "", "reason": "Chưa thấy trong CV.", "question": "Bạn chọn kiểm thử những luồng nào trước?"}]'::jsonb, array['JavaScript', 'Git', 'Kiểm thử giao diện']::text[], array['Bạn kiểm tra khả năng truy cập của một trang như thế nào?', 'Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?', 'Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?', 'Bạn xử lý xung đột khi gộp nhánh như thế nào?', 'Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?', 'Bạn chọn kiểm thử những luồng nào trước?']::text[], 'duc.long.mai@example.com', 'Front-end Developer', 'demo', 'job-skills-weighted-v1', now() - interval '49.95 hours'),
  ('CAN-0011', 'TRỊNH THẢO VY
Kỹ sư mạng

KINH NGHIỆM
- Bảo trì định kỳ máy chủ và thiết bị mạng trong phòng máy
- Khôi phục dịch vụ sau sự cố mất điện trong vòng 30 phút

KỸ NĂNG
TCP/IP, Zabbix', 'Quản trị phòng máy trường học, có kinh nghiệm phần cứng và xử lý sự cố; chưa có tài liệu vận hành.', 60, '[{"skill": "Mạng máy tính", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "TCP/IP", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn chia VLAN cho một văn phòng 100 người như thế nào?"}, {"skill": "Phần cứng", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Bảo trì định kỳ máy chủ và thiết bị mạng trong phòng máy", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Lịch bảo trì phần cứng bạn từng làm gồm những bước nào?"}, {"skill": "Giám sát", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "Zabbix", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn đặt ngưỡng cảnh báo thế nào để không bị báo động giả?"}, {"skill": "Xử lý sự cố", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Khôi phục dịch vụ sau sự cố mất điện trong vòng 30 phút", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Kể một sự cố thực tế bạn đã xử lý: các bước và thời gian khắc phục?"}, {"skill": "Tài liệu vận hành", "level": 0, "points": 0.0, "max_points": 20, "verified": true, "evidence": "", "reason": "Chưa thấy trong CV.", "question": "Tài liệu vận hành bạn viết gồm những phần nào?"}]'::jsonb, array['Mạng máy tính', 'Giám sát', 'Tài liệu vận hành']::text[], array['Bạn chia VLAN cho một văn phòng 100 người như thế nào?', 'Lịch bảo trì phần cứng bạn từng làm gồm những bước nào?', 'Bạn đặt ngưỡng cảnh báo thế nào để không bị báo động giả?', 'Kể một sự cố thực tế bạn đã xử lý: các bước và thời gian khắc phục?', 'Tài liệu vận hành bạn viết gồm những phần nào?']::text[], 'thao.vy.trinh@example.com', 'Kỹ sư mạng', 'demo', 'job-skills-weighted-v1', now() - interval '79.95 hours'),
  ('CAN-0012', 'CAO MINH NHẬT
Trưởng nhóm dự án

KINH NGHIỆM
- Quản lý bốn dự án triển khai ERP đúng hạn với Jira
- Chuẩn hoá quy trình phát triển từ phân tích yêu cầu đến bàn giao

KỸ NĂNG
lập ngân sách, quản lý nhóm, hạ tầng cloud', 'Bốn năm trưởng nhóm phát triển, làm theo Scrum; ngân sách và quản lý nhà cung cấp mới được liệt kê.', 70, '[{"skill": "Quản lý dự án", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Quản lý bốn dự án triển khai ERP đúng hạn với Jira", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý thế nào khi một dự án có nguy cơ trễ hạn?"}, {"skill": "SDLC", "level": 2, "points": 20.0, "max_points": 20, "verified": true, "evidence": "Chuẩn hoá quy trình phát triển từ phân tích yêu cầu đến bàn giao", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm soát thay đổi yêu cầu giữa dự án ra sao?"}, {"skill": "Lập ngân sách", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "lập ngân sách", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn ưu tiên khoản chi nào khi ngân sách bị cắt?"}, {"skill": "Quản lý nhóm", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "quản lý nhóm", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý thế nào khi một thành viên liên tục trễ việc?"}, {"skill": "API và hạ tầng", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "hạ tầng cloud", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn đánh giá nhà cung cấp hạ tầng theo tiêu chí nào?"}]'::jsonb, array['Lập ngân sách', 'Quản lý nhóm', 'API và hạ tầng']::text[], array['Bạn xử lý thế nào khi một dự án có nguy cơ trễ hạn?', 'Bạn kiểm soát thay đổi yêu cầu giữa dự án ra sao?', 'Bạn ưu tiên khoản chi nào khi ngân sách bị cắt?', 'Bạn xử lý thế nào khi một thành viên liên tục trễ việc?', 'Bạn đánh giá nhà cung cấp hạ tầng theo tiêu chí nào?']::text[], 'minh.nhat.cao@example.com', 'Trưởng nhóm dự án', 'demo', 'job-skills-weighted-v1', now() - interval '143.95 hours'),
  ('CAN-0013', 'PHAN HỮU NGHĨA
Kỹ thuật viên IT

KINH NGHIỆM

KỸ NĂNG
Windows, sửa chữa phần cứng, quản lý ticket', 'Mới tốt nghiệp, chỉ liệt kê kỹ năng; chưa có kinh nghiệm mạng LAN và hỗ trợ người dùng.', 30, '[{"skill": "Windows", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "Windows", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?"}, {"skill": "Phần cứng/phần mềm", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "sửa chữa phần cứng", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?"}, {"skill": "Mạng LAN", "level": 0, "points": 0.0, "max_points": 20, "verified": true, "evidence": "", "reason": "Chưa thấy trong CV.", "question": "Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?"}, {"skill": "Xử lý ticket", "level": 1, "points": 10.0, "max_points": 20, "verified": true, "evidence": "quản lý ticket", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?"}, {"skill": "Giao tiếp hỗ trợ", "level": 0, "points": 0.0, "max_points": 20, "verified": true, "evidence": "", "reason": "Chưa thấy trong CV.", "question": "Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ."}]'::jsonb, array['Windows', 'Phần cứng/phần mềm', 'Mạng LAN', 'Xử lý ticket', 'Giao tiếp hỗ trợ']::text[], array['Bạn triển khai cập nhật Windows hàng loạt cho văn phòng thế nào?', 'Bạn kiểm tra những gì trước khi thay linh kiện cho máy lỗi?', 'Bạn xử lý sự cố mất kết nối mạng nội bộ như thế nào?', 'Bạn ưu tiên các ticket đến cùng lúc theo tiêu chí nào?', 'Kể một lần bạn giải thích sự cố cho người dùng không rành công nghệ.']::text[], 'huu.nghia.phan@example.com', 'Kỹ thuật viên IT', 'demo', 'job-skills-weighted-v1', now() - interval '287.95 hours'),
  ('CAN-0014', 'TÔ BẢO NGỌC
Front-end Developer

KINH NGHIỆM
- Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập
- Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình
- Xây dựng giỏ hàng bằng React và TypeScript
- Làm việc theo Git flow, tạo pull request và review code hằng tuần

KỸ NĂNG
REST API, Jest', 'Ba năm front-end, quen Git và React; API và kiểm thử ở mức liệt kê.', 84, '[{"skill": "HTML", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Dựng giao diện trang sản phẩm bằng HTML5 ngữ nghĩa, đạt chuẩn truy cập", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn kiểm tra khả năng truy cập của một trang như thế nào?"}, {"skill": "CSS", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Viết CSS responsive với Flexbox và Grid cho ba kích thước màn hình", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?"}, {"skill": "JavaScript", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Xây dựng giỏ hàng bằng React và TypeScript", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?"}, {"skill": "Git", "level": 2, "points": 17.0, "max_points": 17, "verified": true, "evidence": "Làm việc theo Git flow, tạo pull request và review code hằng tuần", "reason": "CV có công việc hoặc dự án cụ thể thể hiện kỹ năng này.", "question": "Bạn xử lý xung đột khi gộp nhánh như thế nào?"}, {"skill": "Tích hợp API", "level": 1, "points": 8.0, "max_points": 16, "verified": true, "evidence": "REST API", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?"}, {"skill": "Kiểm thử giao diện", "level": 1, "points": 8.0, "max_points": 16, "verified": true, "evidence": "Jest", "reason": "Kỹ năng chỉ được liệt kê.", "question": "Bạn chọn kiểm thử những luồng nào trước?"}]'::jsonb, array['Tích hợp API', 'Kiểm thử giao diện']::text[], array['Bạn kiểm tra khả năng truy cập của một trang như thế nào?', 'Bạn tổ chức CSS cho một dự án nhiều người cùng làm ra sao?', 'Bạn quản lý trạng thái của giỏ hàng thế nào khi người dùng mở nhiều tab?', 'Bạn xử lý xung đột khi gộp nhánh như thế nào?', 'Bạn xử lý khi API trả lỗi hoặc phản hồi chậm ra sao?', 'Bạn chọn kiểm thử những luồng nào trước?']::text[], 'bao.ngoc.to@example.com', 'Front-end Developer', 'demo', 'job-skills-weighted-v1', now() - interval '335.95 hours');

insert into public.candidate_events (candidate_id, from_status, to_status, actor, note, occurred_at) values
  ('CAN-0001', null, 'received', 'system', null, now() - interval '1080 hours'),
  ('CAN-0001', 'received', 'awaiting_hr', 'system', null, now() - interval '1079.95 hours'),
  ('CAN-0001', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '1032 hours'),
  ('CAN-0001', 'awaiting_candidate', 'interview_scheduled', 'candidate', null, now() - interval '1020 hours'),
  ('CAN-0001', 'interview_scheduled', 'interviewed', 'hr', null, now() - interval '960 hours'),
  ('CAN-0001', 'interviewed', 'hired', 'hr', null, now() - interval '912 hours'),
  ('CAN-0002', null, 'received', 'system', null, now() - interval '960 hours'),
  ('CAN-0002', 'received', 'awaiting_hr', 'system', null, now() - interval '959.95 hours'),
  ('CAN-0002', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '912 hours'),
  ('CAN-0002', 'awaiting_candidate', 'interview_scheduled', 'candidate', null, now() - interval '900 hours'),
  ('CAN-0002', 'interview_scheduled', 'interviewed', 'hr', null, now() - interval '840 hours'),
  ('CAN-0002', 'interviewed', 'hired', 'hr', null, now() - interval '792 hours'),
  ('CAN-0003', null, 'received', 'system', null, now() - interval '672 hours'),
  ('CAN-0003', 'received', 'awaiting_hr', 'system', null, now() - interval '671.95 hours'),
  ('CAN-0003', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '624 hours'),
  ('CAN-0003', 'awaiting_candidate', 'interview_scheduled', 'candidate', null, now() - interval '612 hours'),
  ('CAN-0003', 'interview_scheduled', 'interviewed', 'hr', null, now() - interval '432 hours'),
  ('CAN-0003', 'interviewed', 'hired', 'hr', null, now() - interval '360 hours'),
  ('CAN-0004', null, 'received', 'system', null, now() - interval '432 hours'),
  ('CAN-0004', 'received', 'awaiting_hr', 'system', null, now() - interval '431.95 hours'),
  ('CAN-0004', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '384 hours'),
  ('CAN-0004', 'awaiting_candidate', 'interview_scheduled', 'candidate', null, now() - interval '372 hours'),
  ('CAN-0004', 'interview_scheduled', 'interviewed', 'hr', null, now() - interval '216 hours'),
  ('CAN-0004', 'interviewed', 'hired', 'hr', null, now() - interval '144 hours'),
  ('CAN-0005', null, 'received', 'system', null, now() - interval '216 hours'),
  ('CAN-0005', 'received', 'awaiting_hr', 'system', null, now() - interval '215.95 hours'),
  ('CAN-0005', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '168 hours'),
  ('CAN-0005', 'awaiting_candidate', 'interview_scheduled', 'candidate', null, now() - interval '156 hours'),
  ('CAN-0005', 'interview_scheduled', 'interviewed', 'hr', null, now() - interval '46 hours'),
  ('CAN-0006', null, 'received', 'system', null, now() - interval '144 hours'),
  ('CAN-0006', 'received', 'awaiting_hr', 'system', null, now() - interval '143.95 hours'),
  ('CAN-0006', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '96 hours'),
  ('CAN-0006', 'awaiting_candidate', 'interview_scheduled', 'candidate', null, now() - interval '84 hours'),
  ('CAN-0007', null, 'received', 'system', null, now() - interval '96 hours'),
  ('CAN-0007', 'received', 'awaiting_hr', 'system', null, now() - interval '95.95 hours'),
  ('CAN-0007', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '6 hours'),
  ('CAN-0008', null, 'received', 'system', null, now() - interval '192 hours'),
  ('CAN-0008', 'received', 'awaiting_hr', 'system', null, now() - interval '191.95 hours'),
  ('CAN-0008', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '120 hours'),
  ('CAN-0008', 'awaiting_candidate', 'needs_scheduling', 'candidate', 'Ứng viên xin đổi sang tuần sau.', now() - interval '96 hours'),
  ('CAN-0009', null, 'received', 'system', null, now() - interval '10 hours'),
  ('CAN-0009', 'received', 'awaiting_hr', 'system', null, now() - interval '9.95 hours'),
  ('CAN-0010', null, 'received', 'system', null, now() - interval '50 hours'),
  ('CAN-0010', 'received', 'awaiting_hr', 'system', null, now() - interval '49.95 hours'),
  ('CAN-0011', null, 'received', 'system', null, now() - interval '80 hours'),
  ('CAN-0011', 'received', 'awaiting_hr', 'system', null, now() - interval '79.95 hours'),
  ('CAN-0011', 'awaiting_hr', 'hr_overdue', 'system', null, now() - interval '8 hours'),
  ('CAN-0012', null, 'received', 'system', null, now() - interval '144 hours'),
  ('CAN-0012', 'received', 'awaiting_hr', 'system', null, now() - interval '143.95 hours'),
  ('CAN-0012', 'awaiting_hr', 'on_hold', 'hr', null, now() - interval '120 hours'),
  ('CAN-0013', null, 'received', 'system', null, now() - interval '288 hours'),
  ('CAN-0013', 'received', 'awaiting_hr', 'system', null, now() - interval '287.95 hours'),
  ('CAN-0013', 'awaiting_hr', 'rejected', 'hr', null, now() - interval '264 hours'),
  ('CAN-0014', null, 'received', 'system', null, now() - interval '336 hours'),
  ('CAN-0014', 'received', 'awaiting_hr', 'system', null, now() - interval '335.95 hours'),
  ('CAN-0014', 'awaiting_hr', 'awaiting_candidate', 'hr', null, now() - interval '288 hours'),
  ('CAN-0014', 'awaiting_candidate', 'withdrawn', 'candidate', null, now() - interval '276 hours');

insert into public.interviews (candidate_id, starts_at, ends_at, status, result) values
  ('CAN-0001', now() - interval '961 hours', now() - interval '960.25 hours', 'completed', 'pass'),
  ('CAN-0002', now() - interval '841 hours', now() - interval '840.25 hours', 'completed', 'pass'),
  ('CAN-0003', now() - interval '433 hours', now() - interval '432.25 hours', 'completed', 'pass'),
  ('CAN-0004', now() - interval '217 hours', now() - interval '216.25 hours', 'completed', 'pass'),
  ('CAN-0005', now() - interval '48 hours', now() - interval '47.25 hours', 'completed', null),
  ('CAN-0006', ((((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + case extract(isodow from ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2))::int when 6 then 2 when 7 then 1 else 0 end) + time '10:00') at time zone 'Asia/Ho_Chi_Minh', ((((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2) + case extract(isodow from ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 2))::int when 6 then 2 when 7 then 1 else 0 end) + time '10:45') at time zone 'Asia/Ho_Chi_Minh', 'scheduled', null);

-- Nhân viên: bốn ứng viên đã nhận việc, vào làm cách đây 30, 25, 12 và 3 ngày
insert into public.employees (employee_id, candidate_id, job_id, full_name, email, start_date, manager, buddy, tools_access, is_sample) values
  ('EMP-0001', 'CAN-0001', 'JOB-001', 'Trần Thị Mai Anh', 'mai.anh.tran@example.com', current_date - 30, 'IT Support Lead', 'Nguyễn Hữu Đạt', 'confirmed', true),
  ('EMP-0002', 'CAN-0002', 'JOB-002', 'Lê Hoàng Phúc', 'hoang.phuc.le@example.com', current_date - 25, 'Engineering Lead', 'Trương Minh Kha', 'confirmed', true),
  ('EMP-0003', 'CAN-0003', 'JOB-003', 'Phạm Minh Tuấn', 'minh.tuan.pham@example.com', current_date - 12, 'Infrastructure Lead', 'Lâm Quốc Thái', 'pending', true),
  ('EMP-0004', 'CAN-0004', 'JOB-002', 'Đỗ Thu Hương', 'thu.huong.do@example.com', current_date - 3, 'Engineering Lead', 'Trương Minh Kha', 'pending', true);

-- Checklist: sinh từ mẫu của vị trí. Việc đã qua hạn 2 ngày coi như xong, trừ vài ca để demo:
-- EMP-0002 chưa check-in 1-1 (trễ hạn), EMP-0003 có một báo cáo chờ HR duyệt và một việc bị vướng.
insert into public.onboarding_tasks (employee_id, template_id, task_name, category, owner_role, due_date, status, completed_on, course_id,
                                     employee_note, submitted_at, proof_name)
select e.employee_id, t.template_id, t.task_name, t.category, t.owner_role, d.due, s.status,
       case when s.status = 'done' then d.due end, t.course_id,
       case when s.status = 'submitted' then 'Đã kiểm tra giám sát cùng buddy, đính kèm biên bản.'
            when s.status = 'blocked' then 'Chưa được cấp quyền đọc tài liệu sơ đồ mạng.' end,
       case when s.status = 'submitted' then now() - interval '1 day' end,
       case when s.status = 'submitted' then 'bien-ban-kiem-tra-giam-sat.pdf' end
from public.employees e
join public.onboarding_templates t on t.job_id = e.job_id and t.status = 'active'
cross join lateral (select e.start_date + t.due_offset_days as due) d
cross join lateral (select case
    when e.employee_id = 'EMP-0002' and t.due_offset_days = 14 then 'not_started'
    when e.employee_id = 'EMP-0003' and t.due_offset_days = 5 then 'submitted'
    when e.employee_id = 'EMP-0003' and t.due_offset_days = 2 then 'blocked'
    when d.due <= current_date - 2 then 'done'
    when d.due <= current_date + 3 then 'in_progress'
    else 'not_started' end as status) s
order by e.employee_id, t.due_offset_days, t.template_id;

-- Khoá học: khoá bảo mật chung (CRS-001) và các khoá đi kèm checklist của vị trí
insert into public.trainings (employee_id, course_id, source, assigned_on, due_on, status, completed_on, cost_vnd)
select x.employee_id, x.course_id, 'template', x.start_date - 3, x.due, s.status, case when s.status = 'completed' then x.due end, c.cost_vnd
from (
  select e.employee_id, e.start_date, 'CRS-001' as course_id, e.start_date + 7 as due from public.employees e
  union all
  select e.employee_id, e.start_date, t.course_id, e.start_date + min(t.due_offset_days)
  from public.employees e join public.onboarding_templates t on t.job_id = e.job_id and t.status = 'active' and t.course_id is not null
  group by e.employee_id, e.start_date, t.course_id
) x
join public.courses c on c.course_id = x.course_id
cross join lateral (select case when x.due <= current_date - 2 then 'completed'
                                when x.due <= current_date + 7 then 'in_progress'
                                else 'not_started' end as status) s
order by x.employee_id, x.due;

-- KPI bốn tuần gần nhất (tuần ISO, tính theo ngày chạy file)
insert into public.kpi_records (employee_id, period, metric, target, actual, unit, source, recorded_on)
select v.emp, to_char(current_date - 7 * v.k, 'IYYY-"W"IW'), v.metric, v.target, v.actual, v.unit, 'demo',
       (date_trunc('week', current_date - 7 * v.k) + interval '4 days')::date
from (values
  ('EMP-0001', 4, 'Ticket đã xử lý', 50, 41, 'ticket'), ('EMP-0001', 3, 'Ticket đã xử lý', 50, 44, 'ticket'),
  ('EMP-0001', 2, 'Ticket đã xử lý', 50, 47, 'ticket'), ('EMP-0001', 1, 'Ticket đã xử lý', 50, 49, 'ticket'),
  ('EMP-0002', 3, 'Task được nghiệm thu', 10, 6, 'task'), ('EMP-0002', 2, 'Task được nghiệm thu', 10, 7, 'task'),
  ('EMP-0002', 1, 'Task được nghiệm thu', 10, 8, 'task'),
  ('EMP-0003', 1, 'Lượt kiểm tra bảo trì', 20, 18, 'lượt')
) as v(emp, k, metric, target, actual, unit);

-- Phản hồi định kỳ: tuần này và hai tuần trước; có đề xuất đang chờ HR duyệt, đã duyệt, đã từ chối
insert into public.feedback (feedback_id, employee_id, period, submitted_on, satisfaction, message, support_requested, topic, ai_summary, suggested_action, status)
select v.id, v.emp, to_char(current_date - 7 * v.k, 'IYYY-"W"IW'), least((date_trunc('week', current_date - 7 * v.k) + interval '4 days')::date, current_date),
       v.sat, v.msg, v.support, v.topic, v.summary, v.act, v.status
from (values
  ('FB-0001', 'EMP-0001', 2, 4, 'Tài liệu quy trình ticket rõ ràng, em muốn có thêm tình huống lỗi VPN cụ thể.', false, 'training',
   'Cần thêm ví dụ xử lý lỗi VPN.', 'Bổ sung tình huống lỗi VPN vào tài liệu Helpdesk.', 'action_open'),
  ('FB-0002', 'EMP-0001', 1, 5, 'Bài thực hành với buddy rất hữu ích, giờ em tự xử lý được phần lớn ticket mạng.', false, 'training',
   'Đã tự tin xử lý ticket mạng.', 'Giao thêm ticket cấp 2.', 'reviewed'),
  ('FB-0003', 'EMP-0002', 2, 2, 'Em chưa có quyền ghi repository dự án chính nên chưa tạo được pull request.', true, 'tools',
   'Vướng quyền truy cập kho mã nguồn.', 'Nhờ IT và Engineering Lead cấp quyền repository trong tuần.', 'action_open'),
  ('FB-0004', 'EMP-0002', 1, 3, 'Tuần này em được giao ba task gấp cùng lúc, sợ không kịp nghiệm thu.', true, 'workload',
   'Khối lượng task dồn, lo trễ nghiệm thu.', 'HR trao đổi với Engineering Lead để sắp lại thứ tự ưu tiên.', 'pending_hr'),
  ('FB-0005', 'EMP-0003', 1, 3, 'Chỗ ngồi gần phòng máy khá ồn, khó tập trung khi trực sự cố.', true, 'environment',
   'Chỗ ngồi ồn ảnh hưởng tập trung khi trực.', 'Sắp xếp chỗ ngồi yên tĩnh hơn cho ca trực.', 'pending_hr'),
  ('FB-0006', 'EMP-0003', 2, 4, 'Lịch trực tuần đầu rõ ràng, buddy hỗ trợ tốt.', false, 'schedule',
   'Lịch trực rõ, buddy hỗ trợ tốt.', 'Giữ lịch trực hiện tại.', 'reviewed'),
  ('FB-0007', 'EMP-0004', 0, 3, 'Em muốn được làm việc từ xa một ngày mỗi tuần.', true, 'other',
   'Đề xuất làm việc từ xa một ngày mỗi tuần.', 'Trao đổi chính sách làm việc từ xa trong thời gian thử việc.', 'declined')
) as v(id, emp, k, sat, msg, support, topic, summary, act, status);

insert into public.support_actions (action_id, employee_id, feedback_id, title, owner_role, due_on, status, completed_at, note) values
  ('ACT-0001', 'EMP-0002', 'FB-0003', 'Cấp quyền ghi repository dự án chính', 'it', current_date + 1, 'in_progress', null, 'Tạo từ phản hồi FB-0003 sau khi HR duyệt.'),
  ('ACT-0002', 'EMP-0001', 'FB-0001', 'Bổ sung tình huống lỗi VPN vào tài liệu Helpdesk', 'buddy', current_date - 6, 'done', now() - interval '7 days', 'Tạo từ phản hồi FB-0001 sau khi HR duyệt.');

-- Vài dòng nhật ký để trang Cài đặt → Nhật ký hệ thống có nội dung
insert into public.automation_logs (workflow, entity_id, event, level, message, logged_at) values
  ('WF1', 'CAN-0009', 'application_submitted', 'info', 'Nhận hồ sơ JOB-001 qua form, CV PDF. AI đang đọc CV.', now() - interval '10 hours'),
  ('WF1', 'CAN-0009', 'ai_review_ready', 'success', 'AI chấm 80/100. Đã gửi email cho HR xem xét.', now() - interval '9 hours 57 minutes'),
  ('WF1', 'CAN-0011', 'hr_review_overdue', 'warning', 'Hết 72 giờ chờ HR duyệt. Hồ sơ chuyển sang Quá hạn duyệt.', now() - interval '8 hours'),
  ('WF2', 'EMP-0003', 'task_submitted', 'info', 'Phạm Minh Tuấn nộp kết quả đầu việc, chờ HR duyệt.', now() - interval '1 day'),
  ('WF3', 'EMP-0003', 'support_requested', 'waiting', 'FB-0005 cần HR duyệt hành động hỗ trợ.', now() - interval '20 hours'),
  ('WF2', null, 'progress_scan', 'success', 'Quét tiến độ 4 nhân viên đang thử việc và gửi nhắc việc.', now() - interval '3 hours');

-- Mã do DB sinh tiếp nối sau dữ liệu trên
select setval('public.jobs_code_seq', 4), setval('public.courses_code_seq', 12), setval('public.onboarding_templates_code_seq', 56),
       setval('public.candidates_code_seq', 14), setval('public.employees_code_seq', 4),
       setval('public.feedback_code_seq', 7), setval('public.support_actions_code_seq', 2);

commit;
