import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import { Check, Info, X } from 'lucide-react';
import { Button } from './Button.js';

type ToastTone = 'success' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, message, tone }]);
      const timer = window.setTimeout(() => dismissToast(id), 5000);
      timers.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-region"
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            className={`toast toast-${toast.tone}`}
            key={toast.id}
            role="status"
          >
            {toast.tone === 'success' ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <Info size={17} aria-hidden="true" />
            )}
            <span>{toast.message}</span>
            <Button
              aria-label="Dismiss notification"
              iconOnly
              onClick={() => dismissToast(toast.id)}
              variant="quiet"
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
