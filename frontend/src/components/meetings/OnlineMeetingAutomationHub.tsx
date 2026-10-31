import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Zap,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Play,
  ArrowRight,
  AlertCircle,
  Radio,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  automationApi,
  type AutomationStatusResponse,
  type ProviderType,
  type SimulateMeetingResponse,
  type AutomatedMeetingFeedItem,
} from '../../services/automationApi';

interface OnlineMeetingAutomationHubProps {
  workspaceId: string;
  onMeetingCreated?: () => void;
}

export const OnlineMeetingAutomationHub: React.FC<OnlineMeetingAutomationHubProps> = ({
  workspaceId,
  onMeetingCreated,
}) => {
  const navigate = useNavigate();

  const [statusData, setStatusData] = useState<AutomationStatusResponse | null>(null);
  const [feedItems, setFeedItems] = useState<AutomatedMeetingFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulation modal & runner state
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('zoom');
  const [meetingTitle, setMeetingTitle] = useState('Online Sprint Review & Webhook Sync');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulateMeetingResponse | null>(null);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAutomationData = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg(null);

    try {
      const [statusRes, feedRes] = await Promise.all([
        automationApi.getStatus(workspaceId),
        automationApi.getFeed(workspaceId),
      ]);
      setStatusData(statusRes);
      setFeedItems(feedRes);
    } catch (err: any) {
      console.warn('Failed to load automation data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAutomationData();
  }, [workspaceId]);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    setSimulationStep(1);
    setErrorMsg(null);

    try {
      // Step 1: Simulate Webhook Receive
      await new Promise((r) => setTimeout(r, 600));
      setSimulationStep(2);

      // Step 2: Download & Parse VTT Transcript
      await new Promise((r) => setTimeout(r, 700));
      setSimulationStep(3);

      const res = await automationApi.simulateMeeting({
        workspace_id: workspaceId,
        provider: selectedProvider,
        title: meetingTitle,
        duration_minutes: durationMinutes,
        auto_extract: true,
      });

      // Step 3: Complete & Show Grounded Tasks
      setSimulationStep(4);
      setSimulationResult(res);
      if (onMeetingCreated) onMeetingCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to simulate online meeting');
      setSimulationStep(0);
    } finally {
      setIsSimulating(false);
    }
  };

  const getProviderBrand = (provider: ProviderType) => {
    switch (provider) {
      case 'zoom':
        return {
          label: 'Zoom Video',
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
          badge: 'Cloud Webhook Active',
          iconColor: 'text-cyan-400',
        };
      case 'google_meet':
        return {
          label: 'Google Meet',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
          badge: 'Workspace API Ready',
          iconColor: 'text-emerald-400',
        };
      case 'teams':
        return {
          label: 'Microsoft Teams',
          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
          badge: 'Graph Listener Connected',
          iconColor: 'text-indigo-400',
        };
    }
  };

  if (isLoading && !statusData) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#060608] p-12 text-center text-xs text-neutral-400 animate-pulse">
        Connecting to online meeting automation services…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#060608] p-5 sm:p-6 shadow-2xl">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 size-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-400">
                <Radio className="size-3 animate-pulse text-indigo-400" />
                Sprint 2 Feature · Task 1
              </span>
              <span className="text-xs text-neutral-500">Zero-Touch Ingestion</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Online Meeting Automation & Auto-Ingest
            </h2>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              Eliminate manual transcript uploads. ActionPulse automatically listens for completed Google Meet,
              Zoom, and Microsoft Teams meetings, fetches cloud transcripts, and feeds them directly into the GenAI review pipeline.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAutomationData(true)}
              disabled={isRefreshing}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs h-9"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Sync Status
            </Button>

            <Button
              onClick={() => {
                setShowSimulateModal(true);
                setSimulationResult(null);
                setSimulationStep(0);
              }}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 text-xs h-9 font-medium"
            >
              <Play className="size-3.5 mr-1.5 fill-current" />
              Live Ingest Simulation
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Provider Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statusData?.providers.map((p) => {
          const brand = getProviderBrand(p.provider);
          return (
            <div
              key={p.provider}
              className="group rounded-xl border border-white/10 bg-[#060608] p-4 sm:p-5 transition-all duration-200 hover:border-white/20 hover:shadow-lg relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-lg border ${brand.color}`}>
                    <Video className={`size-5 ${brand.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">{p.name}</h3>
                    <p className="text-[11px] text-neutral-400 truncate max-w-[150px]">{p.account_email}</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Connected
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-mono text-[10px] uppercase">Listener Mode</span>
                  <span className="text-neutral-300 font-medium text-[11px]">{brand.badge}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-mono text-[10px] uppercase">Auto-Extract</span>
                  <span className="text-indigo-400 font-medium text-[11px] flex items-center gap-1">
                    <Sparkles className="size-3" /> Enabled
                  </span>
                </div>
              </div>

              <div className="mt-4 bg-white/[0.02] rounded-lg p-2.5 border border-white/5">
                <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                  {p.limitations || 'Ready to auto-ingest meeting audio transcripts upon completion.'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Recently Auto-Ingested Meetings Feed */}
      {feedItems.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-[#060608] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Recently Ingested Online Meetings ({feedItems.length})
            </h3>
            <span className="text-[11px] text-neutral-500">Grounded in cloud recordings</span>
          </div>

          <div className="divide-y divide-white/5">
            {feedItems.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Video className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-white">{item.title}</h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                      <span className="uppercase font-mono text-indigo-400">{item.provider}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(item.starts_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                    Auto-Extracted
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/meetings/${item.id}/review`)}
                    className="h-7 text-xs text-neutral-300 hover:text-white"
                  >
                    View Tasks
                    <ExternalLink className="size-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Simulation & Live Demo Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-[#0a0a0c] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Zap className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Simulate Online Meeting Webhook</h3>
                  <p className="text-xs text-neutral-400">Test zero-touch automated ingest from Zoom, Google Meet, or Teams</p>
                </div>
              </div>

              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!simulationResult ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-300">
                    Online Meeting Platform
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['zoom', 'google_meet', 'teams'] as ProviderType[]).map((p) => {
                      const brand = getProviderBrand(p);
                      const isSelected = selectedProvider === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedProvider(p)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                              : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-neutral-200'
                          }`}
                        >
                          <Video className="size-4" />
                          <span>{brand.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-300">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Q3 Architecture Review & Webhook Sync"
                    className="w-full rounded-lg border border-white/10 bg-[#060608] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-neutral-300">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-[#060608] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-neutral-300">
                      Auto-Extract Tasks
                    </label>
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#060608] px-3 text-xs text-neutral-300">
                      <Sparkles className="size-3.5 text-indigo-400" />
                      <span>Gemini GenAI Extraction</span>
                    </div>
                  </div>
                </div>

                {/* Progress Visualizer */}
                {isSimulating && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-indigo-400">
                      <div className="size-2 rounded-full bg-indigo-400 animate-ping" />
                      <span>Executing Real-time Online Automation Pipeline…</span>
                    </div>

                    <div className="space-y-1.5 text-xs text-neutral-400">
                      <div className={`flex items-center gap-2 ${simulationStep >= 1 ? 'text-white' : 'opacity-40'}`}>
                        {simulationStep > 1 ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <div className="size-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                        <span>1. Receiving provider webhook: <code>meeting.ended</code></span>
                      </div>
                      <div className={`flex items-center gap-2 ${simulationStep >= 2 ? 'text-white' : 'opacity-40'}`}>
                        {simulationStep > 2 ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <div className="size-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                        <span>2. Fetching & parsing cloud transcript (.VTT multi-speaker)</span>
                      </div>
                      <div className={`flex items-center gap-2 ${simulationStep >= 3 ? 'text-white' : 'opacity-40'}`}>
                        {simulationStep > 3 ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <div className="size-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                        <span>3. Grounding action items and saving segments in Supabase</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSimulateModal(false)}
                    disabled={isSimulating}
                    className="text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={handleRunSimulation}
                    disabled={isSimulating || !meetingTitle.trim()}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  >
                    {isSimulating ? 'Processing Pipeline…' : 'Trigger Automation Webhook'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
                  <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Online Meeting Ingestion Complete!</h4>
                  <p className="text-xs text-neutral-300">{simulationResult.message}</p>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-lg border border-white/10 bg-[#060608] p-3">
                    <div className="text-xs text-neutral-500">Platform</div>
                    <div className="mt-1 text-sm font-semibold text-white uppercase">{simulationResult.provider}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#060608] p-3">
                    <div className="text-xs text-neutral-500">Segments</div>
                    <div className="mt-1 text-sm font-semibold text-indigo-400">{simulationResult.segment_count} Cues</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#060608] p-3">
                    <div className="text-xs text-neutral-500">Tasks Extracted</div>
                    <div className="mt-1 text-sm font-semibold text-emerald-400">{simulationResult.extracted_items_count} Action Items</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSimulateModal(false);
                      loadAutomationData(true);
                    }}
                    className="text-neutral-400 hover:text-white text-xs"
                  >
                    Done
                  </Button>

                  <Button
                    onClick={() => navigate(simulationResult.review_url)}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 text-xs font-medium"
                  >
                    Open Review Gate & Approve Tasks
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineMeetingAutomationHub;
