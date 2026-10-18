# Phân công nhóm

| Thành viên | Công việc | Nhánh |
|---|---|---|
| Gia Huy | Workflow 1 — Tuyển dụng | wf1-recruitment |
| Văn An | Workflow 2 — Onboarding | wf2-onboarding |
| Vĩnh Thịnh | Workflow 3 — Hiệu suất | wf3-performance |

## Quy tắc phối hợp

- Mỗi thành viên dùng tài khoản GitHub riêng.
- Thay đổi trên main phải thông qua Pull Request.
- Mỗi Pull Request cần ít nhất một thành viên khác review.
- Commit sau mỗi phần việc có ý nghĩa.
- Báo cho nhau trước khi sửa workflow do người khác phụ trách.

## Quy tắc commit git (dùng tiếng anh)

- feat: thêm chức năng
- fix: sửa lỗi
- docs: cập nhật tài liệu
- test: kiểm thử
- chore: cấu hình
- refactor: sắp xếp lại
- Phạm vi: wf1, wf2, wf3, logs, docs, hoặc repo.
- Mô tả: nói rõ thay đổi đã làm, không ghi chung chung như “update” hay “sửa”.

# Ví dụ: 
docs(repo): add project overview and team members (thêm mô tả đề tài và thành viên)

feat(wf1): add the job application form (tạo form tiếp nhận hồ sơ ứng tuyển)
fix(wf1): fix the candidate CV link (sửa đường dẫn CV trong bảng Candidates)

feat(wf2): send task reminder emails (gửi email nhắc nhân viên hoàn thành đầu việc)
fix(wf2): fix onboarding task status updates (sửa trạng thái đầu việc trong bảng Onboarding)

feat(wf3): create weekly KPI reports (tạo báo cáo KPI theo tuần)
fix(wf3): correct report data types (chuẩn hóa kiểu dữ liệu khi ghi báo cáo)

refactor(logs): use the same log format across workflows
test(wf1): test the application flow with sample data
test(wf2): test onboarding reminder emails