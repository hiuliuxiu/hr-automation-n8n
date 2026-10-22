import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { Kanban, MagnifyingGlass, Rows } from '@phosphor-icons/react';
import { COLUMNS, columnOf } from '../constants.js';
import { moveFor, useStore } from '../store.jsx';
import { useMove } from '../components/MoveFlow.jsx';
import CandidateProfile, { nextStep } from '../components/CandidateProfile.jsx';
import { Avatar, Card, Drawer, PageHeader, Score, Segmented, Select, StatusTag, Tag, WaitBar, useToast } from '../components/ui.jsx';
import { date, left, span, when } from '../format.js';

function CardTag({ c }) {
  switch (c.status) {
    case 'received': return <Tag>AI đang đọc</Tag>;
    case 'hr_overdue': return <Tag tone="neg">{c.waitFor ? `Quá hạn ${span(left(c.waitFor.until))}` : 'Quá hạn duyệt'}</Tag>;
    case 'on_hold': return <Tag tone="warn">Tạm giữ</Tag>;
    case 'awaiting_candidate': return <Tag tone="accent">Chờ chọn giờ</Tag>;
    case 'needs_scheduling': return <Tag tone="warn">Cần xếp lịch</Tag>;
    case 'interview_scheduled': return <Tag tone="accent">{c.interview ? when(c.interview.start).replace(/^\S/, (m) => m.toUpperCase()) : 'Đã hẹn'}</Tag>;
    case 'interviewed': return <Tag tone="warn">Chờ kết quả</Tag>;
    case 'hired': return <Tag tone="pos">Nhận việc</Tag>;
    case 'rejected': return <Tag>Đã gửi thư</Tag>;
    case 'withdrawn': return <Tag>Rút hồ sơ</Tag>;
    default: return null;
  }
}

function CandidateCard({ c, onOpen, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id, data: { c }, disabled: overlay });
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      className={`kcard ${isDragging ? 'dragging' : ''} ${overlay ? 'overlay' : ''}`}
      onClick={() => onOpen?.(c)}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      aria-roledescription="Thẻ ứng viên, kéo để chuyển bước"
      aria-label={`${c.name}, ${c.jobTitle}`}
    >
      <span className="kcard-top">
        <Avatar name={c.name} size={34} />
        <span style={{ minWidth: 0 }}>
          <span className="kcard-name" style={{ display: 'block' }}>{c.name}</span>
          <span className="kcard-job" style={{ display: 'block' }}>{c.jobTitle}</span>
        </span>
      </span>
      {c.status === 'awaiting_hr' && c.waitFor && <WaitBar wait={c.waitFor} />}
      <span className="kcard-foot">
        {c.status === 'awaiting_hr' && c.waitFor ? <span className="kcard-job">Hạn {when(c.waitFor.until)}</span> : <CardTag c={c} />}
        <Score value={c.score} />
      </span>
    </button>
  );
}

function Column({ col, items, active, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  let state = '';
  if (active) {
    const from = columnOf(active.status);
    if (from !== col.id) state = moveFor(active, col.id).move ? 'can-drop' : 'no-drop';
  }
  return (
    <section className={`col ${state} ${isOver && state === 'can-drop' ? 'is-over' : ''}`} aria-label={col.label}>
      <header className="col-head"><b>{col.label}</b><span className="col-count">{items.length}</span></header>
      <div className="col-hint">{col.hint}</div>
      <div className="col-body" ref={setNodeRef}>
        {items.map((c) => <CandidateCard key={c.id} c={c} onOpen={onOpen} />)}
        {items.length === 0 && <div className="col-empty">{state === 'can-drop' ? 'Thả vào đây' : 'Chưa có hồ sơ'}</div>}
      </div>
    </section>
  );
}

export default function Candidates() {
  const { candidates, jobs, employeeById } = useStore();
  const move = useMove();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState('kanban');
  const [q, setQ] = useState(params.get('q') || '');
  const [active, setActive] = useState(null);
  const [openId, setOpenId] = useState(null);
  const status = params.get('trang-thai') || 'all';
  const job = params.get('vi-tri') || 'all';
  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v && v !== 'all') p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return candidates
      .filter((c) => job === 'all' || c.job === job)
      .filter((c) => !t || [c.name, c.email, c.id].some((s) => s.toLowerCase().includes(t)))
      .sort((a, b) => (a.waitFor && b.waitFor ? a.waitFor.until - b.waitFor.until : new Date(b.applied) - new Date(a.applied)));
  }, [candidates, q, job]);
  const cols = COLUMNS.filter((c) => status === 'all' || c.id === status);
  const rows = filtered.filter((c) => status === 'all' || columnOf(c.status) === status);
  const open = candidates.find((c) => c.id === openId);
  const reviewN = candidates.filter((c) => ['awaiting_hr', 'hr_overdue'].includes(c.status)).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = ({ active: a, over }) => {
    setActive(null);
    if (!over) return;
    const c = a.data.current.c;
    if (columnOf(c.status) === over.id) return;
    const r = moveFor(c, over.id);
    if (r.blocked) toast({ title: r.blocked });
    else move(c, over.id);
  };

  return (
    <>
      <PageHeader eyebrow="Tuyển dụng" title="Ứng viên" sub={<>{candidates.length} hồ sơ, <b>{reviewN} hồ sơ</b> đang chờ bạn duyệt. Kéo thẻ sang cột khác để chuyển bước; hệ thống sẽ hỏi lại trước khi gửi email cho ứng viên.</>}>
        <Segmented label="Kiểu xem" value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban', icon: Kanban }, { value: 'list', label: 'Danh sách', icon: Rows }]} />
      </PageHeader>

      <div className="toolbar rise" style={{ '--i': 1 }}>
        <label className="search">
          <MagnifyingGlass size={18} weight="light" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, email hoặc mã hồ sơ" aria-label="Tìm ứng viên" />
        </label>
        <Select label="Lọc theo bước" value={status} onChange={(v) => setParam('trang-thai', v)} options={[{ value: 'all', label: 'Tất cả các bước' }, ...COLUMNS.map((c) => ({ value: c.id, label: c.label }))]} />
        <Select label="Lọc theo vị trí" value={job} onChange={(v) => setParam('vi-tri', v)} options={[{ value: 'all', label: 'Mọi vị trí' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]} />
        <span className="spacer" />
        <span className="muted num">{rows.length} hồ sơ</span>
      </div>

      {view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={({ active: a }) => setActive(a.data.current.c)} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="board rise" style={{ '--i': 2, gridAutoColumns: cols.length < 3 ? 'minmax(300px, 380px)' : undefined }}>
            {cols.map((col) => (
              <Column key={col.id} col={col} active={active} onOpen={(c) => setOpenId(c.id)} items={filtered.filter((c) => columnOf(c.status) === col.id)} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 300, easing: 'cubic-bezier(0.32,0.72,0,1)' }}>
            {active ? <CandidateCard c={active} overlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card className="flush rise" style={{ '--i': 2 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th style={{ width: '30%' }}>Ứng viên</th><th>Vị trí</th><th className="n">Điểm AI</th><th>Trạng thái</th><th>Bước tiếp theo</th><th className="n">Nộp hồ sơ</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                    <td><div className="person"><Avatar name={c.name} /><div style={{ minWidth: 0 }}><b>{c.name}</b><small>{c.email}</small></div></div></td>
                    <td>{c.jobTitle}</td>
                    <td className="n"><Score value={c.score} /></td>
                    <td><StatusTag status={c.status} /></td>
                    <td className="muted">{nextStep(c, employeeById)}</td>
                    <td className="n num">{date(c.applied)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6}><div className="empty">Không có hồ sơ nào khớp bộ lọc.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Drawer open={!!open} onClose={() => setOpenId(null)} label={open ? `Hồ sơ ${open.name}` : 'Hồ sơ'}>
        {open && <CandidateProfile c={open} />}
      </Drawer>
    </>
  );
}

