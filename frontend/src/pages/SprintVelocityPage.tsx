import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  SquareKanban,
  CalendarDays,
  AlertTriangle,
  ArrowRight,
  GitCompare,
  BarChart2,
  Calendar,
  Layers,
  Video,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { supabase } from '../lib/supabase';
import {
  fetchSprintVelocity,
  EMPTY_VELOCITY_DATA,
} from '../services/velocityApi';
import type { SprintVelocityData } from '../types/velocity';
import { VelocityKpiCards } from '../components/velocity/VelocityKpiCards';
import { MeetingDiffSelector } from '../components/velocity/MeetingDiffSelector';
import { MeetingProgressDiffView } from '../components/velocity/MeetingProgressDiffView';
import { VelocityTrendChart } from '../components/velocity/VelocityTrendChart';
import { ChronicSpilloverAlert } from '../components/velocity/ChronicSpilloverAlert';
import { Button } from '../components/ui/button';

const tabs = [
  ['overview', 'Overview'],
  ['diff', 'Progress Delta'],
  ['trend', 'Velocity Trend'],
  ['bottlenecks', 'Chronic Bottlenecks'],
] as const;
type Tab = typeof tabs[number][0];

export default function SprintVelocityPage() {
  const navigate = useNavigate();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const [data, setData] = useState<SprintVelocityData>(EMPTY_VELOCITY_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>();
  const [selectedCurrentId, setSelectedCurrentId] = useState<string | undefined>();

  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useLocation();
  const desiredTab = searchParams.get('tab') as Tab;
  const tab = tabs.some(([id]) => id === desiredTab) ? desiredTab : 'overview';
  const setTab = (next: Tab) => setSearchParams({ tab: next }, { state });

  const loadData = useCallback(
    async (isManual = false) => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      if (isManual) setRefreshing(true);
      else setLoading(true);

      try {
        const resp = await fetchSprintVelocity(workspaceId, selectedBaseId, selectedCurrentId);
        setData(resp);
      } catch (err) {
        console.error('Error in SprintVelocityPage:', err);
        setData({ ...EMPTY_VELOCITY_DATA, workspace_id: workspaceId });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspaceId, selectedBaseId, selectedCurrentId]
  );

  useEffect(() => {
    if (workspaceId) {
      loadData();
    } else if (!workspaceLoading) {
      setLoading(false);
    }
  }, [workspaceId, workspaceLoading, loadData]);

  // Realtime Supabase subscription for live updates across meetings and tasks
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`velocity-sync:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings', filter: `workspace_id=eq.${workspaceId}` },
        () => loadData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        () => loadData(true)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, loadData]);

  const handleSelectMeetings = (baseId: string, currentId: string) => {
    setSelectedBaseId(baseId);
    setSelectedCurrentId(currentId);
  };

  const totalDiffTasks = data.selected_diff
    ? data.selected_diff.completed_tasks.length +
      data.selected_diff.carried_over_tasks.length +
      data.selected_diff.new_action_items.length
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      {/* 1. Header Bar */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold tracking-tight text-white">
                    Sprint Velocity & Meeting Progress
                  </h1>
                  {currentWorkspace?.name && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[11px] text-neutral-300">
                      {currentWorkspace.name}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-400">
                  Track delivered commitments, carried-over tasks, and delivery velocity across meetings
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/tasks')}
              className="h-8 border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-neutral-300 text-xs px-2.5"
              title="Navigate to Tasks"
            >
              <SquareKanban className="size-3.5 mr-1.5 text-indigo-400" />
              Tasks Board
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/calendar')}
              className="h-8 border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-neutral-300 text-xs px-2.5"
              title="View Calendar"
            >
              <CalendarDays className="size-3.5 mr-1.5 text-blue-400" />
              Calendar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing || !workspaceId}
              className="h-8 border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-neutral-300 text-xs px-2.5"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Tab Navigation Bar */}
      <nav aria-label="Velocity sections" className="flex flex-wrap gap-1 border-b border-white/10 pb-3">
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            asChild
            size="sm"
            variant={tab === id ? 'secondary' : 'ghost'}
          >
            <Link to={`?tab=${id}`} state={state} aria-current={tab === id ? 'page' : undefined}>
              {label}
              {id === 'diff' && totalDiffTasks > 0 && (
                <span className="ml-1.5 rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-200 font-mono">
                  {totalDiffTasks}
                </span>
              )}
              {id === 'bottlenecks' && data.chronic_spillovers.length > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] text-red-300 font-mono">
                  {data.chronic_spillovers.length}
                </span>
              )}
            </Link>
          </Button>
        ))}
      </nav>

      {/* Loading States */}
      {(workspaceLoading || (loading && !refreshing)) && (
        <div className="flex items-center gap-2 text-xs text-neutral-400 py-2">
          <RefreshCw className="size-3.5 animate-spin text-indigo-400" />
          <span>Syncing live workspace sprint metrics from backend...</span>
        </div>
      )}

      {/* Empty State: No Workspace Selected */}
      {!workspaceLoading && !workspaceId && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center max-w-xl mx-auto space-y-4 my-8">
          <div className="size-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <TrendingUp className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">No Workspace Selected</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Please select or create a workspace to view sprint velocity and meeting progress tracking.
            </p>
          </div>
        </div>
      )}

      {/* Empty State: No Meetings in Current Workspace */}
      {!loading && !workspaceLoading && workspaceId && data.available_meetings.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center max-w-xl mx-auto space-y-4 my-8">
          <div className="size-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Video className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">No Meetings Found</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              This workspace doesn't have any recorded meetings yet. Once you record, upload, or sync meetings in this workspace, ActionPulse will automatically compute meeting-to-meeting deliverable deltas, sprint velocity, and carryover bottlenecks.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button onClick={() => navigate('/meetings')} size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
              Go to Meetings
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadData(true)}>
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      )}

      {/* 3. Tab Contents with Live Data */}
      {data.available_meetings.length > 0 && (
        <>
          {/* TAB 1: OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Meeting cycle selector */}
              {data.available_meetings.length >= 2 ? (
                <MeetingDiffSelector
                  meetings={data.available_meetings}
                  selectedDiff={data.selected_diff}
                  onSelectMeetings={handleSelectMeetings}
                />
              ) : (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-300 flex items-center justify-between">
                  <span>1 meeting recorded in this workspace. Record a 2nd meeting to unlock consecutive comparative deltas and spillover analytics.</span>
                  <Button size="sm" variant="outline" className="border-indigo-500/30 text-indigo-200" onClick={() => navigate('/meetings')}>
                    View Meetings
                  </Button>
                </div>
              )}

              {/* 4 Metric KPI Cards + Ratio Bar */}
              <VelocityKpiCards diff={data.selected_diff} overallKpis={data.kpis} />

              {/* Chronic Rollover Attention Banner if needed */}
              {data.chronic_spillovers.length > 0 && (
                <section className="dashboard-surface flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-500/25 bg-red-500/5 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-400">
                      <AlertTriangle className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Chronic Rollover Bottlenecks</h2>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {data.chronic_spillovers.length} {data.chronic_spillovers.length === 1 ? 'task has' : 'tasks have'} rolled over across 2 or more meetings without delivery.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                    onClick={() => setTab('bottlenecks')}
                  >
                    Review Bottlenecks ({data.chronic_spillovers.length}) <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                </section>
              )}

              {/* 2-Column Summary Cards */}
              <div className="grid items-start gap-5 lg:grid-cols-2">
                {/* Card 1: Cycle Progress Highlights */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <GitCompare className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Meeting Progress Delta</h3>
                        <p className="text-[11px] text-neutral-400">
                          Deliverables compared between selected meetings
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs text-indigo-400 hover:text-indigo-300 p-0 h-auto" onClick={() => setTab('diff')}>
                      View Full Delta <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </div>

                  {data.selected_diff ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-neutral-400" />
                          <span className="text-neutral-300 font-medium">Cadence Interval:</span>
                        </div>
                        <span className="text-neutral-400 font-mono">{data.selected_diff.days_between_meetings} days</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                          <span className="text-base font-bold text-emerald-400 font-mono">
                            {data.selected_diff.completed_tasks.length}
                          </span>
                          <p className="text-[10px] text-neutral-400 mt-0.5">Delivered</p>
                        </div>

                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                          <span className="text-base font-bold text-amber-400 font-mono">
                            {data.selected_diff.carried_over_tasks.length}
                          </span>
                          <p className="text-[10px] text-neutral-400 mt-0.5">Carried Over</p>
                        </div>

                        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2.5">
                          <span className="text-base font-bold text-indigo-400 font-mono">
                            {data.selected_diff.new_action_items.length}
                          </span>
                          <p className="text-[10px] text-neutral-400 mt-0.5">New Items</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">Select two meetings above to inspect progress delta.</p>
                  )}
                </div>

                {/* Card 2: Sprint Velocity Health */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <BarChart2 className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Historical Velocity Trend</h3>
                        <p className="text-[11px] text-neutral-400">
                          Overall delivery throughput across recent sprints
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs text-indigo-400 hover:text-indigo-300 p-0 h-auto" onClick={() => setTab('trend')}>
                      View Trend Chart <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2">
                        <Layers className="size-3.5 text-neutral-400" />
                        <span className="text-neutral-300 font-medium">Average Sprint Velocity:</span>
                      </div>
                      <span className="text-emerald-400 font-bold font-mono">{data.kpis.average_velocity}%</span>
                    </div>

                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-3.5 text-neutral-400" />
                        <span className="text-neutral-300 font-medium">Total Tasks Completed:</span>
                      </div>
                      <span className="text-indigo-400 font-bold font-mono">{data.kpis.total_completed_tasks} tasks</span>
                    </div>

                    <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-amber-400" />
                        <span className="text-neutral-300 font-medium">Overall Spillover Rate:</span>
                      </div>
                      <span className="text-amber-400 font-bold font-mono">{data.kpis.overall_spillover_rate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROGRESS DELTA */}
          {tab === 'diff' && (
            <div className="space-y-4">
              <MeetingDiffSelector
                meetings={data.available_meetings}
                selectedDiff={data.selected_diff}
                onSelectMeetings={handleSelectMeetings}
              />
              <MeetingProgressDiffView diff={data.selected_diff} onRefresh={() => loadData(true)} />
            </div>
          )}

          {/* TAB 3: VELOCITY TREND */}
          {tab === 'trend' && (
            <div className="space-y-4">
              <VelocityTrendChart trendHistory={data.trend_history} />
            </div>
          )}

          {/* TAB 4: CHRONIC BOTTLENECKS */}
          {tab === 'bottlenecks' && (
            <div className="space-y-4">
              <ChronicSpilloverAlert tasks={data.chronic_spillovers} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
