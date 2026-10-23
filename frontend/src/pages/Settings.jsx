import { useState } from 'react';
import { FloppyDisk } from '@phosphor-icons/react';
import { WORKFLOWS } from '../constants.js';
import { useStore } from '../store.jsx';
import { Btn, Card, CardHead, Empty, PageHeader, Segmented, Tag, useToast } from '../components/ui.jsx';
import { when } from '../format.js';

const ALL_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:30', '14:00', '15:00', '16:00', '17:00'];
const LEVEL = { success: ['Thành công', 'pos'], info: ['Ghi nhận', 'neutral'], waiting: ['Đang chờ', 'accent'], skipped: ['Bỏ qua', 'neutral'], warning: ['Cảnh báo', 'warn'], error: ['Lỗi', 'neg'] };
// Các khóa HR được sửa từ giao diện (hàm hr_save_settings kiểm tra lại kiểu và khoảng giá trị)
const RECRUIT_KEYS = ['hr_notify_email', 'priority_score', 'hr_review_hours', 'candidate_choice_hours', 'interview_slots', 'interview_minutes', 'interview_window_days'];
const ONBOARD_KEYS = ['reminder_warn_days', 'reminder_cooldown_days', 'blocked_cooldown_days', 'require_proof', 'training_ai'];

function Row({ title, help, children }) {
  return (
    <div className="settings-grid">
      <div><h3>{title}</h3>{help && <p>{help}</p>}</div>
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>{children}</div>
    </div>
  );
}

// Một khung cài đặt: giữ bản nháp, chỉ gửi các khóa đã đổi
function useDraft(keys) {
  const { settings, saveSettings } = useStore();
  const toast = useToast();
  const pick = () => Object.fromEntries(keys.map((k) => [k, settings[k]]));
  const [f, setF] = useState(pick);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const changed = Object.fromEntries(keys.filter((k) => JSON.stringify(f[k]) !== JSON.stringify(settings[k])).map((k) => [k, f[k]]));
    if (!Object.keys(changed).length) { toast({ title: 'Không có thay đổi nào để lưu.' }); return; }
    setBusy(true);
    try {
      await saveSettings(changed);
      toast({ title: 'Đã lưu cài đặt', detail: 'Các luồng tự động dùng giá trị mới từ lần chạy tiếp theo.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Chưa lưu được cài đặt', detail: e.message });
    } finally { setBusy(false); }
  };
  return { f, set, save, busy };
}

function Recruiting() {
  const { f, set, save, busy } = useDraft(RECRUIT_KEYS);
  const slots = Array.isArray(f.interview_slots) ? f.interview_slots : [];
  const [from, to] = Array.isArray(f.interview_window_days) ? f.interview_window_days : [2, 15];
  const toggleSlot = (s) => set('interview_slots', slots.includes(s) ? slots.filter((x) => x !== s) : [...slots, s].sort());
  const extra = slots.filter((s) => !ALL_SLOTS.includes(s));
  return (
    <Card>
      <CardHead title="Quy trình tuyển dụng" meta="Các luồng n8n đọc những giá trị này từ cơ sở dữ liệu mỗi lần chạy.">
        <Btn kind="primary" icon={FloppyDisk} onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Btn>
      </CardHead>
      <Row title="Email nhận thông báo" help="Hồ sơ mới, quá hạn và lỗi hệ thống được gửi tới địa chỉ này.">
        <input className="input" type="email" value={f.hr_notify_email || ''} onChange={(e) => set('hr_notify_email', e.target.value.trim())} aria-label="Email nhận thông báo" />
      </Row>
      <Row title="Ngưỡng ưu tiên" help="Hồ sơ đạt từ mức này được đánh dấu nên ưu tiên xem. Mọi hồ sơ vẫn do HR quyết định.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input type="range" min="50" max="90" step="5" value={f.priority_score ?? 70} onChange={(e) => set('priority_score', Number(e.target.value))} aria-label="Ngưỡng ưu tiên" />
          <b className="num" style={{ minWidth: 64, textAlign: 'right' }}>{f.priority_score} điểm</b>
        </div>
      </Row>
      <Row title="Thời gian chờ HR duyệt" help="Quá thời gian này, hồ sơ được đánh dấu Quá hạn và bạn nhận nhắc nhở. Áp dụng cho hồ sơ nộp sau khi lưu.">
        <Segmented label="Thời gian chờ HR" value={f.hr_review_hours} onChange={(v) => set('hr_review_hours', v)} options={[24, 48, 72].map((h) => ({ value: h, label: `${h} giờ` }))} />
      </Row>
      <Row title="Thời gian ứng viên chọn giờ" help="Sau thời gian này, hồ sơ chuyển sang Cần HR xếp lịch.">
        <Segmented label="Thời gian chờ ứng viên" value={f.candidate_choice_hours} onChange={(v) => set('candidate_choice_hours', v)} options={[24, 48, 72].map((h) => ({ value: h, label: `${h} giờ` }))} />
      </Row>
      <Row title="Khung giờ phỏng vấn" help="Hệ thống chỉ đề xuất các khung giờ này, vào ngày làm việc, khi lịch của bạn còn trống (tối đa 2 khung mỗi ngày, 6 khung mỗi lời mời).">
        <div className="topics">{[...ALL_SLOTS, ...extra].map((s) => <button key={s} type="button" className="chip-toggle" aria-pressed={slots.includes(s)} onClick={() => toggleSlot(s)}>{s}</button>)}</div>
      </Row>
      <Row title="Khoảng ngày đề xuất" help="Khung giờ được tìm từ ngày thứ… đến ngày thứ… kể từ hôm mời.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input className="input" type="number" min="1" max="60" value={from} onChange={(e) => set('interview_window_days', [Number(e.target.value), to])} aria-label="Từ ngày" style={{ width: 96 }} />
          <span>đến</span>
          <input className="input" type="number" min="1" max="60" value={to} onChange={(e) => set('interview_window_days', [from, Number(e.target.value)])} aria-label="Đến ngày" style={{ width: 96 }} />
          <span className="muted">ngày</span>
        </div>
      </Row>
      <Row title="Thời lượng mỗi buổi">
        <Segmented label="Thời lượng" value={f.interview_minutes} onChange={(v) => set('interview_minutes', v)} options={[30, 45, 60].map((m) => ({ value: m, label: `${m} phút` }))} />
      </Row>
    </Card>
  );
}

function Onboarding() {
  const { settings } = useStore();
  const { f, set, save, busy } = useDraft(ONBOARD_KEYS);
  const days = (k, label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input className="input" type="number" min="0" max="30" value={f[k] ?? 0} onChange={(e) => set(k, Number(e.target.value))} aria-label={label} style={{ width: 96 }} />
      <span className="muted">ngày</span>
    </div>
  );
  return (
    <Card>
      <CardHead title="Nhắc việc onboarding" meta={`WF2 tự quét tiến độ và gửi nhắc lúc ${settings.reminder_time || '08:30'} các ngày làm việc (giờ chạy cài trong n8n).`}>
        <Btn kind="primary" icon={FloppyDisk} onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Btn>
      </CardHead>
      <Row title="Nhắc trước hạn" help="Đầu việc sắp đến hạn trong số ngày này được nhắc nhân viên.">{days('reminder_warn_days', 'Nhắc trước hạn')}</Row>
      <Row title="Nhắc lại sau" help="Một đầu việc đã nhắc thì chờ ít nhất số ngày này mới nhắc lại (nút Nhắc trên giao diện gửi ngay, bỏ qua giới hạn này).">{days('reminder_cooldown_days', 'Nhắc lại sau')}</Row>
      <Row title="Việc bị vướng nhắc lại sau" help="Đầu việc bị vướng được nhắc lại theo chu kỳ này.">{days('blocked_cooldown_days', 'Việc bị vướng nhắc lại sau')}</Row>
      <Row title="Bắt buộc minh chứng" help="Nhân viên phải đính kèm tệp hoặc link khi báo hoàn thành đầu việc.">
        <label className="check"><input type="checkbox" className="switch" checked={!!f.require_proof} onChange={(e) => set('require_proof', e.target.checked)} /> {f.require_proof ? 'Bắt buộc' : 'Không bắt buộc'}</label>
      </Row>
      <Row title="AI gợi ý khoá học" help="Khi tạo onboarding, AI chọn thêm khoá học phù hợp trong danh mục của công ty.">
        <label className="check"><input type="checkbox" className="switch" checked={!!f.training_ai} onChange={(e) => set('training_ai', e.target.checked)} /> {f.training_ai ? 'Đang bật' : 'Đang tắt'}</label>
      </Row>
    </Card>
  );
}

function Templates() {
  const { settings } = useStore();
  const minutes = settings.interview_minutes || 45, hours = settings.candidate_choice_hours || 24;
  return (
    <Card>
      <CardHead title="Email mời phỏng vấn" meta="Xem trước thư ứng viên nhận khi bạn chọn Mời phỏng vấn. Nội dung thư nằm trong workflow WF1 trên n8n." />
      <div className="mail-preview">
        <div className="mail-top"><b>ABC Tech</b><div style={{ opacity: 0.8 }}>Phòng Tuyển dụng</div></div>
        <div className="mail-body">
          <p>Chào bạn <b>Phạm Thu Trang</b>,</p>
          <p>Cảm ơn bạn đã quan tâm đến vị trí <b>IT Helpdesk</b>. Sau khi xem xét hồ sơ, ABC Tech trân trọng mời bạn tham gia buổi phỏng vấn trực tuyến để trao đổi thêm về kinh nghiệm, định hướng và công việc.</p>
          <p>Buổi phỏng vấn dự kiến kéo dài <b>{minutes} phút</b>, qua Google Meet.</p>
          <p>Vui lòng bấm nút bên dưới và chọn thời gian thuận tiện trong vòng <b>{hours} giờ</b>. Tất cả khung giờ được hiển thị theo giờ Việt Nam (UTC+7). Nếu chưa có thời gian phù hợp, bạn có thể chọn trao đổi khung giờ khác.</p>
          <div><span className="slot-pill">Chọn lịch phỏng vấn</span></div>
          <p>Lịch chỉ được xác nhận khi bạn nhận được thư xác nhận cùng lời mời Calendar. Đường dẫn Google Meet sẽ có trong thư đó.</p>
          <p>Trân trọng,<br /><b>Bộ phận Tuyển dụng — ABC Tech</b></p>
        </div>
      </div>
    </Card>
  );
}

function SystemLog() {
  const { logs } = useStore();
  return (
    <Card className="flush">
      <CardHead title="Nhật ký hệ thống" meta="Dành cho quản trị: 200 lần gần nhất các workflow n8n ghi một bước quan trọng" />
      {logs.length === 0 ? <div style={{ padding: 24 }}><Empty>Chưa có nhật ký nào.</Empty></div> : (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Thời điểm</th><th>Workflow</th><th>Nội dung</th><th>Kết quả</th><th className="n">Execution</th></tr></thead>
            <tbody>
              {logs.map((l) => {
                const [label, tone] = LEVEL[l.level] || [l.level, 'neutral'];
                return (
                  <tr key={l.id}>
                    <td className="nowrap muted">{when(l.at)}</td>
                    <td className="nowrap">{WORKFLOWS[l.wf] || l.wf}</td>
                    <td>{l.msg}<span className="sub"><code>{l.event}</code>{l.entity ? ` · ${l.entity}` : ''}</span></td>
                    <td><Tag tone={tone}>{label}</Tag></td>
                    <td className="n">{l.exec ? <code className="muted">#{l.exec}</code> : <span className="dash">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('process');
  return (
    <>
      <PageHeader eyebrow="Hệ thống" title="Cài đặt" sub="Các thông số mà luồng tuyển dụng, onboarding và phản hồi dùng khi tự chạy.">
        <Segmented label="Mục cài đặt" value={tab} onChange={setTab} options={[{ value: 'process', label: 'Quy trình' }, { value: 'mail', label: 'Email mẫu' }, { value: 'log', label: 'Nhật ký hệ thống' }]} />
      </PageHeader>
      <div className="bento">
        <div className="s-12" key={tab} style={{ display: 'grid', gap: 'var(--gap)' }}>
          {tab === 'process' && <><Recruiting /><Onboarding /></>}
          {tab === 'mail' && <Templates />}
          {tab === 'log' && <SystemLog />}
        </div>
      </div>
    </>
  );
}
