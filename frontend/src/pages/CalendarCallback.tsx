import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle, Calendar } from 'lucide-react';
import { handleCalendarCallback } from '../services/calendarApi';
import { Button } from '../components/ui/button';

export default function CalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing Google Calendar connection...');
  const hasExecuted = useRef(false);

  useEffect(() => {
    // Prevent React 18 StrictMode from firing twice and burning the single-use OAuth code
    if (hasExecuted.current) return;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      hasExecuted.current = true;
      setStatus('error');
      setMessage(`Google authorization cancelled: ${errorParam}`);
      return;
    }

    if (!code || !state) {
      hasExecuted.current = true;
      setStatus('error');
      setMessage('Missing OAuth code or state parameter from Google redirect.');
      return;
    }

    hasExecuted.current = true;

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/calendar/callback`;
        const res = await handleCalendarCallback(code, state, redirectUri);
        setStatus('success');
        setMessage(`Successfully connected Google Calendar (${res.account_email})!`);

        const returnTo = sessionStorage.getItem('calendar_return_to') || '/calendar';
        sessionStorage.removeItem('calendar_return_to');

        setTimeout(() => {
          navigate(returnTo);
        }, 1800);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Failed to complete Google Calendar authentication.');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900/80 p-8 backdrop-blur">
        {status === 'processing' && (
          <div className="space-y-4">
            <Loader2 className="mx-auto size-10 animate-spin text-cyan-400" />
            <h2 className="text-lg font-medium text-white">Connecting Calendar</h2>
            <p className="text-xs text-neutral-400">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
            <h2 className="text-lg font-medium text-white">Calendar Connected!</h2>
            <p className="text-xs text-neutral-400">{message}</p>
            <p className="text-[11px] text-neutral-500">Redirecting to your calendar...</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => navigate('/calendar')}
                className="bg-cyan-600 text-xs text-white hover:bg-cyan-500 gap-1.5"
              >
                <Calendar className="size-3.5" />
                Go to Calendar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/meetings')}
                className="text-xs text-neutral-300 border-white/15 hover:bg-white/5"
              >
                View Meetings
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle className="mx-auto size-10 text-red-400" />
            <h2 className="text-lg font-medium text-white">Connection Failed</h2>
            <p className="text-xs text-red-300">{message}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/calendar')}
                className="text-xs text-neutral-300 border-white/15 hover:bg-white/5"
              >
                Back to Calendar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/meetings')}
                className="text-xs text-neutral-300 border-white/15 hover:bg-white/5"
              >
                Back to Meetings
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
