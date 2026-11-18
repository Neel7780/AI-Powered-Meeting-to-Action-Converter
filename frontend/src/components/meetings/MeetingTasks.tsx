import { useState } from 'react';
import { KanbanColumn } from '../kanban/KanbanColumn';
import { WorkflowChainsView } from '../kanban/WorkflowChainsView';
import { TaskDependencyModal } from '../kanban/TaskDependencyModal';
import type { KanbanTaskItem, TaskStatus } from '../kanban/KanbanCard';
import { Button } from '../ui/button';
import { reviewApi } from '../../services/reviewApi';

const columns: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To do' }, { status: 'in_progress', title: 'In progress' },
  { status: 'blocked', title: 'Blocked' }, { status: 'done', title: 'Done' },
];

export function MeetingTasks({ tasks, onRefresh }: { tasks: KanbanTaskItem[]; onRefresh: () => Promise<void> }) {
  const [view, setView] = useState<'board' | 'chains'>('board');
  const [selectedId, setSelectedId] = useState<string>();
  const [updating, setUpdating] = useState(new Set<string>());
  const [error, setError] = useState('');
  const selected = tasks.find((task) => task.id === selectedId);

  const updateStatus = async (id: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status || updating.has(id)) return;
    setUpdating((previous) => new Set(previous).add(id));
    setError('');
    try {
      await reviewApi.updateTaskStatus(task.workspace_id, id, status);
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdating((previous) => new Set([...previous].filter((key) => key !== id)));
    }
  };

  if (!tasks.length) return <p className="text-sm text-neutral-400">No confirmed tasks for this meeting yet.</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'board' ? 'secondary' : 'ghost'} aria-pressed={view === 'board'} onClick={() => setView('board')}>Board</Button>
        <Button size="sm" variant={view === 'chains' ? 'secondary' : 'ghost'} aria-pressed={view === 'chains'} onClick={() => setView('chains')}>Dependencies</Button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {view === 'board' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map(({ status, title }) => <KanbanColumn key={status} status={status} title={title}
            tasks={tasks.filter((task) => task.status === status)} allTasks={tasks}
            onStatusChange={updateStatus} onDropTask={updateStatus} updatingTaskIds={updating}
            onOpenDependencyModal={(task) => setSelectedId(task.id)} />)}
        </div>
      ) : <WorkflowChainsView tasks={tasks} onStatusChange={updateStatus} onOpenDependencyModal={(task) => setSelectedId(task.id)} />}
      {selected && <TaskDependencyModal isOpen task={selected} allTasks={tasks} onClose={() => setSelectedId(undefined)}
        onStatusChange={updateStatus} onUpdateDependency={async (id, prerequisite, executionType) => {
          try {
            await reviewApi.updateTaskDependency(selected.workspace_id, id, prerequisite, executionType);
            await onRefresh();
            setSelectedId(undefined);
          } catch (err) {
            setError((err as Error).message);
            setSelectedId(undefined);
          }
        }} />}
    </div>
  );
}
