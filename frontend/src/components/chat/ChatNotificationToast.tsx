import { X, AtSign, ArrowRight } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function ChatNotificationToast() {
  const { toastNotifications, dismissToast, setActiveConversationId } = useChat();

  if (toastNotifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
    >
      {toastNotifications.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white/95 p-3.5 shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in dark:border-indigo-900/40 dark:bg-slate-900/95"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-xs font-bold text-white shadow-xs">
            {toast.sender_name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                {toast.sender_name}
              </span>
              <span className="truncate text-[10px] text-slate-400">
                in {toast.conversation_name}
              </span>
              {toast.is_mention && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <AtSign className="h-2.5 w-2.5" /> mention
                </span>
              )}
            </div>

            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
              {toast.content}
            </p>

            <button
              type="button"
              onClick={() => {
                setActiveConversationId(toast.conversation_id);
                dismissToast(toast.id);
              }}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View Conversation <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
