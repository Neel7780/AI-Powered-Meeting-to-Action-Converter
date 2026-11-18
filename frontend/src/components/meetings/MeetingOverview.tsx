import { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, ListTodo, Users } from 'lucide-react';
import type { KanbanTaskItem } from '../kanban/KanbanCard';
import { Button } from '../ui/button';

interface Participant { id: string; name: string; userId?: string }
interface Props {
  participants: Participant[];
  tasks: KanbanTaskItem[];
  onShowTasks: () => void;
}

/** Progress measures approved tasks; people without assignments stay visible. */
export function MeetingOverview({ participants, tasks, onShowTasks }: Props) {
  const [now] = useState(Date.now);
  const people = new Map(participants.map((p) => [p.userId || p.id, p]));
  for (const task of tasks) {
    for (const assignee of task.task_assignees || []) {
      if (!people.has(assignee.user_id)) people.set(assignee.user_id, {
        id: assignee.user_id, userId: assignee.user_id,
        name: assignee.profiles?.display_name || assignee.profiles?.email || 'Team member',
      });
    }
    if (task.external_owner_label && ![...people.values()].some((p) => !p.userId && p.name === task.external_owner_label)) {
      people.set(`external:${task.external_owner_label}`, { id: `external:${task.external_owner_label}`, name: task.external_owner_label });
    }
  }
  const overdue = (t: KanbanTaskItem) => t.status !== 'done' && !!t.deadline_utc && new Date(t.deadline_utc).getTime() < now;
  const done = tasks.filter((t) => t.status === 'done').length;
  const completion = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const late = tasks.filter(overdue).length;
  const attention = tasks.filter((t) => t.status === 'blocked' || overdue(t));
  const unassigned = tasks.filter((t) => !t.task_assignees?.length && !t.external_owner_label).length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between gap-3"><div>
          <h3 className="text-sm font-semibold text-white">Meeting progress</h3>
          <p className="mt-1 text-xs text-neutral-400">{done} of {tasks.length} confirmed tasks completed</p>
        </div><span className="text-3xl font-semibold tracking-tight text-white">{completion}%</span></div>
        <div role="progressbar" aria-label="Meeting task completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
          <div><span className="flex items-center gap-1.5 text-neutral-500"><Clock className="size-3.5" /> In progress</span><p className="mt-1 text-lg font-semibold text-white">{tasks.filter((t) => t.status === 'in_progress').length}</p></div>
          <div><span className="flex items-center gap-1.5 text-neutral-500"><AlertCircle className="size-3.5" /> Blocked</span><p className="mt-1 text-lg font-semibold text-amber-300">{blocked}</p></div>
          <div><span className="flex items-center gap-1.5 text-neutral-500"><Clock className="size-3.5" /> Overdue</span><p className="mt-1 text-lg font-semibold text-rose-300">{late}</p></div>
        </div>
        {!tasks.length && <p className="mt-4 text-xs leading-5 text-neutral-400">No confirmed tasks for this meeting yet.</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-white/10">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4"><Users className="size-4 text-indigo-300" /><h3 className="text-sm font-semibold text-white">Participant progress</h3></div>
        {people.size === 0 ? <p className="p-5 text-xs text-neutral-400">No participants or task assignees yet.</p> : (
          <div className="divide-y divide-white/5">{[...people.values()].map((person) => {
            const assigned = tasks.filter((t) => person.userId ? t.task_assignees?.some((a) => a.user_id === person.userId) : t.external_owner_label === person.name);
            const completed = assigned.filter((t) => t.status === 'done').length;
            const percent = assigned.length ? Math.round(completed / assigned.length * 100) : 0;
            const blockers = assigned.filter((t) => t.status === 'blocked').length;
            return <div key={person.id} className="flex items-center gap-3 px-5 py-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-medium text-indigo-300">{person.name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2)}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm text-white">{person.name}</p><p className="mt-0.5 text-xs text-neutral-500">{assigned.length ? `${completed}/${assigned.length} tasks done${blockers ? ` · ${blockers} blocked` : ''}` : 'No assigned tasks'}</p></div>
              {assigned.length > 0 && <div className="w-20 shrink-0 text-right"><span className="text-xs text-neutral-300">{percent}%</span><div className="mt-1.5 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-indigo-400" style={{ width: `${percent}%` }} /></div></div>}
            </div>;
          })}</div>
        )}
        {unassigned > 0 && <p className="border-t border-white/10 px-5 py-3 text-xs text-amber-300">{unassigned} task{unassigned === 1 ? '' : 's'} still need an owner.</p>}
      </section>

      <section className="rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">Needs attention</h3><Button variant="ghost" size="sm" onClick={onShowTasks}>All tasks <ArrowRight /></Button></div>
        {attention.length ? <ul className="mt-3 space-y-3">{attention.slice(0, 5).map((task) => <li key={task.id}><button onClick={onShowTasks} className="flex w-full items-start justify-between gap-3 text-left text-sm text-neutral-300 hover:text-white"><span className="min-w-0">{task.title}</span><span className={`shrink-0 text-xs ${task.status === 'blocked' ? 'text-amber-300' : 'text-rose-300'}`}>{task.status === 'blocked' ? 'Blocked' : 'Overdue'}</span></button></li>)}</ul> : <p className="mt-3 flex items-center gap-2 text-xs text-neutral-400">{tasks.length ? <CheckCircle2 className="size-4 text-emerald-400" /> : <ListTodo className="size-4" />}{tasks.length ? 'No blocked or overdue tasks.' : 'Tasks and blockers will show up here once work is assigned.'}</p>}
      </section>
    </div>
  );
}
