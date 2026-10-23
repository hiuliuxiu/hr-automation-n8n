import { Link } from 'react-router-dom';
import { ArrowsOut, CheckCircle, FilePdf, VideoCamera, WarningCircle } from '@phosphor-icons/react';
import { ACTIONS, actionsFor, useStore } from '../store.jsx';
import { useAct } from './MoveFlow.jsx';
import { Avatar, Btn, Score, StatusTag, Tag, WaitBar } from './ui.jsx';
import { date, left, shortDate, span, time, when } from '../format.js';

const LEVEL = ['Chưa thấy trong CV', 'Chỉ liệt kê', 'Có việc làm cụ thể'];
const ACTOR = { hr: 'HR', candidate: 'Ứng viên', system: 'Hệ thống', migration: 'Chuyển dữ liệu' };

export function nextStep(c, employeeById = {}) {
  switch (c.status) {
    case 'received': return `AI đang đọc CV, nộp ${when(c.applied)}`;
    case 'awaiting_hr': return c.waitFor ? `Duyệt trước ${when(c.waitFor.until)}` : 'Chờ HR duyệt';
    case 'hr_overdue': return c.waitFor ? `Quá hạn duyệt ${span(left(c.waitFor.until))}` : 'Quá hạn duyệt';
    case 'on_hold': return c.hrNote ? `Tạm giữ: ${c.hrNote.split('\n').at(-1)}` : 'Tạm giữ, chưa gửi gì cho ứng viên';
    case 'awaiting_candidate': return c.waitFor ? `Chờ ứng viên chọn giờ, còn ${span(left(c.waitFor.until))}` : 'Chờ ứng viên chọn giờ';
    case 'needs_scheduling': return 'Cần HR xếp lịch lại hoặc gửi lại khung giờ';
    case 'interview_scheduled': return c.interview ? `Phỏng vấn ${when(c.interview.start)}` : 'Đã hẹn phỏng vấn';
    case 'interviewed': return 'Ghi kết quả phỏng vấn';
    case 'hired': { const e = employeeById[c.employee]; return e ? `Bắt đầu làm ${shortDate(e.start)}` : 'Đang tạo hồ sơ nhân viên'; }
    case 'rejected': return 'Đã gửi thư cảm ơn';
    case 'withdrawn': return 'Ứng viên đã rút hồ sơ';
    default: return '';
  }
}

export function ProfileHeader({ c, full = false }) {
  return (
    <div className="profile-head">
      <Avatar name={c.name} size={56} />
      <div style={{ minWidth: 0, flex: 1 }}>
        {full ? <h1>{c.name}</h1> : <h2>{c.name}</h2>}
        <p>{c.jobTitle} · {c.id} · nộp {date(c.applied)}</p>
        <div className="topics" style={{ marginTop: 8 }}><StatusTag status={c.status} />{c.sample && <Tag>Hồ sơ mẫu</Tag>}</div>
      </div>
      {!full && <Link className="icon-btn" to={`/ung-vien/${c.id}`} title="Mở trang đầy đủ" aria-label="Mở trang đầy đủ" style={{ marginRight: 4 }}><ArrowsOut size={18} weight="light" /></Link>}
    </div>
  );
}

export function Actions({ c }) {
  const act = useAct();
  return (
    <div className="actions-bar">
      {actionsFor(c).map((k) => <Btn key={k} kind={ACTIONS[k].kind} onClick={() => act(c, k)}>{ACTIONS[k].label}</Btn>)}
      {c.interview?.meet && c.status === 'interview_scheduled' && <Btn as="a" href={c.interview.meet} target="_blank" rel="noreferrer" icon={VideoCamera}>Google Meet</Btn>}
      {c.cvUrl && <Btn as="a" href={c.cvUrl} target="_blank" rel="noreferrer" icon={FilePdf}>CV gốc</Btn>}
    </div>
  );
}

export function ScorePanel({ c }) {
  const { settings } = useStore();
  const priority = Number(settings.priority_score) || 70;
  return (
    <>
      <div className="score-panel">
        <Score value={c.score} big />
        <p>{c.summary || (c.status === 'received' ? 'AI đang đọc CV, kết quả có sau khoảng 2 phút.' : 'Chưa có tóm tắt của AI.')} {c.score >= priority && <b>Từ {priority} điểm: nên ưu tiên xem.</b>}</p>
      </div>
      {c.waitFor && (
        <div style={{ marginBottom: 8 }}>
          <div className="section-title" style={{ marginTop: 0 }}>{c.waitFor.who === 'HR' ? `Hạn duyệt: ${when(c.waitFor.until)}` : `Hạn ứng viên chọn giờ: ${when(c.waitFor.until)}`}</div>
          <WaitBar wait={c.waitFor} />
        </div>
      )}
    </>
  );
}

export function Rubric({ c }) {
  if (!c.rubric) return c.score != null ? <div className="empty">Hồ sơ này được chấm trước khi có thang điểm theo tiêu chí.</div> : null;
  return (
    <>
      <div className="section-title">Đánh giá theo từng kỹ năng</div>
      <div>
        {c.rubric.map((r) => (
          <div className="crit" key={r.id}>
            <div><div className="crit-name">{r.criterion}</div><div className="crit-level">{r.verified ? LEVEL[r.level] : 'Cần HR xác minh, tạm tính 0'}</div></div>
            <div className="lv" role="img" aria-label={`Mức ${r.level}/2`}><span className={r.level >= 1 ? 'on' : ''} /><span className={r.level >= 2 ? 'on' : ''} /></div>
            <div className="crit-pts">{Number(r.points).toLocaleString('vi-VN')}<small>/{r.max}</small></div>
            {r.level > 0 && r.quote && (
              <div className="quote">“{r.quote}”{r.verified
                ? <span className="ok"><CheckCircle size={14} weight="fill" aria-hidden="true" />có trong CV</span>
                : <span className="ok" style={{ color: 'var(--warn)' }}><WarningCircle size={14} weight="fill" aria-hidden="true" />chưa khớp CV</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function Asks({ c }) {
  const fromRubric = c.rubric?.filter((r) => r.question).map((r) => [r.criterion, r.question]) || [];
  const asks = fromRubric.length ? fromRubric : c.questions.map((q) => [null, q]);
  if (!asks.length && !c.verify.length) return null;
  return (
    <>
      <div className="section-title">Nên hỏi khi phỏng vấn</div>
      {asks.length > 0 && <ul className="asks">{asks.map(([k, q]) => <li key={q}>{k && <b>{k}: </b>}{q}</li>)}</ul>}
      {c.verify.length > 0 && <div className="topics" style={{ marginTop: 10 }}>{c.verify.map((v) => <Tag key={v} tone="warn">Cần xác minh: {v}</Tag>)}</div>}
    </>
  );
}

export function Contact({ c }) {
  return (
    <>
      <div className="section-title">Liên hệ</div>
      <dl className="kv">
        <div><dt>Email</dt><dd>{c.email}</dd></div>
        <div><dt>Điện thoại</dt><dd className="num">{c.phone || <span className="dash">—</span>}</dd></div>
        <div><dt>Tự giới thiệu là</dt><dd>{c.declared || <span className="dash">—</span>}</dd></div>
        <div><dt>Đồng ý xử lý dữ liệu</dt><dd className="num">{c.consent ? date(c.consent) : <span className="dash">—</span>}</dd></div>
      </dl>
      {c.cover && <><div className="section-title">Thư ứng tuyển</div><p className="cv-text">{c.cover}</p></>}
      {c.hrNote && <><div className="section-title">Ghi chú nội bộ</div><p className="cv-text">{c.hrNote}</p></>}
    </>
  );
}

function eventText(e, c, s) {
  switch (e.to_status) {
    case 'received': return ['Nộp hồ sơ', e.actor === 'migration' ? 'Chuyển từ Google Sheets.' : 'Đã gửi thư xác nhận cho ứng viên.'];
    case 'awaiting_hr': return [`AI đọc CV${c.score != null ? `, chấm ${c.score}/100` : ''}`, 'Đã gửi tóm tắt cho HR qua email.'];
    case 'hr_overdue': return ['Quá hạn duyệt', `Quá ${s.hr_review_hours || 72} giờ chưa có quyết định của HR.`];
    case 'on_hold': return ['Tạm giữ hồ sơ', 'Chưa gửi gì cho ứng viên.'];
    case 'awaiting_candidate': return ['Mời phỏng vấn', 'Hệ thống gửi các khung giờ trống cho ứng viên.'];
    case 'needs_scheduling': return ['Cần HR xếp lịch', 'Ứng viên xin đổi giờ, quá hạn chọn hoặc không còn khung trống.'];
    case 'interview_scheduled': return ['Đặt lịch phỏng vấn', c.interview ? `${shortDate(c.interview.start)} ${time(c.interview.start)}–${time(c.interview.end)}, có link Google Meet.` : 'Đã tạo lịch và link Google Meet.'];
    case 'interviewed': return ['Đã phỏng vấn', 'Chờ ghi kết quả.'];
    case 'hired': return ['Nhận việc', 'Chuyển sang onboarding.'];
    case 'rejected': return ['Đóng hồ sơ', 'Đã gửi thư cảm ơn.'];
    case 'withdrawn': return ['Ứng viên rút hồ sơ', 'Dừng sắp xếp phỏng vấn.'];
    default: return [e.to_status, ''];
  }
}

export function History({ c }) {
  const { settings } = useStore();
  const ev = [...c.events].reverse();
  return (
    <>
      <div className="section-title">Lịch sử</div>
      <ol className="timeline">
        {ev.map((e) => {
          const [t, d] = eventText(e, c, settings);
          return (
            <li className="tl" key={e.event_id}><span className="tl-dot" />
              <div className="tl-body"><b>{t}</b><p>{shortDate(e.occurred_at)} {time(e.occurred_at)} · {ACTOR[e.actor] || e.actor} · {d}{e.note ? ` ${e.note}` : ''}</p></div>
            </li>
          );
        })}
        {ev.length === 0 && <li className="tl"><span className="tl-dot" /><div className="tl-body"><b>Nộp hồ sơ</b><p>{shortDate(c.applied)} {time(c.applied)}</p></div></li>}
      </ol>
    </>
  );
}

export function CVText({ c }) {
  if (!c.cv) return null;
  return (<><div className="section-title">Nội dung CV</div><p className="cv-text">{c.cv}</p></>);
}

// Toàn bộ hồ sơ trong ngăn trượt
export default function CandidateProfile({ c }) {
  return (
    <div>
      <ProfileHeader c={c} />
      <ScorePanel c={c} />
      <Actions c={c} />
      <Rubric c={c} />
      <Asks c={c} />
      <Contact c={c} />
      <History c={c} />
    </div>
  );
}
