import { useState } from 'react';
import { BellRinging, MagnifyingGlass } from '@phosphor-icons/react';
import { kpiRate, onboarding } from '../derive.js';
import { useStore } from '../store.jsx';
import { Avatar, Btn, Card, Drawer, PageHeader, Progress, Select, Tag, useToast } from '../components/ui.jsx';
import { date, daysBetween, shortDate, today } from '../format.js';

export const STATE_LABEL = { done: 'Xong', submitted: 'Chờ HR duyệt', late: 'Quá hạn', blocked: 'Bị vướng', pending: 'Đang làm' };
export const STATE_TONE = { done: 'pos', submitted: 'accent', late: 'neg', blocked: 'warn', pending: 'neutral' };
const EMPLOYMENT = { probation: ['Thử việc', 'accent'], official: ['Chính thức', 'pos'], resigned: ['Đã nghỉ', 'neutral'] };
const TRAINING = { completed: ['Hoàn thành', 'pos'], in_progress: ['Đang học', 'neutral'], not_started: ['Chưa bắt đầu', 'neutral'] };

export function useRemindEmployee() {
  const { remindEmployee } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const remind = async (e) => {
    setBusy(e.id);
    try { const r = await remindEmployee(e); toast({ title: r?.message || `Đã nhắc ${e.name}` }); }
    catch (err) { toast({ tone: 'error', title: `Chưa nhắc được ${e.name}`, detail: err.message }); }
    finally { setBusy(null); }
  };
  return [remind, busy];
}

function Profile({ e }) {
  const { jobById, kpi, trainings, courseById } = useStore();
  const [remind, busy] = useRemindEmployee();
  const job = jobById[e.job];
  const lastPeriod = kpi.filter((k) => k.emp === e.id).map((k) => k.period).sort().at(-1);
  const rate = lastPeriod ? kpiRate(kpi, e.id, lastPeriod) : null;
  const learning = trainings.filter((t) => t.emp === e.id);
  const [label, tone] = EMPLOYMENT[e.status] || [e.status, 'neutral'];
  return (
    <div>
      <div className="profile-head">
        <Avatar name={e.name} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}><h2>{e.name}</h2><p>{job?.title} · {job?.department} · {e.id}</p></div>
        {e.sample && <Tag>Dữ liệu mẫu</Tag>}
        <Tag tone={tone}>{label}</Tag>
      </div>
      <dl className="kv">
        <div><dt>Email</dt><dd>{e.email}</dd></div>
        <div><dt>Ngày vào làm</dt><dd>{date(e.start)}</dd></div>
        <div><dt>Hết thử việc</dt><dd>{date(e.probationEnd)} · còn {daysBetween(today(), e.probationEnd)} ngày</dd></div>
        <div><dt>Quản lý trực tiếp</dt><dd>{e.manager || <span className="dash">—</span>}</dd></div>
        <div><dt>Buddy</dt><dd>{e.buddy || <span className="dash">—</span>}</dd></div>
        <div><dt>Công cụ làm việc</dt><dd>{e.tools === 'confirmed' ? 'Đã cấp đủ' : 'Chờ IT xác nhận'}</dd></div>
        <div><dt>KPI gần nhất</dt><dd>{rate != null ? `${rate}% · ${lastPeriod.slice(5)}` : <span className="dash">Chưa có</span>}</dd></div>
      </dl>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1 }}>Checklist onboarding · {e.done}/{e.total}</span>
        {e.done < e.total && <Btn size="sm" icon={BellRinging} disabled={busy === e.id} onClick={() => remind(e)}>{busy === e.id ? 'Đang gửi…' : 'Nhắc việc'}</Btn>}
      </div>
      <div className="list">
        {e.tasks.map((t) => (
          <div className="item" key={t.id} style={{ minHeight: 52 }}>
            <div className="item-main"><div className="item-title" style={{ fontWeight: 500 }}>{t.name}</div><div className="item-sub">{t.owner} · hạn {shortDate(t.due)}{t.note ? ` · ${t.note}` : ''}</div></div>
            <Tag tone={STATE_TONE[t.state]}>{STATE_LABEL[t.state]}</Tag>
          </div>
        ))}
      </div>
      {learning.length > 0 && <>
        <div className="section-title">Khoá học</div>
        <div className="list">
          {learning.map((t) => {
            const c = courseById[t.course];
            const late = t.status !== 'completed' && t.due && t.due < today();
            const [lb, tn] = late ? ['Quá hạn', 'neg'] : TRAINING[t.status] || [t.status, 'neutral'];
            return (
              <div className="item" key={t.id} style={{ minHeight: 52 }}>
                <div className="item-main"><div className="item-title" style={{ fontWeight: 500 }}>{c?.name || t.course}</div><div className="item-sub">{c?.hours ? `${c.hours} giờ · ` : ''}{t.due ? `hạn ${shortDate(t.due)}` : 'không có hạn'}</div></div>
                <Tag tone={tn}>{lb}</Tag>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

export default function Employees() {
  const { employees, tasks, jobById } = useStore();
  const people = onboarding(employees, tasks);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [openId, setOpenId] = useState(null);
  const deptOf = (p) => jobById[p.job]?.department || '—';
  const depts = [...new Set(people.map(deptOf))];
  const rows = people
    .filter((p) => dept === 'all' || deptOf(p) === dept)
    .filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const open = people.find((p) => p.id === openId);
  const onProbation = people.filter((p) => p.status === 'probation').length;

  return (
    <>
      <PageHeader eyebrow="Nhân sự" title="Nhân viên" sub={`${people.length} nhân viên (${onProbation} đang thử việc), ở ${depts.length} phòng ban. Bấm vào một người để xem checklist, khoá học và KPI.`} />
      <div className="toolbar rise" style={{ '--i': 1 }}>
        <label className="search">
          <MagnifyingGlass size={18} weight="light" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm nhân viên theo tên" aria-label="Tìm nhân viên" />
        </label>
        <Select label="Lọc theo phòng ban" value={dept} onChange={setDept} options={[{ value: 'all', label: 'Mọi phòng ban' }, ...depts.map((d) => ({ value: d, label: d }))]} />
        <span className="spacer" />
        <span className="muted num">{rows.length} người</span>
      </div>
      <div className="bento">
        {rows.map((p) => (
          <Card span={4} className="emp-card" key={p.id} as="article" onClick={() => setOpenId(p.id)} onKeyDown={(ev) => ev.key === 'Enter' && setOpenId(p.id)} tabIndex={0} aria-label={`Xem ${p.name}`}>
            <div className="emp-top">
              <Avatar name={p.name} size={52} />
              <div style={{ minWidth: 0, flex: 1 }}><b>{p.name}</b><small>{jobById[p.job]?.title}</small></div>
              {p.late > 0 ? <Tag tone="neg">{p.late} việc trễ</Tag> : p.blocked > 0 ? <Tag tone="warn">{p.blocked} việc vướng</Tag> : <Tag tone="pos">Đúng tiến độ</Tag>}
            </div>
            <dl className="facts">
              <div><dt>Phòng ban</dt><dd>{deptOf(p)}</dd></div>
              <div><dt>Ngày vào làm</dt><dd className="num">{date(p.start)}</dd></div>
              <div><dt>Quản lý</dt><dd>{p.manager || '—'}</dd></div>
              <div><dt>Hết thử việc</dt><dd className="num">{shortDate(p.probationEnd)} · còn {daysBetween(today(), p.probationEnd)} ngày</dd></div>
            </dl>
            <div>
              <div className="kpi-note" style={{ marginTop: 0, marginBottom: 8 }}>Checklist onboarding · {p.done}/{p.total}</div>
              <Progress value={p.done} total={p.total} />
            </div>
          </Card>
        ))}
      </div>
      <Drawer open={!!open} onClose={() => setOpenId(null)} label={open ? open.name : 'Nhân viên'}>
        {open && <Profile e={open} />}
      </Drawer>
    </>
  );
}
