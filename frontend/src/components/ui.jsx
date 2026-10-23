import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, CheckCircle, WarningCircle, X } from '@phosphor-icons/react';
import { STATUS } from '../constants.js';
import { hueOf, initials, left, span } from '../format.js';

export function Avatar({ name, size = 36 }) {
  const h = hueOf(name);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `hsl(${h} 55% 92%)`, color: `hsl(${h} 45% 26%)` }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Tag({ tone = 'neutral', children }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function StatusTag({ status }) {
  const s = STATUS[status] || { label: status, tone: 'neutral' };
  return <Tag tone={s.tone}>{s.label}</Tag>;
}

export function Score({ value, big = false }) {
  if (value == null) return <span className="dash" aria-label="Chưa có điểm">—</span>;
  return <span className={`score ${big ? 'big' : ''}`}>{value}<small>/100</small></span>;
}

// Thẻ hai lớp: vỏ ngoài nhạt + lõi trắng bên trong
export function Card({ className = '', span, children, as: As = 'section', ...rest }) {
  return (
    <As className={`card ${span ? `s-${span}` : ''} ${className}`} {...rest}>
      <div className="card-core">{children}</div>
    </As>
  );
}
export function CardHead({ title, meta, children }) {
  return (
    <header className="card-head">
      <div className="card-title">
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
      {children && <div className="card-actions">{children}</div>}
    </header>
  );
}

export function PageHeader({ eyebrow, title, sub, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

// Nút tròn; nếu có icon đuôi thì icon nằm trong một vòng tròn riêng
export function Btn({ kind = 'ghost', size, icon: Icon = null, trail = false, children, className = '', as: As = 'button', ...rest }) {
  const T = trail === true ? ArrowUpRight : trail;
  return (
    <As className={`btn ${kind} ${size || ''} ${T ? 'has-trail' : ''} ${className}`} {...(As === 'button' ? { type: 'button' } : {})} {...rest}>
      {Icon && <Icon size={18} weight="light" aria-hidden="true" />}
      <span>{children}</span>
      {T && <span className="btn-ico" aria-hidden="true"><T size={14} weight="bold" /></span>}
    </As>
  );
}

// n8n đang chờ ai và còn bao lâu: thanh là toàn bộ thời gian chờ, phần đã trôi qua được tô
export function WaitBar({ wait, hours = wait.hours, label = true }) {
  const ms = left(wait.until);
  const used = Math.min(1, Math.max(0, 1 - ms / (hours * 3600000)));
  const tone = ms <= 0 ? 'late' : ms < 8 * 3600000 ? 'soon' : '';
  return (
    <div className={`wait ${tone}`}>
      {label && <div className="wait-text">{ms <= 0 ? <>Quá hạn <b>{span(ms)}</b></> : <>Còn <b>{span(ms)}</b></>}</div>}
      <div className="wait-track" role="img" aria-label={`${ms <= 0 ? 'Quá hạn' : 'Còn'} ${span(ms)}`}><span style={{ width: `${used * 100}%` }} /></div>
    </div>
  );
}

export function Progress({ value, total, showFigure = true }) {
  const pct = total ? value / total : 0;
  return (
    <div className="progress">
      <div className="progress-track" role="img" aria-label={`${value} trên ${total}`}><span style={{ width: `${pct * 100}%` }} /></div>
      {showFigure && <span className="progress-figure">{Math.round(pct * 100)}%</span>}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, label }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label || `${Math.round(value * 100)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mist)" strokeWidth={stroke} />
        <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--navy)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ '--c': c }} />
      </svg>
      <b>{Math.round(value * 100)}<small>%</small></b>
    </span>
  );
}

export function Select({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`select ${className}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon size={16} weight={value === o.value ? 'fill' : 'light'} aria-hidden="true" />}{o.label}
        </button>
      ))}
    </div>
  );
}

function useEsc(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const f = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, label, children }) {
  useEsc(open, onClose);
  return createPortal(
    <div className={`overlay drawer-layer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        <div className="drawer-core">
          <button className="icon-btn drawer-close" onClick={onClose} aria-label="Đóng"><X size={18} weight="light" /></button>
          {open && children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export function Dialog({ open, onClose, title, children, actions }) {
  useEsc(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="overlay dialog-layer open">
      <div className="backdrop" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-core">
          <h2>{title}</h2>
          {children}
          <div className="dialog-actions">{actions}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    const item = typeof t === 'string' ? { title: t } : t;
    setItems((xs) => [...xs, { id, ...item }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), item.tone === 'error' ? 9000 : 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className={`toast ${t.tone || ''}`} key={t.id} role={t.tone === 'error' ? 'alert' : undefined}>
            {t.tone === 'error' ? <WarningCircle size={20} weight="fill" aria-hidden="true" /> : <CheckCircle size={20} weight="fill" aria-hidden="true" />}
            <div className="toast-body">
              <div>{t.title}</div>
              {t.detail && <div className="toast-detail">{t.detail}</div>}
            </div>
            {t.action && <button className="toast-action" onClick={() => { t.action.onClick(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
