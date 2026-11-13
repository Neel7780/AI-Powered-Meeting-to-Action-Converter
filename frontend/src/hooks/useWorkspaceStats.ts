import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';

interface WorkspaceStats {
  meetingCount: number;
  openTaskCount: number;
  memberCount: number;
  loading: boolean;
  error: string | null;
}

export function useWorkspaceStats(): WorkspaceStats {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [meetingCount, setMeetingCount] = useState(0);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace?.id || !user?.id) {
      setLoading(false);
      return;
    }

    const workspaceId = currentWorkspace.id;
    const userId = user.id;

    setLoading(true);
    setError(null);

    const fetchMeetings = supabase
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('lifecycle', 'active');

    // Open tasks where the current user is an assignee and status != 'done'
    const fetchOpenTasks = supabase
      .from('task_assignees')
      .select('task_id, tasks!inner(id, status, workspace_id)', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tasks.workspace_id', workspaceId)
      .neq('tasks.status', 'done');

    const fetchMembers = supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    Promise.all([fetchMeetings, fetchOpenTasks, fetchMembers])
      .then(([meetingsRes, tasksRes, membersRes]) => {
        if (meetingsRes.error) throw new Error(meetingsRes.error.message);
        if (tasksRes.error) throw new Error(tasksRes.error.message);
        if (membersRes.error) throw new Error(membersRes.error.message);

        setMeetingCount(meetingsRes.count ?? 0);
        setOpenTaskCount(tasksRes.count ?? 0);
        setMemberCount(membersRes.count ?? 0);
      })
      .catch((err: Error) => {
        console.error('[useWorkspaceStats] Error fetching stats:', err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentWorkspace?.id, user?.id]);

  return { meetingCount, openTaskCount, memberCount, loading, error };
}
