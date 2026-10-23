import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Briefcase, CalendarCheck, ChatCircleText, ClipboardText, EnvelopeSimple, FileText, Sparkle, UserFocus, Warning } from '@phosphor-icons/react';
import { useStore } from '../store.jsx';
import { STATUS, TOPIC } from '../constants.js';
import { funnel, kpiSeries, onboarding, perWeek, satisfaction } from '../derive.js';
import { Avatar, Btn, Card, CardHead, Empty, PageHeader, Progress, Ring, Tag } from '../components/ui.jsx';
import { KpiLines, SatisfactionArea, SERIES, WeeklyBars } from '../components/charts.jsx';
import { dayKey, hourNow, left, longToday, shortDate, span, time, today, when } from '../format.js';

const FEED_ICON = { cv: FileText, remind: Bell, report: ClipboardText, mail: EnvelopeSimple, alert: Warning, ai: Sparkle, calendar: CalendarCheck };
const pct = (v) => `${Math.round(v * 100)}%`;
const one = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

// Hoạt động gần đây, viết bằng lời của HR: lấy từ lịch sử trạng thái hồ sơ và nhật ký WF2/WF3
function activityFeed(events, candidates, logs, settings) {
  const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
  const fromEvents = events.filter((e) => byId[e.candidate_id] && e.actor !== 'migration').map((e) => {
    const c = byId[e.candidate_id];
    const [text, kind] = {
      received: [`${c.name} vừa nộp hồ sơ ${c.jobTitle}`, 'cv'],
      awaiting_hr: [`AI đã đọc CV ${c.name}${c.score != null ? `, chấm ${c.score}/100` : ''}`, 'ai'],
      hr_overdue: [`Hồ sơ ${c.name} đã quá ${settings.hr_review_hours || 72} giờ chưa được duyệt`, 'alert'],
      on_hold: [`Đã tạm giữ hồ sơ ${c.name}`, 'report'],
      awaiting_candidate: [`Đã gửi khung giờ phỏng vấn cho ${c.name}`, 'mail'],
      needs_scheduling: [`${c.name} cần HR xếp lịch phỏng vấn lại`, 'alert'],
      interview_scheduled: [`${c.name} đã chọn lịch phỏng vấn${c.interview ? ` ${when(c.interview.start)}` : ''}`, 'calendar'],
      interviewed: [`Đã phỏng vấn ${c.name}`, 'calendar'],
      hired: [`${c.name} nhận việc ${c.jobTitle}`, 'report'],
      rejected: [`Đã đóng hồ sơ ${c.name} và gửi thư cảm ơn`, 'mail'],
      withdrawn: [`${c.name} đã rút hồ sơ`, 'alert'],
    }[e.to_status] || [`${c.name}: ${STATUS[e.to_status]?.label || e.to_status}`, 'cv'];
    return { key: 'e' + e.event_id, at: e.occurred_at, text, kind, link: `/ung-vien/${c.id}` };
  });
  const fromLogs = logs.filter((l) => l.wf !== 'WF1' && l.msg).map((l) => ({
    key: 'l' + l.id, at: l.at, text: l.msg.length > 140 ? l.msg.slice(0, 137) + '…' : l.msg,
    kind: ['error', 'warning'].includes(l.level) ? 'alert' : l.wf === 'WF2' ? 'remind' : 'report',
    link: l.wf === 'WF2' ? '/onboarding' : '/phan-hoi',
  }));
  return [...fromEvents, ...fromLogs].sort((a, b) => new Date(b.at) - new Date(a.at));
}

export default function Overview() {
  const { candidates, tasks, feedback, jobs, employees, employeeById, kpi, logs, events, settings } = useStore();
  const review = candidates.filter((c) => ['awaiting_hr', 'hr_overdue'].includes(c.status)).sort((a, b) => (a.waitFor?.until || 0) - (b.waitFor?.until || 0));
  const overdue = review.filter((c) => c.waitFor && left(c.waitFor.until) <= 0);
  const todayIv = candidates.filter((c) => c.status === 'interview_scheduled' && c.interview && dayKey(c.interview.start) === today());
  const choosing = candidates.filter((c) => c.status === 'awaiting_candidate');
  const rescheduling = candidates.filter((c) => c.status === 'needs_scheduling');
  const toRecord = candidates.filter((c) => c.status === 'interviewed');
  const reports = tasks.filter((t) => t.status === 'submitted');
  const support = feedback.filter((f) => f.status === 'pending_hr');

  const fn = funnel(candidates);
  const weeks = perWeek(candidates);
  const ob = onboarding(employees, tasks);
  const obAvg = ob.length ? ob.reduce((a, e) => a + (e.total ? e.done / e.total : 0), 0) / ob.length : 0;
  const obLate = ob.reduce((a, e) => a + e.late, 0);
  const { names, data: kpiData, periods } = kpiSeries(kpi, employeeById);
  const lastKpi = kpiData.at(-1) || {};
  const sat = satisfaction(feedback, TOPIC);
  const satNow = sat.data.at(-1), satPrev = sat.data.at(-2);
  const feed = activityFeed(events, candidates, logs, settings);
  const openJobs = jobs.filter((j) => j.open);
  const firstApplied = candidates.reduce((m, c) => (!m || c.applied < m ? c.applied : m), null);

  const todo = [
    review.length > 0 && { icon: UserFocus, tone: overdue.length ? 'neg' : '', title: `${review.length} hồ sơ chờ bạn duyệt`, sub: overdue.length ? `${overdue[0].name} đã quá hạn ${span(left(overdue[0].waitFor.until))}` : `Gần hạn nhất: ${review[0].name}`, to: '/ung-vien?trang-thai=review' },
    ...todayIv.map((c) => ({ icon: CalendarCheck, tone: '', title: `Phỏng vấn ${c.name}`, sub: `${time(c.interview.start)}–${time(c.interview.end)} · ${new Date(c.interview.start) <= Date.now() && Date.now() < new Date(c.interview.end) ? 'đang diễn ra' : c.jobTitle}`, to: '/lich-phong-van' })),
    ...choosing.map((c) => ({ icon: CalendarCheck, tone: 'warn', title: `${c.name} chưa chọn giờ phỏng vấn`, sub: c.waitFor ? `Còn ${span(left(c.waitFor.until))} để chọn` : c.jobTitle, to: `/ung-vien/${c.id}` })),
    ...rescheduling.map((c) => ({ icon: CalendarCheck, tone: 'warn', title: `Xếp lại lịch phỏng vấn ${c.name}`, sub: 'Ứng viên chưa có giờ phỏng vấn phù hợp', to: `/ung-vien/${c.id}` })),
    ...toRecord.map((c) => ({ icon: ClipboardText, tone: '', title: `Ghi kết quả phỏng vấn ${c.name}`, sub: c.jobTitle, to: '/ung-vien?trang-thai=interviewed' })),
    reports.length > 0 && { icon: ClipboardText, tone: '', title: `${reports.length} báo cáo onboarding chờ duyệt`, sub: 'Nhân viên mới đã nộp kết quả', to: '/onboarding' },
    support.length > 0 && { icon: ChatCircleText, tone: '', title: `${support.length} đề xuất hỗ trợ nhân viên`, sub: 'Từ phản hồi hằng tuần', to: '/phan-hoi' },
  ].filter(Boolean);

  const hour = hourNow();
  const greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <>
      <PageHeader
        eyebrow={longToday()}
        title={greet}
        sub={<>Hôm nay có <b>{review.length} hồ sơ</b> chờ duyệt{overdue.length ? ` (${overdue.length} đã quá hạn)` : ''}, <b>{todayIv.length} buổi phỏng vấn</b> và <b>{reports.length} báo cáo onboarding</b> cần bạn xem.</>}
      >
        <Btn as={Link} to="/ung-vien?trang-thai=review" kind="primary" trail={ArrowRight}>Duyệt hồ sơ</Btn>
      </PageHeader>

      <div className="bento">
        <Card span={8}>
          <CardHead title="Tuyển dụng" meta={`${candidates.length} hồ sơ${firstApplied ? ` từ ${shortDate(firstApplied)}` : ''} · ${openJobs.length} vị trí đang mở`}>
            <Link className="link" to="/ung-vien">Mở bảng ứng viên <ArrowRight size={14} /></Link>
          </CardHead>
          <div className="split">
            <div>
              <div className="mini-head">Phễu tuyển dụng <span>tỷ lệ so với bước trước</span></div>
              <div className="funnel">
                {fn.map((r) => (
                  <div className="funnel-row" key={r.label}>
                    <span className="funnel-label">{r.label}</span>
                    <div className="funnel-bar"><span style={{ width: `${Math.max(14, fn[0].n ? (r.n / fn[0].n) * 100 : 0)}%` }}>{r.n}</span></div>
                    <span className="funnel-rate">{r.rate == null ? <span className="dash">—</span> : pct(r.rate)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mini-head">Hồ sơ nhận theo tuần <span>8 tuần gần nhất</span></div>
              <WeeklyBars data={weeks} />
            </div>
          </div>
        </Card>

        <Card span={4}>
          <CardHead title="Cần làm hôm nay" meta={`${todo.length} việc`} />
          {todo.length === 0 && <Empty>Không có việc nào đang chờ bạn.</Empty>}
          <div className="list">
            {todo.map((t) => (
              <Link className="item" to={t.to} key={t.title}>
                <span className={`todo-ico ${t.tone}`}><t.icon size={20} weight="light" aria-hidden="true" /></span>
                <span className="item-main">
                  <span className="item-title" style={{ display: 'block' }}>{t.title}</span>
                  <span className="item-sub" style={{ display: 'block' }}>{t.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card span={4}>
          <CardHead title="Onboarding" meta={`${ob.length} nhân viên đang thử việc`}>
            <Link className="link" to="/onboarding">Chi tiết <ArrowRight size={14} /></Link>
          </CardHead>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <Ring value={obAvg} size={72} stroke={7} label={`Trung bình ${pct(obAvg)} checklist`} />
            <div>
              <div style={{ fontWeight: 700 }}>Checklist hoàn thành trung bình</div>
              <div className="kpi-note">{obLate > 0 ? <span className="neg">{obLate} đầu việc quá hạn</span> : 'Không có việc quá hạn'}</div>
            </div>
          </div>
          <div className="list">
            {ob.map((e) => (
              <div className="item" key={e.id} style={{ minHeight: 48, padding: '8px 0' }}>
                <Avatar name={e.name} size={30} />
                <span className="item-main"><span className="item-title" style={{ fontSize: 13, display: 'block' }}>{e.name}</span></span>
                <div style={{ width: '42%' }}><Progress value={e.done} total={e.total} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card span={4}>
          <CardHead title="KPI theo tuần" meta={periods.length ? `Tỷ lệ đạt mục tiêu ${periods[0].slice(5)}–${periods.at(-1).slice(5)}` : 'Chưa có số liệu KPI'}>
            <Link className="link" to="/phan-hoi">Chi tiết <ArrowRight size={14} /></Link>
          </CardHead>
          {kpiData.length ? <>
            <KpiLines data={kpiData} names={names} height={230} />
            <div className="legend" style={{ marginTop: 14 }}>
              {names.map((n, i) => <span key={n}><i style={{ background: SERIES[i] }} />{n} <b className="num">{lastKpi[n] != null ? `${lastKpi[n]}%` : '—'}</b></span>)}
              <span>Nét đứt: mục tiêu 100%</span>
            </div>
          </> : <Empty>Nhập KPI ở trang Phản hồi &amp; KPI để thấy xu hướng.</Empty>}
        </Card>

        <Card span={4}>
          <CardHead title="Mức hài lòng" meta="Điểm tự đánh giá trung bình, thang 1–5" />
          {satNow?.avg != null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span className="kpi-big">{one(satNow.avg)}<small> /5</small></span>
              {satPrev?.avg != null && (
                <span className="kpi-note" style={{ marginTop: 0 }}>
                  <span className={satNow.avg >= satPrev.avg ? 'pos' : 'neg'}>{satNow.avg >= satPrev.avg ? '+' : '−'}{one(Math.abs(satNow.avg - satPrev.avg))}</span> so với tuần {satPrev.p.slice(1)}
                </span>
              )}
            </div>
          ) : <Empty>Chưa có phản hồi nào.</Empty>}
          {sat.data.length > 0 && <SatisfactionArea data={sat.data} height={150} />}
          <div className="topics" style={{ marginTop: 14 }}>
            {sat.topics.map((t) => <Tag key={t.label}>{t.label} · {t.n}</Tag>)}
          </div>
        </Card>

        <Card span={7}>
          <CardHead title="Vị trí đang tuyển" meta="Đã nhận việc so với số cần tuyển">
            <Link className="link" to="/vi-tri">Quản lý vị trí <ArrowRight size={14} /></Link>
          </CardHead>
          <div>
            {openJobs.length === 0 && <Empty>Chưa có vị trí nào đang tuyển.</Empty>}
            {openJobs.map((j) => {
              const mine = candidates.filter((c) => c.job === j.id);
              const hired = mine.filter((c) => c.status === 'hired').length;
              return (
                <div className="job-row" key={j.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span className="todo-ico"><Briefcase size={20} weight="light" aria-hidden="true" /></span>
                    <div style={{ minWidth: 0 }}><div className="item-title">{j.title}</div><div className="item-sub">{j.department} · {mine.length} hồ sơ</div></div>
                  </div>
                  <Progress value={Math.min(hired, j.headcount)} total={j.headcount} showFigure={false} />
                  <div className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{hired}<small> /{j.headcount} người</small></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card span={5}>
          <CardHead title="Hoạt động gần đây" meta="Tự cập nhật khi có thay đổi" />
          <div className="feed">
            {feed.length === 0 && <Empty>Chưa có hoạt động nào.</Empty>}
            {feed.slice(0, 6).map((a) => {
              const I = FEED_ICON[a.kind];
              return (
                <div className="feed-item" key={a.key}>
                  <span className={`feed-ico ${a.kind === 'alert' ? 'alert' : ''}`}><I size={18} weight="light" aria-hidden="true" /></span>
                  <div><div className="feed-text"><Link to={a.link}>{a.text}</Link></div><div className="feed-time">{when(a.at)}</div></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
