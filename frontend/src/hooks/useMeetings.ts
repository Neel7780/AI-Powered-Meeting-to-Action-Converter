import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Meeting {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: string;
  visibility: string;
  created_at: string;
  organiser_id: string;
}

interface UseMeetingsResult {
  meetings: Meeting[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMeetings(workspaceId: string | undefined): UseMeetingsResult {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    if (!workspaceId) {
      setMeetings([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('meetings')
      .select('id, title, starts_at, timezone, status, visibility, created_at, organiser_id')
      .eq('workspace_id', workspaceId)
      .eq('lifecycle', 'active')
      .order('starts_at', { ascending: false });

    if (queryError) {
      console.error('[useMeetings] Error fetching meetings:', queryError);
      setError(queryError.message);
      setMeetings([]);
    } else {
      setMeetings((data as Meeting[]) ?? []);
    }

    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  return { meetings, loading, error, refresh: fetchMeetings };
}
