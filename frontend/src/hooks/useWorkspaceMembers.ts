import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface WorkspaceMember {
  user_id: string;
  role: string;
  profile: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface UseWorkspaceMembersResult {
  members: WorkspaceMember[];
  loading: boolean;
}

export function useWorkspaceMembers(workspaceId: string | undefined): UseWorkspaceMembersResult {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }

    setLoading(true);

    supabase
      .from('workspace_members')
      .select('user_id, role, profile:profiles(display_name, email, avatar_url)')
      .eq('workspace_id', workspaceId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[useWorkspaceMembers] Error fetching members:', error);
          setMembers([]);
        } else {
          setMembers((data as unknown as WorkspaceMember[]) ?? []);
        }
        setLoading(false);
      });
  }, [workspaceId]);

  return { members, loading };
}
