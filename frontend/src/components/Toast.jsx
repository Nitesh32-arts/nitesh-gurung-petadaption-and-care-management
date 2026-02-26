import { Link } from 'react-router-dom';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-lg border bg-white"
          role="alert"
        >
          {t.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${t.type === 'success' ? 'text-gray-900' : 'text-red-800'}`}>
              {t.message}
            </p>
            {t.actionLink && (
              <Link
                to={t.actionLink.to}
                className="inline-block mt-2 text-sm font-semibold text-primary hover:underline"
                onClick={() => removeToast(t.id)}
              >
                {t.actionLink.text}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
