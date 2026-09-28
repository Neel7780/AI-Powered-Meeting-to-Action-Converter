import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Kanban, 
  FileText, 
  ShieldCheck, 
  Server, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [backendMessage, setBackendMessage] = useState<string>('');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    fetch(`${apiBaseUrl}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBackendStatus('connected');
        setBackendMessage(data.status || 'OK');
      })
      .catch((err) => {
        setBackendStatus('disconnected');
        setBackendMessage(err.message || 'Cannot connect');
      });
  }, [apiBaseUrl]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              ⚡
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">
              ActionPulse <span className="text-xs font-normal text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60">Sprint 1</span>
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>FastAPI Backend:</span>
              {backendStatus === 'checking' && (
                <span className="text-amber-400 flex items-center gap-1 font-medium">Checking...</span>
              )}
              {backendStatus === 'connected' && (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Online ({backendMessage})
                </span>
              )}
              {backendStatus === 'disconnected' && (
                <span className="text-rose-400 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3" /> Offline (start backend)
                </span>
              )}
            </div>
            <a
              href={`${apiBaseUrl}/docs`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              Swagger Docs &rarr;
            </a>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center">
        <div className="max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 text-indigo-400 border border-indigo-800/50 text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Meeting-to-Action Converter
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Sprint 1 Scaffold Ready
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
            Frontend and backend frameworks are fully initialized. Team members can now build their respective modules according to the Sprint 1 architecture guidelines.
          </p>
        </div>

        {/* Feature Module Cards for the 5 Sub-teams */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Auth & Workspace */}
          <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Auth & Workspaces</h2>
            <p className="text-sm text-slate-400 mb-4">
              Multi-tenant workspace isolation, Supabase Auth session, role-based controls (Admin, Organiser, Member).
            </p>
            <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
              <span>Owned by Pair 1</span>
            </div>
          </div>

          {/* Card 2: Ingest & AI Review */}
          <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Ingestion & AI Review</h2>
            <p className="text-sm text-slate-400 mb-4">
              Paste or upload transcripts (.vtt, .srt, .docx), Gemini 3.1 Flash-Lite grounded extraction, human review gate.
            </p>
            <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
              <span>Owned by Pair 2 &amp; 3 &amp; 4</span>
            </div>
          </div>

          {/* Card 3: Kanban & Tasks */}
          <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Kanban className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Kanban & Notifications</h2>
            <p className="text-sm text-slate-400 mb-4">
              4-column task board (To Do, In Progress, Blocked, Done), 1-tap WhatsApp sharing, free SMTP email alerts.
            </p>
            <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
              <span>Owned by Pair 5</span>
            </div>
          </div>
        </div>

        {/* Quick developer note */}
        <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Stack:</span>
            <span>React 18+ (Vite) + Tailwind CSS + Supabase JS (Anon Key) | FastAPI + Python 3.11</span>
          </div>
          <span className="text-slate-500 font-mono">schema: public</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        Team G-10 • IT314 Software Engineering • Sprint 1 Vertical Slice
      </footer>
    </div>
  );
}
