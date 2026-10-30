import { useEffect, useState, useCallback } from 'react';
import { BarChart3, RefreshCw, AlertCircle, LoaderCircle } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  fetchWorkspaceAnalytics,
  type WorkspaceAnalyticsResponse,
  DEMO_ANALYTICS_DATA,
} from '../services/analyticsApi';
import { KpiCards } from '../components/analytics/KpiCards';
import { MemberEvaluationTable } from '../components/analytics/MemberEvaluationTable';
import { TaskBreakdownSection } from '../components/analytics/TaskBreakdownSection';
import { BottleneckSection } from '../components/analytics/BottleneckSection';
import { Button } from '../components/ui/button';

export default function AnalyticsPage() {
  const { currentWorkspace, currentRole } = useWorkspace();
  const workspaceId = currentWorkspace?.id || 'default-workspace';

  const [timeframe, setTimeframe] = useState<string>('30d');
  const [data, setData] = useState<WorkspaceAnalyticsResponse>(DEMO_ANALYTICS_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await fetchWorkspaceAnalytics(workspaceId, timeframe);
      setData(resp);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err?.message || 'Failed to fetch workspace analytics');
      setData(DEMO_ANALYTICS_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspaceId, timeframe]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Workspace Analytics & Health
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Turnaround metrics, bottleneck detection, and team performance tracking
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Timeframe Filter + Refresh */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Timeframe Pills */}
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-1 text-xs">
            {(['7d', '30d', '90d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : tf === '90d' ? '90 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadAnalytics(true)}
            disabled={refreshing}
            className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-neutral-300"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !refreshing && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <LoaderCircle className="size-3.5 animate-spin text-indigo-400" />
          <span>Synchronizing analytics from meetings and task boards…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. High-Level KPI Summary Cards */}
      <KpiCards kpis={data.kpis} />

      {/* 2. Manager-Only Employee Scorecard (RBAC) */}
      <MemberEvaluationTable
        memberEvaluations={data.member_evaluations}
        userRole={currentRole || data.user_role || 'member'}
      />

      {/* 3. Task Status, Priority & Meeting Follow-Through */}
      <TaskBreakdownSection
        statusBreakdown={data.kpis.status_breakdown}
        priorityBreakdown={data.kpis.priority_breakdown}
        meetingYield={data.meeting_yield}
      />

      {/* 4. Workflow Bottlenecks & Blocked Chains */}
      <BottleneckSection bottlenecks={data.bottlenecks} />
    </div>
  );
}
