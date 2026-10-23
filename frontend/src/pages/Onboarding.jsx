import { useState } from 'react';
import { BellRinging, Check, ArrowUUpLeft, Paperclip } from '@phosphor-icons/react';
import { onboarding } from '../derive.js';
import { useStore } from '../store.jsx';
import { Avatar, Btn, Card, CardHead, Dialog, Empty, PageHeader, Ring, Tag, useToast } from '../components/ui.jsx';
import { daysBetween, shortDate, today, when } from '../format.js';
import { useRemindEmployee } from './Employees.jsx';

const DOT_LABEL = { done: 'xong', submitted: 'chờ duyệt', late: 'quá hạn', blocked: 'bị vướng', pending: 'đang làm' };

export default function Onboarding() {
  const { employees, employeeById, tasks, trainings, courseById, jobById, settings, reviewTask } = useStore();
  const toast = useToast();
  const [remind, reminding] = useRemindEmployee();
  const [busy, setBusy] = useState(null);
  const [returning, setReturning] = useState(null);
  const [note, setNote] = useState('');
  const people = onboarding(employees, tasks);
  const submitted = tasks.filter((t) => t.status === 'submitted').sort((a, b) => (a.submitted || '').localeCompare(b.submitted || ''));
  const late = people.flatMap((p) => p.tasks.filter((t) => t.state === 'late' || t.state === 'blocked'));
  const lateBy = people.filter((p) => p.late + p.blocked > 0).sort((a, b) => b.late + b.blocked - (a.late + a.blocked));
  const learning = trainings.filter((t) => t.status !== 'completed' && employeeById[t.emp]?.status !== 'resigned').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const ending = people.filter((p) => p.status === 'probation').sort((a, b) => a.probationEnd.localeCompare(b.probationEnd));

  const review = async (t, ok, comment = '') => {
    const e = employeeById[t.emp];
    setBusy(t.id);
    try {
      const r = await reviewTask(t, ok ? 'approve' : 'return', comment);
      toast({ title: r?.message || (ok ? `Đã duyệt “${t.name}” của ${e.name}` : `Đã trả lại báo cáo cho ${e.name}`) });
      setReturning(null);
    } catch (err) {
      toast({ tone: 'error', title: 'Chưa cập nhật được đầu việc', detail: err.message });
    } finally { setBusy(null); }
  };

  return (
    <>
      <PageHeader eyebrow="Nhân sự" title="Onboarding & đào tạo" sub={<><b>{late.length} đầu việc quá hạn hoặc bị vướng</b>{lateBy[0] ? `, nhiều nhất là ${lateBy[0].name} (${lateBy[0].late + lateBy[0].blocked} việc)` : ''}. {submitted.length ? <><b>{submitted.length} báo cáo</b> đang chờ bạn duyệt.</> : 'Không còn báo cáo nào chờ duyệt.'} Hệ thống tự nhắc việc lúc {settings.reminder_time || '08:30'} các ngày làm việc.</>} />

      <div className="bento">
        <Card span={7}>
          <CardHead title="Báo cáo chờ duyệt" meta="Nhân viên bấm “Báo cáo” trong email nhắc việc và nộp kết quả" />
          {submitted.length === 0 && <Empty>Bạn đã duyệt hết. Báo cáo mới sẽ hiện ở đây.</Empty>}
          <div className="list">
            {submitted.map((t) => {
              const e = employeeById[t.emp];
              return (
                <div className="item" key={t.id} style={{ alignItems: 'flex-start', padding: '16px 0' }}>
                  <Avatar name={e?.name || t.emp} size={40} />
                  <div className="item-main">
                    <div className="item-title">{t.name}</div>
                    <div className="item-sub">{e?.name} · {t.submitted ? `nộp ${when(t.submitted)}` : 'đã nộp'}{t.note ? ` · “${t.note}”` : ''}</div>
                    {t.proofUrl && <a className="link" href={t.proofUrl} target="_blank" rel="noreferrer" style={{ marginTop: 6 }}><Paperclip size={14} /> {t.proof || 'Tệp minh chứng'}</a>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Btn kind="primary" size="sm" icon={Check} disabled={busy === t.id} onClick={() => review(t, true)}>{busy === t.id ? 'Đang gửi…' : 'Duyệt'}</Btn>
                      <Btn size="sm" icon={ArrowUUpLeft} disabled={busy === t.id} onClick={() => { setNote(''); setReturning(t); }}>Trả lại</Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card span={5}>
          <CardHead title="Việc quá hạn" meta={`${late.length} đầu việc của ${lateBy.length} người`} />
          {lateBy.length === 0 && <Empty>Không có việc nào quá hạn.</Empty>}
          <div className="list">
            {lateBy.map((p) => (
              <div className="item" key={p.id}>
                <Avatar name={p.name} size={36} />
                <div className="item-main">
                  <div className="item-title">{p.name}</div>
                  <div className="item-sub">{p.tasks.filter((t) => t.state === 'late' || t.state === 'blocked').map((t) => t.state === 'blocked' ? `${t.name} (vướng)` : t.name).join(' · ')}</div>
                </div>
                <Btn size="sm" icon={BellRinging} disabled={reminding === p.id} onClick={() => remind(p)}>{reminding === p.id ? 'Đang gửi…' : 'Nhắc'}</Btn>
              </div>
            ))}
          </div>
        </Card>

        <Card span={12}>
          <CardHead title="Tiến độ từng người" meta="Mỗi ô là một đầu việc trong checklist">
            <div className="legend">
              <span><i style={{ background: 'var(--navy)' }} />Xong</span>
              <span><i style={{ background: 'var(--sky)' }} />Chờ duyệt</span>
              <span><i style={{ background: 'var(--neg-bg)', boxShadow: 'inset 0 0 0 2px var(--neg)' }} />Quá hạn</span>
              <span><i style={{ background: 'var(--warn-bg)', boxShadow: 'inset 0 0 0 2px var(--warn)' }} />Bị vướng</span>
              <span><i style={{ background: 'var(--mist-2)' }} />Đang làm</span>
            </div>
          </CardHead>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nhân viên</th><th>Checklist</th><th className="n">Hoàn thành</th><th>Quản lý · buddy</th><th>Công cụ</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: 0 }}><div className="person"><Avatar name={p.name} /><div><b>{p.name}</b><small>{jobById[p.job]?.title} · vào {shortDate(p.start)}</small></div></div></td>
                    <td><div className="dots" style={{ flexWrap: 'wrap', maxWidth: 360 }}>{p.tasks.map((t) => <i key={t.id} className={t.state} title={`${t.name}: ${DOT_LABEL[t.state]}`} />)}</div></td>
                    <td className="n"><Ring value={p.total ? p.done / p.total : 0} size={48} stroke={5} label={`${p.done}/${p.total} đầu việc`} /></td>
                    <td className="muted">{p.manager || '—'} · {p.buddy || '—'}</td>
                    <td style={{ paddingRight: 0 }}>{p.tools === 'confirmed' ? <Tag tone="pos">Đã cấp đủ</Tag> : <Tag tone="warn">Chờ IT</Tag>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card span={6}>
          <CardHead title="Khoá học chưa hoàn thành" meta="AI chỉ chọn khoá trong danh mục của công ty" />
          {learning.length === 0 && <Empty>Mọi khoá học đã hoàn thành.</Empty>}
          <div className="list">
            {learning.map((t) => {
              const c = courseById[t.course];
              return (
                <div className="item" key={t.id}>
                  <div className="item-main"><div className="item-title">{c?.name || t.course}</div><div className="item-sub">{employeeById[t.emp]?.name}{c?.hours ? ` · ${c.hours} giờ` : ''} · {t.status === 'in_progress' ? 'đang học' : 'chưa bắt đầu'}</div></div>
                  {t.due ? (t.due < today() ? <Tag tone="neg">Trễ từ {shortDate(t.due)}</Tag> : <Tag>Hạn {shortDate(t.due)}</Tag>) : <Tag>Không có hạn</Tag>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card span={6}>
          <CardHead title="Sắp hết thử việc" meta={`${settings.probation_days || 90} ngày kể từ ngày vào làm`} />
          {ending.length === 0 && <Empty>Không có ai đang thử việc.</Empty>}
          <div className="list">
            {ending.map((p) => (
              <div className="item" key={p.id}>
                <Avatar name={p.name} size={36} />
                <div className="item-main"><div className="item-title">{p.name}</div><div className="item-sub">{p.total && p.done === p.total ? 'Đã xong checklist, đủ điều kiện xét chính thức' : `Còn ${p.total - p.done} đầu việc checklist`}</div></div>
                <span className="num" style={{ fontWeight: 700 }}>{shortDate(p.probationEnd)}<small> · {daysBetween(today(), p.probationEnd)} ngày</small></span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog
        open={!!returning}
        onClose={() => !busy && setReturning(null)}
        title={returning ? `Trả lại “${returning.name}”?` : ''}
        actions={<>
          <Btn kind="plain" onClick={() => setReturning(null)} disabled={!!busy}>Huỷ</Btn>
          <Btn kind="primary" disabled={!!busy || !note.trim()} onClick={() => review(returning, false, note.trim())}>{busy ? 'Đang gửi…' : 'Gửi nhận xét'}</Btn>
        </>}
      >
        <p>Nhân viên nhận email kèm nhận xét này để làm lại và nộp lại. Đầu việc quay về trạng thái đang làm.</p>
        <label className="field">
          <span>Nhận xét cho nhân viên</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cần bổ sung gì, sửa ở đâu…" />
        </label>
      </Dialog>
    </>
  );
}
