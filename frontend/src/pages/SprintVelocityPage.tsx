import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  GitCompare,
  BarChart2,
  AlertTriangle,
  SquareKanban,
  CalendarDays,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  fetchSprintVelocity,
  DEMO_VELOCITY_DATA,
} from '../services/velocityApi';
import type { SprintVelocityData } from '../types/velocity';
import { VelocityKpiCards } from '../components/velocity/VelocityKpiCards';
import { MeetingDiffSelector } from '../components/velocity/MeetingDiffSelector';
import { MeetingProgressDiffView } from '../components/velocity/MeetingProgressDiffView';
import { VelocityTrendChart } from '../components/velocity/VelocityTrendChart';
import { ChronicSpilloverAlert } from '../components/velocity/ChronicSpilloverAlert';
import { Button } from '../components/ui/button';

export default function SprintVelocityPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || 'default-workspace';

  const [data, setData] = useState<SprintVelocityData>(DEMO_VELOCITY_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedBaseId, setSelectedBaseId] = useState<string | undefined>();
  const [selectedCurrentId, setSelectedCurrentId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'diff' | 'trend' | 'chronic'>('diff');

  const loadData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      try {
        const resp = await fetchSprintVelocity(workspaceId, selectedBaseId, selectedCurrentId);
        setData(resp);
      } catch (err) {
        console.error('Error in SprintVelocityPage:', err);
        setData(DEMO_VELOCITY_DATA);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspaceId, selectedBaseId, selectedCurrentId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectMeetings = (baseId: string, currentId: string) => {
    setSelectedBaseId(baseId);
    setSelectedCurrentId(currentId);
  };

  const isDemo = data.workspace_id === 'demo-workspace';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Sprint Velocity & Meeting Progress
                </h1>
                {isDemo ? (
                  <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                    Sample Dataset
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live Data
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Meeting-to-meeting delta tracking, carryover spillover rates, and velocity burnup
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick link to Kanban Board */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tasks')}
            className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300 text-xs"
            title="Navigate to Tasks & Kanban Board"
          >
            <SquareKanban className="size-3.5 mr-1.5 text-indigo-400" />
            Kanban Board
          </Button>

          {/* Quick link to Calendar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/calendar')}
            className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300 text-xs"
            title="View Upcoming Meetings Calendar"
          >
            <CalendarDays className="size-3.5 mr-1.5 text-blue-400" />
            Calendar
          </Button>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300 text-xs"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !refreshing && (
        <div className="flex items-center gap-2 text-xs text-neutral-400 py-1">
          <RefreshCw className="size-3.5 animate-spin text-indigo-400" />
          <span>Analyzing meeting velocity and carryovers...</span>
        </div>
      )}

      {/* 2. Top-Level KPI Cards */}
      <VelocityKpiCards diff={data.selected_diff} overallKpis={data.kpis} />

      {/* 3. Meeting-to-Meeting Selection Controls */}
      <MeetingDiffSelector
        meetings={data.available_meetings}
        selectedDiff={data.selected_diff}
        onSelectMeetings={handleSelectMeetings}
      />

      {/* 4. Chronic Spillover Alert (if any multi-meeting rollover detected) */}
      <ChronicSpilloverAlert tasks={data.chronic_spillovers} />

      {/* 5. View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'diff'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <GitCompare className="size-3.5" />
            <span>Meeting Progress Delta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trend')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'trend'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BarChart2 className="size-3.5" />
            <span>Velocity Trendline</span>
          </button>

          {data.chronic_spillovers.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('chronic')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'chronic'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="size-3.5 text-amber-400" />
              <span>Chronic Spillovers ({data.chronic_spillovers.length})</span>
            </button>
          )}
        </div>

        <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline">
          {data.selected_diff?.base_meeting.title} ➔ {data.selected_diff?.current_meeting.title}
        </span>
      </div>

      {/* 6. Active Tab Content Rendering */}
      {activeTab === 'diff' ? (
        <MeetingProgressDiffView diff={data.selected_diff} onRefresh={() => loadData(true)} />
      ) : activeTab === 'trend' ? (
        <VelocityTrendChart trendHistory={data.trend_history} />
      ) : (
        <ChronicSpilloverAlert tasks={data.chronic_spillovers} />
      )}

      {/* 7. Bottom Velocity Trend Section (always visible when diff is active for full context) */}
      {activeTab === 'diff' && (
        <div className="pt-2">
          <VelocityTrendChart trendHistory={data.trend_history} />
        </div>
      )}
    </div>
  );
}
