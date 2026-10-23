import { useState } from 'react';
import { Check, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { TOPIC } from '../constants.js';
import { kpiSeries, satisfaction } from '../derive.js';
import { useStore } from '../store.jsx';
import { Avatar, Btn, Card, CardHead, Dialog, Empty, PageHeader, Select, Tag, useToast } from '../components/ui.jsx';
import { KpiLines, SatisfactionArea, SERIES } from '../components/charts.jsx';
import { date, isoWeek, shortDate, today } from '../format.js';

const STATE = { pending_hr: ['Chờ bạn duyệt', 'accent'], action_open: ['Đang hỗ trợ', 'warn'], reviewed: ['Đã xem', 'neutral'], declined: ['Không cần hỗ trợ', 'neutral'] };
const one = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const rateOf = (k) => Math.round((k.actual / k.target) * 100);

function Sat({ n }) {
  return <span className="sat" role="img" aria-label={`Hài lòng ${n}/5`}>{[1, 2, 3, 4, 5].map((k) => <i key={k} className={k <= n ? 'on' : ''} />)}</span>;
}

// Chạy một thao tác, báo kết quả bằng toast; trả về true nếu thành công
function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (p, ok, fail) => {
    setBusy(true);
    try { const r = await p(); toast({ title: r?.message || ok }); return true; }
    catch (e) { toast({ tone: 'error', title: fail, detail: e.message }); return false; }
    finally { setBusy(false); }
  };
  return [run, busy];
}

function Inbox() {
  const { feedback, employeeById, decideFeedback } = useStore();
  const [run, busy] = useRun();
  const list = [...feedback].sort((a, b) => (b.status === 'pending_hr') - (a.status === 'pending_hr') || b.submitted.localeCompare(a.submitted) || b.id.localeCompare(a.id));
  const [sel, setSel] = useState(list[0]?.id);
  const [note, setNote] = useState('');
  const f = feedback.find((x) => x.id === sel) || list[0];
  if (!f) return <Card span={12}><Empty>Chưa có phản hồi nào của nhân viên.</Empty></Card>;
  const e = employeeById[f.emp] || { name: f.emp };
  const decide = async (ok) => {
    const done = await run(() => decideFeedback(f, ok ? 'approve' : 'decline', note.trim()),
      ok ? `Đã duyệt và tạo việc hỗ trợ cho ${e.name}` : 'Đã ghi nhận, không tạo việc hỗ trợ', 'Chưa ghi nhận được quyết định');
    if (done) setNote('');
  };
  return (
    <Card span={12} className="flush">
      <div className="inbox">
        <div className="inbox-list" role="listbox" aria-label="Phản hồi của nhân viên">
          {list.map((x) => {
            const [label, tone] = STATE[x.status] || [x.status, 'neutral'];
            return (
              <button key={x.id} className="inbox-item" role="option" aria-selected={x.id === f.id} onClick={() => { setSel(x.id); setNote(''); }}>
                <span className="inbox-top"><b>{employeeById[x.emp]?.name || x.emp}</b><time>Tuần {x.period.slice(6)} · {shortDate(x.submitted)}</time></span>
                <span className="inbox-text">{x.text}</span>
                <span className="topics"><Tag tone={tone}>{label}</Tag><Tag>{TOPIC[x.topic] || x.topic}</Tag></span>
              </button>
            );
          })}
        </div>
        <div className="inbox-detail">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={e.name} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{e.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{f.id} · tuần {f.period.slice(6)} · gửi {date(f.submitted)}{f.satisfaction ? <> · hài lòng <Sat n={f.satisfaction} /> {f.satisfaction}/5</> : null}</div>
            </div>
            <Tag tone={STATE[f.status]?.[1]}>{STATE[f.status]?.[0] || f.status}</Tag>
          </div>
          <blockquote className="said">“{f.text}”</blockquote>
          <div className="ai-box">
            <h3>Tóm tắt và gợi ý của AI</h3>
            <p>{f.summary || 'Chưa có tóm tắt.'}</p>
            {f.action && <p><b>Nên làm:</b> {f.action}</p>}
          </div>
          {f.status === 'pending_hr' ? (
            <>
              <label className="field">
                <span>Ghi chú của HR <small>(không gửi cho nhân viên)</small></span>
                <textarea className="input" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Ví dụ: đã trao đổi với quản lý, giao IT xử lý trong tuần" style={{ minHeight: 64 }} />
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn kind="primary" icon={Check} disabled={busy} onClick={() => decide(true)}>{busy ? 'Đang gửi…' : 'Duyệt và tạo việc hỗ trợ'}</Btn>
                <Btn icon={X} disabled={busy} onClick={() => decide(false)}>Không cần hỗ trợ</Btn>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>Duyệt thì hệ thống tạo việc hỗ trợ (hạn 3 ngày) và gửi email cho nhân viên về bước tiếp theo.</p>
            </>
          ) : <p className="muted">{{
            action_open: 'HR đã duyệt; việc hỗ trợ được theo dõi ở danh sách bên dưới.',
            declined: 'HR đã ghi nhận phản hồi này không cần tạo việc hỗ trợ.',
          }[f.status] || (f.support ? 'Nhân viên đã yêu cầu HR liên hệ.' : 'Nhân viên không yêu cầu HR liên hệ; phản hồi chỉ để ghi nhận.')}</p>}
        </div>
      </div>
    </Card>
  );
}

const EMPTY_KPI = { emp: '', period: '', metric: '', target: '', actual: '', unit: '' };
function KpiDialog({ value, onClose, onSaved }) {
  const { employees, kpi, saveKpi } = useStore();
  const [run, busy] = useRun();
  const [f, setF] = useState(value);
  const editing = !!value.id;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const metrics = [...new Set(kpi.filter((k) => !f.emp || k.emp === f.emp).map((k) => k.metric))];
  const save = async () => {
    const row = { ...f, period: f.period.trim().toUpperCase(), metric: f.metric.trim(), unit: f.unit.trim(), target: Number(f.target), actual: Number(f.actual) };
    if (!row.emp || !row.metric || !row.unit || !(row.target > 0) || !(row.actual >= 0) || f.actual === '') return;
    if (await run(() => saveKpi(row), `Đã lưu KPI ${row.metric} tuần ${row.period.slice(6)}`, 'Chưa lưu được KPI')) { onSaved?.(row.period); onClose(); }
  };
  const people = employees.filter((e) => e.status !== 'resigned');
  return (
    <Dialog open onClose={() => !busy && onClose()} title={editing ? 'Sửa KPI' : 'Nhập KPI'}
      actions={<><Btn kind="plain" onClick={onClose} disabled={busy}>Huỷ</Btn><Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu KPI'}</Btn></>}>
      <p>Mỗi nhân viên một dòng cho mỗi chỉ tiêu trong một tuần; nhập lại cùng chỉ tiêu và tuần sẽ ghi đè số cũ. WF3 dùng số này khi phân tích phản hồi.</p>
      <div className="form-grid">
        <label className="field wide"><span>Nhân viên</span>
          <select className="input" value={f.emp} onChange={set('emp')} disabled={editing}>
            <option value="">Chọn nhân viên</option>
            {people.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
          </select>
        </label>
        <label className="field"><span>Tuần <small>(YYYY-Www)</small></span><input className="input" value={f.period} onChange={set('period')} disabled={editing} placeholder={isoWeek(Date.now())} /></label>
        <label className="field"><span>Đơn vị</span><input className="input" value={f.unit} onChange={set('unit')} placeholder="ticket, task, lượt…" /></label>
        <label className="field wide"><span>Chỉ tiêu</span>
          <input className="input" value={f.metric} onChange={set('metric')} disabled={editing} list="kpi-metrics" placeholder="Ví dụ: Ticket đã xử lý" />
          <datalist id="kpi-metrics">{metrics.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <label className="field"><span>Mục tiêu</span><input className="input" type="number" min="0" step="any" value={f.target} onChange={set('target')} /></label>
        <label className="field"><span>Thực tế</span><input className="input" type="number" min="0" step="any" value={f.actual} onChange={set('actual')} /></label>
      </div>
    </Dialog>
  );
}

function Kpi() {
  const { kpi, employeeById, deleteKpi } = useStore();
  const [run, busy] = useRun();
  const { names, data, periods } = kpiSeries(kpi, employeeById);
  const allPeriods = [...new Set(kpi.map((k) => k.period))].sort().reverse();
  const [period, setPeriod] = useState(allPeriods[0] || '');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const shown = allPeriods.includes(period) ? period : allPeriods[0];
  const rows = kpi.filter((k) => k.period === shown).sort((a, b) => a.emp.localeCompare(b.emp) || a.metric.localeCompare(b.metric));
  const prevOf = (k) => kpi.filter((x) => x.emp === k.emp && x.metric === k.metric && x.period < k.period).sort((a, b) => b.period.localeCompare(a.period))[0];

  return (
    <Card span={8}>
      <CardHead title="KPI theo tuần" meta={periods.length ? `Tỷ lệ đạt mục tiêu ${periods[0].slice(5)}–${periods.at(-1).slice(5)}; biểu đồ hiện tối đa 3 người có số liệu gần nhất` : 'Chưa có số liệu KPI'}>
        <Btn kind="primary" size="sm" icon={Plus} onClick={() => setEditing({ ...EMPTY_KPI, period: isoWeek(Date.now()) })}>Nhập KPI</Btn>
      </CardHead>
      {data.length > 0 && <>
        <KpiLines data={data} names={names} height={240} />
        <div className="legend" style={{ marginTop: 12 }}>
          {names.map((n, i) => <span key={n}><i style={{ background: SERIES[i] }} />{n}</span>)}
          <span>Nét đứt: mục tiêu 100%</span>
        </div>
      </>}
      {allPeriods.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <div className="section-title" style={{ margin: 0, flex: 1 }}>Số liệu từng chỉ tiêu</div>
            <Select label="Chọn tuần" value={shown} onChange={setPeriod} options={allPeriods.map((p) => ({ value: p, label: `Tuần ${p.slice(6)} · ${p.slice(0, 4)}` }))} />
          </div>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead><tr><th style={{ paddingLeft: 0 }}>Nhân viên</th><th>Chỉ tiêu</th><th className="n">Thực tế</th><th className="n">Tỷ lệ</th><th className="n">So với kỳ trước</th><th className="n" style={{ paddingRight: 0 }}><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {rows.map((k) => {
                  const p = prevOf(k), d = p ? rateOf(k) - rateOf(p) : null;
                  return (
                    <tr key={k.id}>
                      <td style={{ paddingLeft: 0, fontWeight: 600 }}>{employeeById[k.emp]?.name || k.emp}</td>
                      <td className="muted">{k.metric}</td>
                      <td className="n num">{k.actual}<small> /{k.target} {k.unit}</small></td>
                      <td className="n num" style={{ fontWeight: 700 }}>{rateOf(k)}%</td>
                      <td className="n num" style={{ fontWeight: 600, color: d > 0 ? 'var(--pos)' : d < 0 ? 'var(--neg)' : 'var(--ink-3)' }}>{d == null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} điểm`}</td>
                      <td className="n" style={{ paddingRight: 0 }}>
                        <span className="row-actions">
                          <button className="icon-btn sm" onClick={() => setEditing({ ...k, target: String(k.target), actual: String(k.actual) })} aria-label={`Sửa KPI ${k.metric}`} title="Sửa"><PencilSimple size={16} /></button>
                          <button className="icon-btn sm" onClick={() => setRemoving(k)} aria-label={`Xoá KPI ${k.metric}`} title="Xoá"><Trash size={16} /></button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : <Empty>Chưa có KPI nào. Bấm “Nhập KPI” để thêm số liệu tuần này.</Empty>}
      {editing && <KpiDialog value={editing} onClose={() => setEditing(null)} onSaved={setPeriod} />}
      <Dialog open={!!removing} onClose={() => !busy && setRemoving(null)} title="Xoá dòng KPI này?"
        actions={<><Btn kind="plain" onClick={() => setRemoving(null)} disabled={busy}>Huỷ</Btn>
          <Btn kind="danger" disabled={busy} onClick={async () => { if (await run(() => deleteKpi(removing), 'Đã xoá dòng KPI', 'Chưa xoá được KPI')) setRemoving(null); }}>{busy ? 'Đang xoá…' : 'Xoá'}</Btn></>}>
        {removing && <p>{employeeById[removing.emp]?.name} · {removing.metric} · tuần {removing.period.slice(6)}: {removing.actual}/{removing.target} {removing.unit}. Không khôi phục được sau khi xoá.</p>}
      </Dialog>
    </Card>
  );
}

const ACTION_STATE = { pending_approval: ['Chờ duyệt', 'accent'], in_progress: ['Đang làm', 'warn'], done: ['Đã xong', 'pos'], cancelled: ['Đã huỷ', 'neutral'] };
function SupportActions() {
  const { actions, employeeById, setActionStatus } = useStore();
  const [run, busy] = useRun();
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState('');
  const open = (a, status) => { setNote(''); setPending({ a, status }); };
  const list = [...actions].sort((a, b) => ['done', 'cancelled'].includes(a.status) - ['done', 'cancelled'].includes(b.status) || (a.due || '').localeCompare(b.due || ''));
  return (
    <Card span={12}>
      <CardHead title="Việc hỗ trợ đang theo dõi" meta="Tạo ra khi HR duyệt đề xuất hỗ trợ từ phản hồi; đánh dấu xong khi đã xử lý" />
      {list.length === 0 && <Empty>Chưa có việc hỗ trợ nào.</Empty>}
      <div className="list">
        {list.map((a) => {
          const active = ['pending_approval', 'in_progress'].includes(a.status);
          const late = active && a.due && a.due < today();
          const [label, tone] = late ? ['Trễ hạn', 'neg'] : ACTION_STATE[a.status] || [a.status, 'neutral'];
          const e = employeeById[a.emp] || { name: a.emp };
          return (
            <div className="item" key={a.id}>
              <Avatar name={e.name} size={36} />
              <div className="item-main"><div className="item-title">{a.title}</div><div className="item-sub">{a.id} · {e.name} · phụ trách: {a.owner}{a.due ? ` · hạn ${shortDate(a.due)}` : ''}{a.fb ? ` · từ ${a.fb}` : ''}</div></div>
              <Tag tone={tone}>{label}</Tag>
              {active && <>
                <Btn size="sm" icon={Check} onClick={() => open(a, 'done')}>Xong</Btn>
                <Btn size="sm" kind="plain" onClick={() => open(a, 'cancelled')}>Huỷ</Btn>
              </>}
            </div>
          );
        })}
      </div>
      <Dialog open={!!pending} onClose={() => !busy && setPending(null)} title={pending ? (pending.status === 'done' ? `Đánh dấu xong ${pending.a.id}?` : `Huỷ ${pending.a.id}?`) : ''}
        actions={<><Btn kind="plain" onClick={() => setPending(null)} disabled={busy}>Đóng</Btn>
          <Btn kind={pending?.status === 'done' ? 'primary' : 'danger'} disabled={busy}
            onClick={async () => { if (await run(() => setActionStatus(pending.a, pending.status, note.trim()), pending.status === 'done' ? `Đã đánh dấu xong ${pending.a.id}` : `Đã huỷ ${pending.a.id}`, 'Chưa cập nhật được việc hỗ trợ')) setPending(null); }}>
            {busy ? 'Đang lưu…' : pending?.status === 'done' ? 'Đánh dấu xong' : 'Huỷ việc này'}</Btn></>}>
        {pending && <>
          <p>{pending.a.title}</p>
          <p className="muted" style={{ fontSize: 13 }}>Chỉ cập nhật trong hệ thống, không gửi email.</p>
          <label className="field"><span>Ghi chú <small>(không bắt buộc)</small></span><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 64 }} /></label>
        </>}
      </Dialog>
    </Card>
  );
}

export default function Feedback() {
  const { feedback } = useStore();
  const sat = satisfaction(feedback, TOPIC);
  const pending = feedback.filter((x) => x.status === 'pending_hr').length;
  const last = sat.data.at(-1);

  return (
    <>
      <PageHeader eyebrow="Nhân sự" title="Phản hồi & KPI" sub={<>{pending ? <><b>{pending} phản hồi</b> đang cần hỗ trợ và chờ bạn duyệt. </> : 'Không còn đề xuất hỗ trợ nào chờ duyệt. '}{last?.avg != null && <>Mức hài lòng tuần {last.p.slice(1)} là <b>{one(last.avg)}/5</b>.</>}</>} />

      <div className="bento">
        <Inbox />
        <Kpi />
        <Card span={4}>
          <CardHead title="Mức hài lòng" meta="Trung bình mỗi tuần, thang 1–5" />
          {sat.data.length ? <SatisfactionArea data={sat.data} height={200} /> : <Empty>Chưa có phản hồi nào.</Empty>}
          <div className="section-title">Chủ đề phản hồi</div>
          <div className="list">
            {sat.topics.map((t) => (
              <div className="item" key={t.label} style={{ minHeight: 44, padding: '8px 0' }}>
                <span className="item-main">{t.label}</span>
                <span style={{ width: '45%' }}><span className="progress"><span className="progress-track"><span style={{ width: `${(t.n / sat.topics[0].n) * 100}%` }} /></span><span className="progress-figure">{t.n}</span></span></span>
              </div>
            ))}
          </div>
        </Card>
        <SupportActions />
      </div>
    </>
  );
}
