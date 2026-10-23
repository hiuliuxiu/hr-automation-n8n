import { Link } from 'react-router-dom';
import { ArrowSquareOut, BellRinging, CalendarPlus, VideoCamera } from '@phosphor-icons/react';
import { HR_CALENDAR_ID } from '../constants.js';
import { useStore } from '../store.jsx';
import { useAct, useMove } from '../components/MoveFlow.jsx';
import { Avatar, Btn, Card, CardHead, Empty, PageHeader, Tag, WaitBar } from '../components/ui.jsx';
import { dayKey, shortDate, time, today, when } from '../format.js';

const CAL_SRC = `https://calendar.google.com/calendar/embed?${new URLSearchParams({
  src: HR_CALENDAR_ID, ctz: 'Asia/Ho_Chi_Minh', mode: 'WEEK', wkst: '2', hl: 'vi',
  showTitle: '0', showPrint: '0', showCalendars: '0', showTz: '0',
})}`;
const CAL_LINK = `https://calendar.google.com/calendar/u/0/r/week?cid=${encodeURIComponent(HR_CALENDAR_ID)}`;

export default function Interviews() {
  const { candidates, settings } = useStore();
  const move = useMove();
  const act = useAct();
  const scheduled = candidates.filter((c) => c.status === 'interview_scheduled' && c.interview).sort((a, b) => new Date(a.interview.start) - new Date(b.interview.start));
  const todayN = scheduled.filter((c) => dayKey(c.interview.start) === today()).length;
  const choosing = candidates.filter((c) => c.status === 'awaiting_candidate');
  const rescheduling = candidates.filter((c) => c.status === 'needs_scheduling');
  const toRecord = candidates.filter((c) => c.status === 'interviewed');
  const choiceHours = settings.candidate_choice_hours || 24;

  return (
    <>
      <PageHeader eyebrow="Tuyển dụng" title="Lịch phỏng vấn" sub={<>Lịch Google của phòng Tuyển dụng. Khi bạn mời phỏng vấn, hệ thống đề xuất giờ trống trong lịch này và tự tạo sự kiện kèm link Google Meet khi ứng viên chọn giờ.</>}>
        <Btn as="a" href={CAL_LINK} target="_blank" rel="noreferrer" trail={ArrowSquareOut}>Mở Google Calendar</Btn>
      </PageHeader>

      <div className="bento top">
        <Card span={8}>
          <CardHead title="Tuần này" meta="Nếu lịch trống, hãy đăng nhập Google bằng tài khoản tuyển dụng trong trình duyệt này." />
          <iframe className="cal-frame" title="Google Calendar của phòng Tuyển dụng" src={CAL_SRC} loading="lazy" />
        </Card>

        <div className="s-4" style={{ display: 'grid', gap: 'var(--gap)', alignContent: 'start' }}>
          <Card>
            <CardHead title="Sắp phỏng vấn" meta={`${scheduled.length} buổi đã hẹn, ${todayN} buổi hôm nay`} />
            {scheduled.length === 0 && <Empty>Chưa có buổi phỏng vấn nào được hẹn.</Empty>}
            <div className="list">
              {scheduled.map((c) => {
                const live = new Date(c.interview.start) <= Date.now() && Date.now() < new Date(c.interview.end);
                return (
                  <div className="item" key={c.id}>
                    <Avatar name={c.name} />
                    <Link className="item-main" to={`/ung-vien/${c.id}`}>
                      <span className="item-title" style={{ display: 'block' }}>{c.name}</span>
                      <span className="item-sub" style={{ display: 'block' }}>{when(c.interview.start)}–{time(c.interview.end)} · {c.jobTitle}</span>
                    </Link>
                    {live && c.interview.meet ? <Btn as="a" kind="primary" size="sm" href={c.interview.meet} target="_blank" rel="noreferrer" icon={VideoCamera}>Vào Meet</Btn>
                      : <Btn size="sm" onClick={() => move(c, 'interviewed')}>Đã phỏng vấn</Btn>}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHead title="Chờ ứng viên chọn giờ" meta={`Ứng viên có ${choiceHours} giờ để chọn`} />
            {choosing.length === 0 && <Empty>Không có lời mời nào đang chờ.</Empty>}
            {choosing.map((c) => (
              <div key={c.id} style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div className="item" style={{ padding: 0, minHeight: 0 }}>
                  <Avatar name={c.name} />
                  <Link className="item-main" to={`/ung-vien/${c.id}`}><span className="item-title" style={{ display: 'block' }}>{c.name}</span><span className="item-sub" style={{ display: 'block' }}>{c.invitedAt ? `Đã gửi lời mời ${when(c.invitedAt)}` : c.jobTitle}</span></Link>
                </div>
                {c.waitFor && <WaitBar wait={c.waitFor} />}
                <Btn icon={BellRinging} onClick={() => act(c, 'remind')}>Nhắc lại ứng viên</Btn>
              </div>
            ))}
          </Card>

          {rescheduling.length > 0 && (
            <Card>
              <CardHead title="Cần xếp lịch lại" meta="Ứng viên xin đổi giờ, quá hạn chọn hoặc không còn khung trống" />
              {rescheduling.map((c) => (
                <div key={c.id} style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                  <div className="item" style={{ padding: 0, minHeight: 0 }}>
                    <Avatar name={c.name} />
                    <Link className="item-main" to={`/ung-vien/${c.id}`}><span className="item-title" style={{ display: 'block' }}>{c.name}</span><span className="item-sub" style={{ display: 'block' }}>{c.jobTitle}</span></Link>
                    <Tag tone="warn">Cần xếp lịch</Tag>
                  </div>
                  <Btn icon={CalendarPlus} onClick={() => act(c, 'reinvite')}>Gửi lại khung giờ</Btn>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <CardHead title="Chờ ghi kết quả" meta="Phỏng vấn xong, chưa có quyết định" />
            {toRecord.length === 0 && <Empty>Không có buổi nào chờ kết quả.</Empty>}
            {toRecord.map((c) => (
              <div key={c.id} style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div className="item" style={{ padding: 0, minHeight: 0 }}>
                  <Avatar name={c.name} />
                  <Link className="item-main" to={`/ung-vien/${c.id}`}><span className="item-title" style={{ display: 'block' }}>{c.name}</span><span className="item-sub" style={{ display: 'block' }}>{c.interview ? `Phỏng vấn ${shortDate(c.interview.start)} · ` : ''}{c.jobTitle}</span></Link>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn kind="primary" size="sm" onClick={() => move(c, 'hired')}>Đạt, nhận việc</Btn>
                  <Btn size="sm" onClick={() => move(c, 'rejected')}>Không đạt</Btn>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
