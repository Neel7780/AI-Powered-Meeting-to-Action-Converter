import React, { useState, useMemo } from 'react';
import type { KanbanTaskItem, TaskStatus } from './KanbanCard';
import {
  GitFork,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Bot,
  User,
  Link as LinkIcon,
  Filter,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface WorkflowChainsViewProps {
  tasks: KanbanTaskItem[];
  onOpenDependencyModal: (task: KanbanTaskItem) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
}

export const WorkflowChainsView: React.FC<WorkflowChainsViewProps> = ({
  tasks,
  onOpenDependencyModal,
  onStatusChange,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'blocked' | 'agent' | 'chains'>('all');

  // Map tasks by ID for fast lookup
  const taskMap = useMemo(() => {
    const map = new Map<string, KanbanTaskItem>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Find all tasks that are roots (have no prerequisites)
  const rootTasks = useMemo(() => {
    return tasks.filter((t) => !t.blocked_by);
  }, [tasks]);

  // Group into distinct workflow chains (Root ➔ Dependents)
  const workflowChains = useMemo(() => {
    const chains: Array<{ root: KanbanTaskItem; dependents: KanbanTaskItem[] }> = [];

    rootTasks.forEach((root) => {
      // Find all tasks directly or indirectly blocked by this root
      const directDependents = tasks.filter((t) => t.blocked_by === root.id);
      if (directDependents.length > 0) {
        // Collect entire chain recursively
        const collected: KanbanTaskItem[] = [...directDependents];
        directDependents.forEach((dep) => {
          const subDependents = tasks.filter((t) => t.blocked_by === dep.id);
          collected.push(...subDependents);
        });
        chains.push({ root, dependents: collected });
      }
    });

    return chains;
  }, [rootTasks, tasks]);

  // Key KPI Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const blockedCount = tasks.filter((t) => t.status === 'blocked' || (t.blocked_by && taskMap.get(t.blocked_by)?.status !== 'done')).length;
    const agentTasksCount = tasks.filter((t) => t.execution_type === 'agent').length;
    const totalChains = workflowChains.length;

    return { total, blockedCount, agentTasksCount, totalChains };
  }, [tasks, taskMap, workflowChains]);

  // Filtered tasks display
  const filteredChains = useMemo(() => {
    if (filterMode === 'blocked') {
      return workflowChains.filter((chain) =>
        chain.dependents.some((d) => d.status === 'blocked' || (d.blocked_by && taskMap.get(d.blocked_by)?.status !== 'done'))
      );
    }
    if (filterMode === 'agent') {
      return workflowChains.filter((chain) =>
        chain.root.execution_type === 'agent' || chain.dependents.some((d) => d.execution_type === 'agent')
      );
    }
    return workflowChains;
  }, [workflowChains, filterMode, taskMap]);

  return (
    <div className="space-y-6">
      {/* 1. Header KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#202020] dark:bg-[#0c0c0e]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Active Chains
            </span>
            <GitFork className="size-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.totalChains}</p>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500">Multi-step task workflows</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#202020] dark:bg-[#0c0c0e]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Currently Blocked
            </span>
            <AlertCircle className="size-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{metrics.blockedCount}</p>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500">Waiting on prerequisites</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#202020] dark:bg-[#0c0c0e]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Agent Workflows
            </span>
            <Bot className="size-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">{metrics.agentTasksCount}</p>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500">AI auto-executable tasks</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#202020] dark:bg-[#0c0c0e]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-neutral-400">
              Total Board Tasks
            </span>
            <Layers className="size-4 text-slate-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</p>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500">Tracked in workspace</p>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-[#202020] dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mr-2 flex items-center gap-1">
            <Filter className="size-3.5" /> Filter Chains:
          </span>
          <button
            onClick={() => setFilterMode('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white dark:bg-white dark:text-black'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-white/5'
            }`}
          >
            All Chains ({workflowChains.length})
          </button>
          <button
            onClick={() => setFilterMode('blocked')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              filterMode === 'blocked'
                ? 'bg-red-600 text-white dark:bg-red-500 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-white/5'
            }`}
          >
            Blocked Chains Only
          </button>
          <button
            onClick={() => setFilterMode('agent')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              filterMode === 'agent'
                ? 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-white/5'
            }`}
          >
            Agent Automated Chains
          </button>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-neutral-500">
          Click any task card to edit prerequisites or toggle AI execution.
        </p>
      </div>

      {/* 3. Visual Workflow Chains List */}
      <div className="space-y-4">
        {filteredChains.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-neutral-800 dark:bg-[#0c0c0e]">
            <GitFork className="mx-auto size-8 text-slate-400 dark:text-neutral-600" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              No workflow chains match this filter
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Link tasks together by opening any task and setting a prerequisite dependency.
            </p>
          </div>
        ) : (
          filteredChains.map((chain, idx) => (
            <div
              key={chain.root.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 dark:border-[#202020] dark:bg-[#08080a] dark:hover:border-white/20"
            >
              {/* Chain Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-indigo-50 font-mono text-xs font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Workflow Sequence: {chain.root.title.slice(0, 45)}...
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 dark:text-neutral-500">
                  {chain.dependents.length + 1} steps total
                </span>
              </div>

              {/* Horizontal Sequence Flow */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 overflow-x-auto pb-2">
                {/* Step 1: Root Prerequisite Task Card */}
                <div
                  onClick={() => onOpenDependencyModal(chain.root)}
                  role="button"
                  tabIndex={0}
                  className="flex-1 min-w-[280px] rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition hover:border-indigo-400 hover:shadow-md cursor-pointer dark:border-white/10 dark:bg-[#121216] dark:hover:border-indigo-400"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-indigo-500" />
                      Step 1 (Root Prerequisite)
                    </span>
                    {chain.root.execution_type === 'agent' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        <Bot className="size-3" /> Agent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-neutral-300">
                        <User className="size-3" /> Human
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {chain.root.title}
                  </h4>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(chain.root.id, chain.root.status === 'done' ? 'todo' : 'done');
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition cursor-pointer hover:opacity-80 ${
                        chain.root.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}
                      title="Click to toggle Done/Todo"
                    >
                      {chain.root.status === 'done' ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                      {chain.root.status.toUpperCase()}
                    </button>
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500">Click to edit</span>
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="flex justify-center items-center py-1 lg:py-0">
                  <div className="flex items-center gap-1 text-slate-400 dark:text-neutral-600">
                    <span className="hidden lg:block w-4 h-0.5 bg-slate-300 dark:bg-neutral-700" />
                    <ArrowRight className="size-4 text-indigo-500 animate-pulse" />
                  </div>
                </div>

                {/* Downstream Dependent Tasks */}
                {chain.dependents.map((dep, depIdx) => {
                  const blockingParent = taskMap.get(dep.blocked_by || '');
                  const isBlockedByUnfinished = blockingParent && blockingParent.status !== 'done';

                  return (
                    <React.Fragment key={dep.id}>
                      <div
                        onClick={() => onOpenDependencyModal(dep)}
                        role="button"
                        tabIndex={0}
                        className={`flex-1 min-w-[280px] rounded-xl border p-3.5 transition hover:shadow-md cursor-pointer ${
                          isBlockedByUnfinished
                            ? 'border-red-200 bg-red-50/40 hover:border-red-400 dark:border-red-900/40 dark:bg-red-950/15 dark:hover:border-red-500'
                            : 'border-slate-200 bg-slate-50/50 hover:border-indigo-400 dark:border-white/10 dark:bg-[#121216] dark:hover:border-indigo-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                            isBlockedByUnfinished
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            <span className={`size-1.5 rounded-full ${isBlockedByUnfinished ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            Step {depIdx + 2} {isBlockedByUnfinished ? '(Blocked)' : '(Unlocked)'}
                          </span>
                          {dep.execution_type === 'agent' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              <Bot className="size-3" /> Agent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-neutral-300">
                              <User className="size-3" /> Human
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {dep.title}
                        </h4>

                        {/* Blocked Explanation */}
                        {isBlockedByUnfinished ? (
                          <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 bg-red-100/60 dark:bg-red-950/40 p-1.5 rounded flex items-center gap-1 truncate">
                            <AlertCircle className="size-3 shrink-0" />
                            <span className="truncate">Waiting for Step {depIdx + 1} to finish</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/40 p-1.5 rounded flex items-center gap-1 truncate">
                            <CheckCircle2 className="size-3 shrink-0" />
                            <span>Prerequisites met · Ready to execute</span>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between text-[11px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(dep.id, dep.status === 'done' ? 'todo' : 'done');
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition cursor-pointer hover:opacity-80 ${
                              dep.status === 'done'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : isBlockedByUnfinished
                                ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400'
                            }`}
                            title="Click to toggle Done/Todo"
                          >
                            {dep.status === 'done' ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                            {dep.status.toUpperCase()}
                          </button>
                          <span className="text-[10px] text-slate-400 dark:text-neutral-500">Click to edit</span>
                        </div>
                      </div>

                      {depIdx < chain.dependents.length - 1 && (
                        <div className="flex justify-center items-center py-1 lg:py-0">
                          <ArrowRight className="size-4 text-slate-400 dark:text-neutral-600" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Independent Tasks Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#202020] dark:bg-[#0c0c0e]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="size-4 text-slate-500" />
              Independent Tasks ({rootTasks.filter((t) => !tasks.some((o) => o.blocked_by === t.id)).length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Tasks without prerequisites or dependents. Click any task to start a new dependency chain.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rootTasks
            .filter((t) => !tasks.some((o) => o.blocked_by === t.id))
            .map((task) => (
              <div
                key={task.id}
                onClick={() => onOpenDependencyModal(task)}
                role="button"
                tabIndex={0}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition hover:border-indigo-400 hover:bg-slate-100/50 cursor-pointer dark:border-white/10 dark:bg-[#121216] dark:hover:border-indigo-400"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-neutral-500">
                      {task.status}
                    </span>
                    {task.execution_type === 'agent' && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                        <Bot className="size-3" /> Agent
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {task.title}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <LinkIcon className="size-3.5 mr-1" /> Link
                </Button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
