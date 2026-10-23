import { createContext, useCallback, useContext, useState } from 'react';
import { ACTIONS, moveFor, useStore } from '../store.jsx';
import { Btn, Dialog, useToast } from './ui.jsx';

// Thao tác trên hồ sơ (kéo thả hoặc bấm nút): luôn hỏi xác nhận vì phần lớn thao tác gửi email cho ứng viên.
// Email đã gửi thì không thu hồi được, nên không có nút hoàn tác.
const Ctx = createContext({ move: () => {}, act: () => {} });
export const useMove = () => useContext(Ctx).move;
export const useAct = () => useContext(Ctx).act;

export function MoveProvider({ children }) {
  const store = useStore();
  const toast = useToast();
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const act = useCallback((c, key) => { setNote(''); setPending({ c, key }); }, []);
  const move = useCallback((c, toCol) => {
    const r = moveFor(c, toCol);
    if (r.blocked) { toast({ title: r.blocked }); return; }
    act(c, r.key);
  }, [toast, act]);

  const close = () => { if (!busy) setPending(null); };
  const confirm = async () => {
    const { c, key } = pending;
    setBusy(true);
    try {
      const r = await store.runAction(key, c, note.trim());
      toast({ title: r?.message || 'Đã cập nhật hồ sơ.' });
      setPending(null);
    } catch (e) {
      toast({ tone: 'error', title: 'Chưa thực hiện được', detail: e.message });
    } finally {
      setBusy(false);
    }
  };

  const a = pending && ACTIONS[pending.key];
  return (
    <Ctx.Provider value={{ move, act }}>
      {children}
      <Dialog
        open={!!pending}
        onClose={close}
        title={a ? a.title(pending.c) : ''}
        actions={<>
          <Btn kind="plain" onClick={close} disabled={busy}>Huỷ</Btn>
          <Btn kind={a?.danger ? 'danger' : 'primary'} onClick={confirm} disabled={busy}>{busy ? 'Đang gửi…' : a?.confirm}</Btn>
        </>}
      >
        {a && (
          <>
            <p>{a.body(pending.c, store.settings)}</p>
            {!a.noNote && (
              <label className="field">
                <span>Ghi chú nội bộ <small>(không gửi cho ứng viên)</small></span>
                <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lý do, điều cần hỏi thêm…" />
              </label>
            )}
          </>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}
