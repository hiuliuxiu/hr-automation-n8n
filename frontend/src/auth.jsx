import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SignIn } from '@phosphor-icons/react';
import { supabase } from './lib/supabase.js';
import { Btn } from './components/ui.jsx';

// Đăng nhập bằng tài khoản Supabase Auth của phòng Nhân sự (không có đăng ký).
// Chỉ email nằm trong app_settings.hr_accounts mới đọc được dữ liệu; tài khoản khác bị đăng xuất ngay.
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const ADMIN_EMAIL = import.meta.env.VITE_HR_ADMIN_EMAIL;
const DENIED = 'Tài khoản này không có quyền vào cổng HR.';

export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="var(--navy)" />
      <path d="M9 22 16 9l7 13" fill="none" stroke="#dce8f2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 17.5h8.4" stroke="#dce8f2" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Splash({ children }) {
  return <div className="splash"><Mark /><p>{children}</p></div>;
}

function Login({ notice }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const name = user.trim();
    if (!name || !password) { setError('Nhập tài khoản và mật khẩu.'); return; }
    const email = name.toLowerCase() === 'admin' ? ADMIN_EMAIL : name;
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(/invalid login credentials/i.test(err.message) ? 'Sai tài khoản hoặc mật khẩu.' : err.message);
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-core">
          <div className="brand"><Mark /><span><b>ABC Tech</b><small>Phòng Nhân sự</small></span></div>
          <h1>Đăng nhập cổng HR</h1>
          <label className="field"><span>Tài khoản</span>
            <input className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" placeholder="admin hoặc email" autoFocus />
          </label>
          <label className="field"><span>Mật khẩu</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {(error || notice) && <p className="login-error" role="alert">{error || notice}</p>}
          <Btn as="button" type="submit" kind="primary" className="block" icon={SignIn} disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</Btn>
        </div>
      </form>
    </main>
  );
}

export function AuthProvider({ children }) {
  // undefined: đang kiểm tra phiên cũ; null: chưa đăng nhập
  const [session, setSession] = useState(undefined);
  const [allowed, setAllowed] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) { setAllowed(null); return; }
    let live = true;
    supabase.rpc('is_hr').then(({ data, error }) => {
      if (!live) return;
      if (error || data !== true) {
        setNotice(error ? error.message : DENIED);
        supabase.auth.signOut();
      } else { setNotice(''); setAllowed(true); }
    });
    return () => { live = false; };
  }, [userId]);

  const signOut = useCallback(() => { setNotice(''); return supabase.auth.signOut(); }, []);

  if (session === undefined || (session && allowed === null)) return <Splash>Đang kiểm tra đăng nhập…</Splash>;
  if (!session) return <Login notice={notice} />;
  return <Ctx.Provider value={{ session, email: session.user.email, signOut }}>{children}</Ctx.Provider>;
}
