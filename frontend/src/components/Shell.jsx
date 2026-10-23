import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, Briefcase, CalendarBlank, ChatCircleText, GearSix, IdentificationCard, ListChecks, SignOut, SquaresFour, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { useStore } from '../store.jsx';
import { Mark, useAuth } from '../auth.jsx';
import { dayKey, left, span, time, today } from '../format.js';

function useCounts() {
  const { candidates, tasks, feedback } = useStore();
  const review = candidates.filter((c) => ['awaiting_hr', 'hr_overdue'].includes(c.status));
  const reports = tasks.filter((t) => t.status === 'submitted');
  const support = feedback.filter((f) => f.status === 'pending_hr');
  return { candidates, review, reports, support };
}

function Notifications({ onNavigate }) {
  const { candidates, review, reports, support } = useCounts();
  const items = [
    ...review.filter((c) => c.waitFor && left(c.waitFor.until) <= 0).map((c) => ({ key: c.id + 'late', tone: 'neg', text: `Hồ sơ ${c.name} đã quá hạn duyệt ${span(left(c.waitFor.until))}`, to: `/ung-vien/${c.id}` })),
    ...review.filter((c) => { const m = c.waitFor ? left(c.waitFor.until) : -1; return m > 0 && m < 8 * 3600000; }).map((c) => ({ key: c.id + 'soon', tone: 'warn', text: `Hồ sơ ${c.name} còn ${span(left(c.waitFor.until))} để duyệt`, to: `/ung-vien/${c.id}` })),
    ...candidates.filter((c) => c.status === 'interview_scheduled' && c.interview && dayKey(c.interview.start) === today()).map((c) => ({ key: c.id + 'iv', tone: '', text: `Phỏng vấn ${c.name} lúc ${time(c.interview.start)} hôm nay`, to: '/lich-phong-van' })),
    ...candidates.filter((c) => c.status === 'needs_scheduling').map((c) => ({ key: c.id + 'ns', tone: 'warn', text: `${c.name} cần HR xếp lịch phỏng vấn lại`, to: `/ung-vien/${c.id}` })),
    ...reports.map((t) => ({ key: t.id, tone: '', text: `${t.name}: có báo cáo mới chờ duyệt`, to: '/onboarding' })),
    ...support.map((f) => ({ key: f.id, tone: '', text: 'Có đề xuất hỗ trợ nhân viên chờ bạn duyệt', to: '/phan-hoi' })),
  ];
  return (
    <div className="popover" role="dialog" aria-label="Thông báo">
      <div className="popover-core">
        <div className="popover-head"><b>Thông báo</b><span>{items.length} mục cần xem</span></div>
        <ul>
          {items.length === 0 && <li className="notif">Không có việc nào cần xem.</li>}
          {items.map((n) => (
            <li key={n.key}>
              <Link to={n.to} onClick={onNavigate} className="notif">
                <span className={`dot ${n.tone}`} aria-hidden="true" />
                <span>{n.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Shell() {
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const bellRef = useRef(null);
  const { review, reports, support } = useCounts();
  const { error } = useStore();
  const { email, signOut } = useAuth();
  useEffect(() => { setMenu(false); setBell(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    if (!bell) return;
    const f = (e) => { if (!bellRef.current?.contains(e.target)) setBell(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [bell]);
  const notifCount = review.length + reports.length + support.length;

  const NAV = [
    { group: null, items: [{ to: '/', label: 'Tổng quan', icon: SquaresFour, end: true }] },
    { group: 'Tuyển dụng', items: [
      { to: '/ung-vien', label: 'Ứng viên', icon: UsersThree, count: review.length, countLabel: 'hồ sơ chờ duyệt' },
      { to: '/vi-tri', label: 'Vị trí tuyển dụng', icon: Briefcase },
      { to: '/lich-phong-van', label: 'Lịch phỏng vấn', icon: CalendarBlank },
    ] },
    { group: 'Nhân sự', items: [
      { to: '/nhan-vien', label: 'Nhân viên', icon: IdentificationCard },
      { to: '/onboarding', label: 'Onboarding', icon: ListChecks, count: reports.length, countLabel: 'báo cáo chờ duyệt' },
      { to: '/phan-hoi', label: 'Phản hồi & KPI', icon: ChatCircleText, count: support.length, countLabel: 'đề xuất chờ duyệt' },
    ] },
  ];

  return (
    <div className="app">
      <div className="mobile-bar">
        <Link to="/" className="brand-mini"><Mark /><b>ABC Tech</b></Link>
        <button className={`burger ${menu ? 'x' : ''}`} onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Đóng menu' : 'Mở menu'} aria-expanded={menu}>
          <span /><span />
        </button>
      </div>

      <aside className={`sidebar ${menu ? 'open' : ''}`} aria-label="Điều hướng chính">
        <div className="sidebar-core">
          <Link to="/" className="brand">
            <Mark />
            <span><b>ABC Tech</b><small>Phòng Nhân sự</small></span>
          </Link>
          <nav>
            {NAV.map((g, gi) => (
              <div className="nav-group" key={gi}>
                {g.group && <div className="group-label">{g.group}</div>}
                {g.items.map(({ to, label, icon: Icon, end, count, countLabel }, i) => (
                  <NavLink key={to} to={to} end={end} className="nav-item" style={{ '--i': gi * 3 + i }}>
                    {({ isActive }) => (
                      <>
                        <Icon size={20} weight={isActive ? 'fill' : 'light'} aria-hidden="true" />
                        <span className="nav-label">{label}</span>
                        {count > 0 && <span className="nav-count" title={`${count} ${countLabel}`} aria-label={`${count} ${countLabel}`}>{count}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <NavLink to="/cai-dat" className="nav-item">
              {({ isActive }) => (<><GearSix size={20} weight={isActive ? 'fill' : 'light'} aria-hidden="true" /><span className="nav-label">Cài đặt</span></>)}
            </NavLink>
            <div className="me" ref={bellRef}>
              <div className="me-text" style={{ paddingLeft: 6 }}><b>Phòng Nhân sự</b><small title={email}>{email}</small></div>
              <button className="bell me-out" onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất">
                <SignOut size={20} weight="light" />
              </button>
              <button className="bell" onClick={() => setBell((b) => !b)} aria-label={`Thông báo, ${notifCount} mục`} aria-expanded={bell}>
                <Bell size={20} weight="light" />
                {notifCount > 0 && <span className="bell-dot">{notifCount}</span>}
              </button>
              {bell && <Notifications onNavigate={() => setBell(false)} />}
            </div>
          </div>
        </div>
      </aside>

      <main className="main" id="main">
        <div className="page" key={loc.pathname}>
          {error && <div className="banner" role="alert"><WarningCircle size={20} weight="fill" aria-hidden="true" />Không tải lại được dữ liệu mới nhất ({error}). Số liệu đang hiện có thể đã cũ.</div>}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
