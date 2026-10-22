import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ListChecks, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { CATEGORY, COLUMNS, columnOf, OWNER } from '../constants.js';
import { useStore } from '../store.jsx';
import { Btn, Card, CardHead, Dialog, Drawer, Empty, PageHeader, Progress, Tag, useToast } from '../components/ui.jsx';
import { date } from '../format.js';

const STACK = { review: '#93b7d3', invited: '#3f7cac', interviewed: '#1f4a74', hired: '#142f4c', rejected: '#e3e7ec' };
const JOB_STATE = { open: 'Đang tuyển', paused: 'Tạm dừng', closed: 'Đã đóng' };
const splitSkills = (s) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

// Chạy một thao tác, báo kết quả bằng toast; trả về kết quả (hoặc null nếu lỗi)
function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (p, ok, fail, detail) => {
    setBusy(true);
    try { const r = await p(); toast({ title: typeof ok === 'function' ? ok(r) : ok, detail: typeof detail === 'function' ? detail(r) : detail }); return r || true; }
    catch (e) { toast({ tone: 'error', title: fail, detail: e.message }); return null; }
    finally { setBusy(false); }
  };
  return [run, busy];
}

function JobDialog({ job, onClose }) {
  const { jobs, saveJob } = useStore();
  const [run, busy] = useRun();
  const editing = !!job;
  const [f, setF] = useState(job
    ? { title: job.title, department: job.department, headcount: job.headcount, manager: job.manager, summary: job.summary, skills: job.skills.join('\n'), copyFrom: '' }
    : { title: '', department: '', headcount: 1, manager: '', summary: '', skills: '', copyFrom: jobs[0]?.id || '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const skills = splitSkills(f.skills);
  const save = async () => {
    if (!f.title.trim() || !f.department.trim()) { setErr('Cần nhập tên vị trí và phòng ban.'); return; }
    if (skills.length < 2 || skills.length > 10) { setErr('Cần 2–10 kỹ năng để AI chấm CV.'); return; }
    setErr('');
    const r = await run(() => saveJob({ id: job?.id, title: f.title.trim(), department: f.department.trim(), headcount: Number(f.headcount) || 1, manager: f.manager.trim(), summary: f.summary.trim(), skills, copyFrom: editing ? null : f.copyFrom || null }),
      (x) => (editing ? `Đã lưu vị trí ${f.title.trim()}` : `Đã mở vị trí ${x.job_id} · ${f.title.trim()}`), 'Chưa lưu được vị trí',
      (x) => (editing ? 'Kỹ năng mới áp dụng cho hồ sơ nộp từ bây giờ; điểm của hồ sơ cũ giữ nguyên.' : `Nhớ thêm “${x.job_id} | ${f.title.trim()}” vào danh sách vị trí của form ứng tuyển trên n8n (WF1) để ứng viên chọn được.`));
    if (r) onClose();
  };
  return (
    <Dialog open onClose={() => !busy && onClose()} title={editing ? `Sửa vị trí ${job.id}` : 'Mở vị trí tuyển dụng mới'}
      actions={<><Btn kind="plain" onClick={onClose} disabled={busy}>Huỷ</Btn><Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu vị trí' : 'Mở vị trí'}</Btn></>}>
      <div className="form-grid">
        <label className="field wide"><span>Tên vị trí</span><input className="input" value={f.title} onChange={set('title')} placeholder="Ví dụ: Chuyên viên bảo mật" /></label>
        <label className="field"><span>Phòng ban</span><input className="input" value={f.department} onChange={set('department')} placeholder="Ví dụ: IT Security" /></label>
        <label className="field"><span>Số người cần tuyển</span><input className="input" type="number" min="1" value={f.headcount} onChange={set('headcount')} /></label>
        <label className="field wide"><span>Quản lý tuyển dụng</span><input className="input" value={f.manager} onChange={set('manager')} placeholder="Ví dụ: Security Lead" /></label>
        <label className="field wide"><span>Mô tả công việc <small>(AI đọc kèm khi chấm CV)</small></span><textarea className="input" value={f.summary} onChange={set('summary')} style={{ minHeight: 72 }} /></label>
        <label className="field wide"><span>Kỹ năng yêu cầu <small>(mỗi dòng một kỹ năng, 2–10 kỹ năng; AI chấm CV theo đúng các kỹ năng này, mỗi kỹ năng phần điểm bằng nhau)</small></span>
          <textarea className="input" value={f.skills} onChange={set('skills')} placeholder={'Firewall\nSIEM\nXử lý sự cố'} />
        </label>
        {!editing && (
          <label className="field wide"><span>Checklist onboarding</span>
            <select className="input" value={f.copyFrom} onChange={set('copyFrom')}>
              <option value="">Chưa có, tôi tự thêm sau</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>Chép từ {j.title}</option>)}
            </select>
          </label>
        )}
      </div>
      {editing && <p className="muted" style={{ fontSize: 13 }}>Tên vị trí trên form ứng tuyển của n8n không tự đổi theo; mã {job.id} giữ nguyên nên hồ sơ vẫn vào đúng vị trí.</p>}
      {err && <p className="login-error" role="alert">{err}</p>}
    </Dialog>
  );
}

const EMPTY_TPL = { name: '', category: 'paperwork', ownerRole: 'hr', offset: 0, course: '', required: true };
function TemplateDialog({ value, onClose }) {
  const { courses, saveTemplate } = useStore();
  const [run, busy] = useRun();
  const [f, setF] = useState({ ...value, course: value.course || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    if (!f.name.trim()) return;
    const r = await run(() => saveTemplate({ ...f, name: f.name.trim(), offset: Number(f.offset) || 0 }), value.id ? 'Đã lưu đầu việc mẫu' : 'Đã thêm đầu việc mẫu', 'Chưa lưu được đầu việc', 'Áp dụng cho nhân viên mới từ lần tạo onboarding tiếp theo.');
    if (r) onClose();
  };
  return (
    <Dialog open onClose={() => !busy && onClose()} title={value.id ? 'Sửa đầu việc mẫu' : 'Thêm đầu việc mẫu'}
      actions={<><Btn kind="plain" onClick={onClose} disabled={busy}>Huỷ</Btn><Btn kind="primary" onClick={save} disabled={busy || !f.name.trim()}>{busy ? 'Đang lưu…' : 'Lưu'}</Btn></>}>
      <div className="form-grid">
        <label className="field wide"><span>Tên đầu việc</span><input className="input" value={f.name} onChange={set('name')} placeholder="Ví dụ: Cấp tài khoản VPN" /></label>
        <label className="field"><span>Nhóm</span><select className="input" value={f.category} onChange={set('category')}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Người phụ trách</span><select className="input" value={f.ownerRole} onChange={set('ownerRole')}>{Object.entries(OWNER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Hạn <small>(số ngày sau ngày vào làm)</small></span><input className="input" type="number" min="-30" max="365" value={f.offset} onChange={set('offset')} /></label>
        <label className="field"><span>Khoá học đi kèm</span><select className="input" value={f.course} onChange={set('course')}><option value="">Không có</option>{courses.filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="check wide"><input type="checkbox" checked={f.required} onChange={set('required')} /> Bắt buộc hoàn thành trước khi xét chính thức</label>
      </div>
    </Dialog>
  );
}

function Checklist({ job }) {
  const { templates, courseById, retireTemplate } = useStore();
  const [run, busy] = useRun();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const list = templates.filter((t) => t.job === job.id && t.status === 'active');
  return (
    <div>
      <div className="profile-head" style={{ marginBottom: 8 }}>
        <span className="todo-ico"><ListChecks size={22} weight="light" aria-hidden="true" /></span>
        <div style={{ flex: 1, minWidth: 0 }}><h2>Checklist onboarding</h2><p>{job.title} · {list.length} đầu việc</p></div>
      </div>
      <p className="muted" style={{ lineHeight: 1.6 }}>Khi một người nhận việc ở vị trí này, hệ thống tạo đầu việc theo danh sách dưới đây, hạn tính từ ngày vào làm. Sửa danh sách không ảnh hưởng nhân viên đã có checklist.</p>
      <div style={{ margin: '16px 0' }}><Btn kind="primary" size="sm" icon={Plus} onClick={() => setEditing({ ...EMPTY_TPL, job: job.id })}>Thêm đầu việc</Btn></div>
      {list.length === 0 && <Empty>Vị trí này chưa có checklist; nhân viên mới sẽ không có đầu việc onboarding nào.</Empty>}
      {list.map((t) => (
        <div className="tpl-row" key={t.id}>
          <div style={{ minWidth: 0 }}>
            <div className="item-title" style={{ fontWeight: 600 }}>{t.name}</div>
            <div className="item-sub">{CATEGORY[t.category]} · {OWNER[t.ownerRole]} · ngày {t.offset >= 0 ? '+' : ''}{t.offset}{t.course ? ` · ${courseById[t.course]?.name || t.course}` : ''}{t.required ? '' : ' · không bắt buộc'}</div>
          </div>
          <span className="row-actions">
            <button className="icon-btn sm" onClick={() => setEditing(t)} aria-label={`Sửa ${t.name}`} title="Sửa"><PencilSimple size={16} /></button>
            <button className="icon-btn sm" onClick={() => setRemoving(t)} aria-label={`Ngừng dùng ${t.name}`} title="Ngừng dùng"><Trash size={16} /></button>
          </span>
        </div>
      ))}
      {editing && <TemplateDialog value={editing} onClose={() => setEditing(null)} />}
      <Dialog open={!!removing} onClose={() => !busy && setRemoving(null)} title="Ngừng dùng đầu việc này?"
        actions={<><Btn kind="plain" onClick={() => setRemoving(null)} disabled={busy}>Huỷ</Btn>
          <Btn kind="danger" disabled={busy} onClick={async () => { if (await run(() => retireTemplate(removing), 'Đã bỏ đầu việc khỏi checklist', 'Chưa cập nhật được checklist')) setRemoving(null); }}>{busy ? 'Đang lưu…' : 'Ngừng dùng'}</Btn></>}>
        {removing && <p>“{removing.name}” không còn được giao cho nhân viên mới. Các đầu việc đã giao trước đây vẫn giữ nguyên.</p>}
      </Dialog>
    </div>
  );
}

export default function Jobs() {
  const { jobs, candidates, templates, setJobStatus } = useStore();
  const [run] = useRun();
  const [editing, setEditing] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const toggle = (j) => {
    const next = j.status === 'open' ? 'paused' : 'open';
    run(() => setJobStatus(j, next), next === 'open' ? `Đã mở lại ${j.title}` : `Đã tạm dừng tuyển ${j.title}`, 'Chưa đổi được trạng thái vị trí',
      next === 'open' ? 'Hồ sơ mới nộp vào vị trí này được nhận lại.' : 'Hồ sơ mới nộp vào vị trí này sẽ được báo là vị trí đã đóng.');
  };
  const openChecklist = jobs.find((j) => j.id === checklist);

  return (
    <>
      <PageHeader eyebrow="Tuyển dụng" title="Vị trí tuyển dụng" sub="Mỗi vị trí có danh sách kỹ năng riêng; AI dùng chính danh sách này để chấm điểm CV, mỗi kỹ năng một phần điểm bằng nhau.">
        <Btn kind="primary" icon={Plus} onClick={() => setEditing('new')}>Mở vị trí mới</Btn>
      </PageHeader>

      <div className="bento">
        {jobs.length === 0 && <div className="s-12"><Empty>Chưa có vị trí nào.</Empty></div>}
        {jobs.map((j) => {
          const mine = candidates.filter((c) => c.job === j.id);
          const hired = mine.filter((c) => c.status === 'hired').length;
          const tplN = templates.filter((t) => t.job === j.id && t.status === 'active').length;
          const rubric = j.skills.map((s, k) => ({ s, max: Math.floor(100 / j.skills.length) + (k < 100 % j.skills.length ? 1 : 0) }));
          return (
            <Card span={6} key={j.id}>
              <CardHead title={j.title} meta={`${j.id} · ${j.department}${j.manager ? ` · quản lý tuyển dụng: ${j.manager}` : ''} · mở từ ${date(j.posted)}`}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                  <span className={j.open ? '' : 'muted'}>{JOB_STATE[j.status] || j.status}</span>
                  <input type="checkbox" className="switch" checked={j.open} onChange={() => toggle(j)} aria-label={`Đang tuyển ${j.title}`} />
                </label>
              </CardHead>
              {j.summary && <p className="muted" style={{ marginTop: -6, marginBottom: 18, lineHeight: 1.6 }}>{j.summary}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
                <div><div className="kpi-note" style={{ marginTop: 0 }}>Cần tuyển</div><div className="kpi-big" style={{ fontSize: 28 }}>{j.headcount}</div></div>
                <div><div className="kpi-note" style={{ marginTop: 0 }}>Đã nhận việc</div><div className="kpi-big" style={{ fontSize: 28 }}>{hired}</div></div>
                <div><div className="kpi-note" style={{ marginTop: 0 }}>Hồ sơ</div><div className="kpi-big" style={{ fontSize: 28 }}>{mine.length}</div></div>
              </div>
              <Progress value={Math.min(hired, j.headcount)} total={j.headcount} />
              <div className="section-title">Hồ sơ theo bước</div>
              <div className="stack-bar" role="img" aria-label="Hồ sơ theo bước">
                {COLUMNS.map((col) => { const n = mine.filter((c) => columnOf(c.status) === col.id).length; return n ? <span key={col.id} style={{ flex: n, background: STACK[col.id] }} title={`${col.label}: ${n}`} /> : null; })}
                {mine.length === 0 && <span style={{ flex: 1 }} />}
              </div>
              <div className="legend" style={{ marginTop: 10 }}>
                {COLUMNS.map((col) => { const n = mine.filter((c) => columnOf(c.status) === col.id).length; return n ? <span key={col.id}><i style={{ background: STACK[col.id] }} />{col.label} {n}</span> : null; })}
                {mine.length === 0 && <span>Chưa có hồ sơ</span>}
              </div>
              <div className="section-title">Kỹ năng AI dùng để chấm</div>
              <div className="skill-chips">{rubric.map((r) => <Tag key={r.s} tone="accent">{r.s} · {r.max}đ</Tag>)}</div>
              <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Btn size="sm" icon={PencilSimple} onClick={() => setEditing(j)}>Sửa vị trí</Btn>
                <Btn size="sm" icon={ListChecks} onClick={() => setChecklist(j.id)}>Checklist onboarding · {tplN}</Btn>
                <span className="spacer" style={{ flex: 1 }} />
                <Link className="link" to={`/ung-vien?vi-tri=${j.id}`}>Xem {mine.length} ứng viên <ArrowRight size={14} /></Link>
              </div>
            </Card>
          );
        })}
      </div>
      {editing && <JobDialog job={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <Drawer open={!!openChecklist} onClose={() => setChecklist(null)} label="Checklist onboarding">
        {openChecklist && <Checklist job={openChecklist} />}
      </Drawer>
    </>
  );
}
