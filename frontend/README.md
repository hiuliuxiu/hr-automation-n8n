# Cổng HR ABC Tech (giao diện)

Giao diện web chỉ dành cho phòng Nhân sự. Ứng viên vẫn nộp hồ sơ qua form n8n, nhân viên gửi phản hồi qua form n8n; giao diện này không có trang nào cho người ngoài.

## Chạy trên máy

```bash
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173. **Phải đúng cổng 5173** (hoặc `127.0.0.1:5173`): API cổng HR trên n8n chỉ cho phép hai địa chỉ này gọi vào. Nếu cổng đang bận, tắt tiến trình đang giữ nó thay vì để Vite tự chuyển sang 5174.

Cấu hình nằm trong `frontend/.env.local` (không đưa lên git). Sao chép từ `.env.example`:

| Biến | Ý nghĩa |
|---|---|
| `VITE_SUPABASE_URL` | Địa chỉ project Supabase "HR Automation" |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Khóa publishable (công khai). Quyền đọc/ghi thật do RLS và `app_settings.hr_accounts` quyết định |
| `VITE_HR_API_URL` | Webhook "API cổng HR" của n8n: `https://huylg.app.n8n.cloud/webhook/hr-api` |
| `VITE_HR_ADMIN_EMAIL` | Gõ `admin` ở trang đăng nhập sẽ đăng nhập bằng email này |

Đổi `.env.local` thì phải tắt và chạy lại `npm run dev`.

## Đăng nhập

- Tài khoản Supabase Auth của phòng Nhân sự (ba HR dùng chung). Không có trang đăng ký; tạo hoặc đổi mật khẩu trong Supabase Dashboard → Authentication.
- Ô "Tài khoản" nhận `admin` hoặc email.
- Chỉ email nằm trong `app_settings.hr_accounts` mới vào được; tài khoản khác bị đăng xuất ngay với thông báo "Tài khoản này không có quyền vào cổng HR".

## Dữ liệu đi đâu

| Loại thao tác | Đi qua | Ví dụ |
|---|---|---|
| Đọc mọi dữ liệu | Supabase trực tiếp (RLS chỉ cho HR đọc) | bảng ứng viên, nhân viên, KPI, nhật ký |
| Ghi đơn giản, không gửi email | Hàm `hr_*` trong DB (`database/schema.sql`, mục 11) | đánh dấu đã phỏng vấn, mở lại hồ sơ, cài đặt, KPI, vị trí, checklist mẫu, trạng thái việc hỗ trợ |
| Có gửi email, đụng lịch, hoặc đánh thức workflow đang chờ | API cổng HR trên n8n | mời phỏng vấn, tạm giữ, đóng hồ sơ, nhận việc, nhắc ứng viên, duyệt/trả lại báo cáo onboarding, nhắc nhân viên, duyệt đề xuất hỗ trợ |

Danh sách thao tác của API và cách nó xác minh đăng nhập: xem mục "API cổng HR" trong `workflows/README.md`.

Trang tự cập nhật qua Supabase Realtime khi workflow hoặc HR khác ghi vào DB (12 bảng), và tải lại khi quay lại tab. Mọi giờ hiển thị theo giờ Việt Nam.

## Mã nguồn

| File | Vai trò |
|---|---|
| `src/lib/supabase.js` | Kết nối Supabase |
| `src/lib/api.js` | `callApi` (gọi API cổng HR kèm token đăng nhập) và `rpc` (gọi hàm `hr_*`) |
| `src/auth.jsx` | Trang đăng nhập, kiểm tra quyền HR, đăng xuất |
| `src/store.jsx` | Tải và chuyển dữ liệu DB sang dạng các trang dùng, Realtime, danh sách thao tác trên hồ sơ (`ACTIONS`), luật kéo thả |
| `src/constants.js` | Trạng thái hồ sơ, cột kanban, nhãn chủ đề, người phụ trách, nhóm đầu việc |
| `src/derive.js` | Số liệu tổng hợp: phễu tuyển dụng, hồ sơ theo tuần, tiến độ onboarding, KPI, mức hài lòng |
| `src/components/MoveFlow.jsx` | Hộp xác nhận dùng chung cho mọi thao tác trên hồ sơ |
| `src/pages/*` | Các trang |

## Kết quả chạy thử (22/10/2026)

Chạy trên `npm run dev`, đăng nhập bằng tài khoản HR thật, thao tác trên hồ sơ mẫu (`is_sample`); email chỉ gửi tới alias `whateverholding246+…`. Trong lúc thử các nút của WF2, `wf2_send_to_real_email` được tạm tắt để thư nhân viên về hộp thư HR.

| Trang | Đã thử | Kết quả |
|---|---|---|
| Đăng nhập | để trống, đăng nhập `admin`, đăng xuất | Đạt |
| Ứng viên | Tạm giữ, Mời phỏng vấn (WF1 gửi 6 khung giờ), Nhắc chọn giờ, Mở lại hồ sơ, Không phù hợp (thư cảm ơn), kéo thả sang Đã phỏng vấn, kéo thả bị chặn khi ứng viên chưa chọn giờ | Đạt; trạng thái do WF1 ghi hiện lên sau vài giây nhờ Realtime |
| Lịch phỏng vấn | Đạt, nhận việc (WF2 tạo nhân viên + 14 đầu việc + 4 khoá) | Đạt |
| Onboarding | Duyệt báo cáo, Trả lại kèm nhận xét, Nhắc việc (gửi ngay 4 đầu việc) | Đạt |
| Phản hồi & KPI | Không cần hỗ trợ (WF3 ghi `declined`, không gửi email), Xong / Huỷ việc hỗ trợ, nhập · sửa · xoá KPI | Đạt |
| Vị trí tuyển dụng | Tạo vị trí chép checklist, sửa số lượng và kỹ năng, tạm dừng; thêm · sửa · ngừng dùng đầu việc mẫu | Đạt |
| Cài đặt | Bật/tắt khung giờ, lưu và hoàn lại | Đạt |

Chưa thử trên giao diện: nhánh "Duyệt và tạo việc hỗ trợ" của phản hồi (gửi email cho nhân viên; đã thử trực tiếp qua API ở giai đoạn 2) và đường gửi quyết định vào form chờ của WF1/WF3 bằng nút trên giao diện (đã thử qua API).

Sau khi thử, dữ liệu được đưa về như trước: hồ sơ mẫu về trạng thái cũ, xoá nhân viên/vị trí/KPI/nhật ký thử, đặt lại các bộ đếm mã, bật lại `wf2_send_to_real_email`. Email thử vẫn nằm trong hộp thư HR.

## Lưu ý vận hành

- Checklist chép từ vị trí khác giữ nguyên tên đầu việc gốc (có chỗ nhắc mã vị trí cũ); nên sửa lại cho đúng vị trí mới.

- Email đã gửi thì không thu hồi được, nên không có nút hoàn tác. Hồ sơ đóng nhầm thì dùng "Mở lại hồ sơ" (không gửi gì cho ứng viên).
- Thêm vị trí mới trên giao diện **không** tự thêm vào danh sách chọn của form ứng tuyển n8n. Sau khi tạo, thêm dòng `JOB-xxx | Tên vị trí` vào node form của WF1. Tạm dừng vị trí thì WF1 tự trả lời "vị trí đã đóng" cho hồ sơ mới.
- Đổi kỹ năng của vị trí chỉ áp dụng cho hồ sơ nộp sau; điểm AI của hồ sơ cũ giữ nguyên.
- Sửa checklist mẫu chỉ áp dụng cho nhân viên nhận việc sau đó.
- Lịch Google trên trang "Lịch phỏng vấn" chỉ hiện khi trình duyệt đang đăng nhập Google bằng tài khoản tuyển dụng.
- Các nút trên giao diện gọi WF1/WF2/WF3 theo **bản nháp mới nhất** trên n8n. Sửa nháp là ảnh hưởng ngay.
