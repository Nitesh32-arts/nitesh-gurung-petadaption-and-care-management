import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, options = {}) => {
    const id = Math.random().toString(36).slice(2);
    const { type = 'success', actionLink, duration = DEFAULT_DURATION } = options;
    setToasts((prev) => [...prev, { id, message, type, actionLink, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, options) => addToast(message, { ...options, type: 'success' }),
    [addToast]
  );
  toast.success = (message, options) => addToast(message, { ...options, type: 'success' });
  toast.error = (message, options) => addToast(message, { ...options, type: 'error' });

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
