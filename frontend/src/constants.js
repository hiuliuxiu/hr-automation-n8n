// Từ điển dùng chung cho giao diện; mã trạng thái khớp bảng candidate_statuses và các ràng buộc trong DB.

// Lịch Google mà WF1 đọc chỗ trống và tạo sự kiện phỏng vấn (nhúng ở trang Lịch phỏng vấn)
export const HR_CALENDAR_ID = 'whateverholding246@gmail.com';

export const STATUS = {
  received: { label: 'AI đang đọc CV', tone: 'neutral' },
  awaiting_hr: { label: 'Chờ HR duyệt', tone: 'accent' },
  hr_overdue: { label: 'Quá hạn duyệt', tone: 'neg' },
  on_hold: { label: 'Tạm giữ', tone: 'warn' },
  awaiting_candidate: { label: 'Chờ ứng viên chọn giờ', tone: 'accent' },
  needs_scheduling: { label: 'Cần HR xếp lịch', tone: 'warn' },
  interview_scheduled: { label: 'Đã hẹn phỏng vấn', tone: 'accent' },
  interviewed: { label: 'Chờ kết quả phỏng vấn', tone: 'warn' },
  hired: { label: 'Nhận việc', tone: 'pos' },
  rejected: { label: 'Không phù hợp', tone: 'neutral' },
  withdrawn: { label: 'Ứng viên rút hồ sơ', tone: 'neutral' },
};

// 5 cột kanban. Trạng thái chi tiết hiện thành nhãn nhỏ trên thẻ.
export const COLUMNS = [
  // Hồ sơ AI đang đọc nằm luôn ở cột Cần HR duyệt (nhãn "AI đang đọc"), chưa kéo đi được cho tới khi có đánh giá
  { id: 'review', label: 'Cần HR duyệt', hint: 'Đọc đánh giá AI rồi quyết định', statuses: ['received', 'awaiting_hr', 'hr_overdue', 'on_hold'] },
  { id: 'invited', label: 'Mời phỏng vấn', hint: 'Ứng viên tự chọn giờ', statuses: ['awaiting_candidate', 'needs_scheduling', 'interview_scheduled'] },
  { id: 'interviewed', label: 'Đã phỏng vấn', hint: 'Chờ ghi kết quả', statuses: ['interviewed'] },
  { id: 'hired', label: 'Nhận việc', hint: 'Tự chuyển sang onboarding', statuses: ['hired'] },
  { id: 'rejected', label: 'Không phù hợp', hint: 'Đã gửi thư cảm ơn', statuses: ['rejected', 'withdrawn'] },
];
export const columnOf = (status) => (COLUMNS.find((c) => c.statuses.includes(status)) || COLUMNS[0]).id;

export const TOPIC = { training: 'Đào tạo', tools: 'Công cụ', schedule: 'Lịch làm việc', workload: 'Khối lượng việc', environment: 'Môi trường làm việc', other: 'Khác' };
export const WORKFLOWS = { WF1: 'Tuyển dụng', WF2: 'Onboarding', WF3: 'Phản hồi & hiệu suất', system: 'Hệ thống' };
export const OWNER = { hr: 'HR', it: 'IT', employee: 'Nhân viên', buddy: 'Buddy', manager: 'Quản lý' };
export const CATEGORY = { paperwork: 'Giấy tờ', access: 'Cấp quyền', social: 'Làm quen', training: 'Đào tạo', practice: 'Thực hành', review: 'Đánh giá' };
