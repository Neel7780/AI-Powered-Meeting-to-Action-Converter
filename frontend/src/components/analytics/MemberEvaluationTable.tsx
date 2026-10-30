import React from 'react';
import { Lock, ShieldCheck, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { MemberPerformanceItem } from '../../services/analyticsApi';

interface MemberEvaluationTableProps {
  memberEvaluations: MemberPerformanceItem[] | null;
  userRole: string;
}

export const MemberEvaluationTable: React.FC<MemberEvaluationTableProps> = ({
  memberEvaluations,
  userRole,
}) => {
  const isManager = userRole === 'admin' || userRole === 'organiser';

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
      {/* Header with Role Permission Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <UserCheck className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Employee Performance & Workload Scorecard</h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-indigo-300 border border-indigo-500/30">
                <ShieldCheck className="size-3" />
                Manager Access Only
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Tracks task completion turnaround, on-time delivery rate, and overdue workloads per employee
            </p>
          </div>
        </div>
      </div>

      {/* Role-Based Guard: If user is regular member, evaluations are hidden */}
      {!isManager || memberEvaluations === null ? (
        <div className="my-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-6 text-center">
          <Lock className="mx-auto size-8 text-amber-400/70 mb-2" />
          <h4 className="text-sm font-semibold text-amber-300">Confidential Manager View</h4>
          <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">
            Individual employee performance scorecards are restricted to Workspace Managers and Organisers 
            to uphold team privacy and healthy sprint governance.
          </p>
        </div>
      ) : memberEvaluations.length === 0 ? (
        <div className="py-8 text-center text-xs text-neutral-500">
          No team members or task assignments found in this workspace.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="bg-white/[0.02] text-xs font-medium uppercase tracking-wider text-neutral-400 border-b border-white/5">
              <tr>
                <th scope="col" className="px-4 py-3">Employee</th>
                <th scope="col" className="px-4 py-3 text-center">Assigned</th>
                <th scope="col" className="px-4 py-3 text-center">Completed</th>
                <th scope="col" className="px-4 py-3 text-center">On-Time</th>
                <th scope="col" className="px-4 py-3 text-center">Late</th>
                <th scope="col" className="px-4 py-3 text-center">Overdue</th>
                <th scope="col" className="px-4 py-3 text-right">On-Time Delivery Rate</th>
                <th scope="col" className="px-4 py-3 text-right">Avg Turnaround</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {memberEvaluations.map((m) => (
                <tr key={m.user_id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Name and Role */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-200 border border-white/10">
                        {m.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate max-w-[160px]">
                        <div className="font-medium text-white truncate">{m.display_name}</div>
                        <div className="text-[11px] text-neutral-500 truncate">{m.email}</div>
                      </div>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-neutral-400 capitalize border border-white/5">
                        {m.role}
                      </span>
                    </div>
                  </td>

                  {/* Total Assigned */}
                  <td className="px-4 py-3.5 text-center font-medium text-white">
                    {m.total_assigned}
                  </td>

                  {/* Completed Total */}
                  <td className="px-4 py-3.5 text-center text-emerald-400 font-medium">
                    {m.completed_total}
                  </td>

                  {/* Completed On-Time */}
                  <td className="px-4 py-3.5 text-center text-neutral-300">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-400" />
                      {m.completed_on_time}
                    </span>
                  </td>

                  {/* Missed / Late */}
                  <td className="px-4 py-3.5 text-center">
                    {m.completed_late > 0 ? (
                      <span className="text-amber-400 font-medium">{m.completed_late}</span>
                    ) : (
                      <span className="text-neutral-500">0</span>
                    )}
                  </td>

                  {/* Currently Overdue */}
                  <td className="px-4 py-3.5 text-center">
                    {m.currently_overdue > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/30">
                        <AlertCircle className="size-3" />
                        {m.currently_overdue}
                      </span>
                    ) : (
                      <span className="text-neutral-500">0</span>
                    )}
                  </td>

                  {/* On-Time Rate Progress */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium text-white">{m.on_time_rate}%</span>
                      <div className="h-1.5 w-16 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            m.on_time_rate >= 80 ? 'bg-emerald-400' : m.on_time_rate >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, m.on_time_rate))}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Avg Cycle Hours */}
                  <td className="px-4 py-3.5 text-right text-xs text-neutral-400">
                    {m.avg_cycle_time_hours ? `${m.avg_cycle_time_hours} hrs` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
