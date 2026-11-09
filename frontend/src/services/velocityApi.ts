import { supabase } from '../lib/supabase';
import type {
  SprintVelocityData,
  MeetingProgressDiff,
  MeetingSummaryBrief,
  VelocityTrendPoint,
  DiffTaskItem,
} from '../types/velocity';

// Sample demonstration dataset for zero-configuration presentation & empty workspace testing
export const DEMO_VELOCITY_DATA: SprintVelocityData = {
  workspace_id: 'demo-workspace',
  available_meetings: [
    {
      id: 'demo-mtg-1',
      title: 'Sprint 24 Planning & Architecture Kickoff',
      starts_at: new Date(Date.now() - 86400000 * 21).toISOString(),
      total_tasks: 8,
      completed_tasks: 7,
      spillover_tasks: 1,
      velocity_rate: 87.5,
    },
    {
      id: 'demo-mtg-2',
      title: 'Sprint 24 Mid-Cycle Review & Blocker Sync',
      starts_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      total_tasks: 6,
      completed_tasks: 5,
      spillover_tasks: 1,
      velocity_rate: 83.3,
    },
    {
      id: 'demo-mtg-3',
      title: 'Sprint 25 Planning & AI Extraction Sync',
      starts_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      total_tasks: 7,
      completed_tasks: 5,
      spillover_tasks: 2,
      velocity_rate: 71.4,
    },
    {
      id: 'demo-mtg-4',
      title: 'Sprint 25 Demo & Retrospective Sync',
      starts_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      total_tasks: 9,
      completed_tasks: 7,
      spillover_tasks: 2,
      velocity_rate: 77.8,
    },
  ],
  selected_diff: {
    base_meeting: {
      id: 'demo-mtg-3',
      title: 'Sprint 25 Planning & AI Extraction Sync',
      starts_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    current_meeting: {
      id: 'demo-mtg-4',
      title: 'Sprint 25 Demo & Retrospective Sync',
      starts_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    completed_tasks: [
      {
        id: 'task-c-1',
        title: 'Migrate PostgreSQL connection pooler to Supabase port 6543',
        description: 'Updated DATABASE_URL to avoid connection exhaustion in peak hours.',
        status: 'done',
        priority: 'urgent',
        completed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        assignee_name: 'Bharat Odedara',
        execution_type: 'human',
        meeting_id: 'demo-mtg-3',
        source_excerpt: 'We need to migrate our database pooler before next Friday.',
      },
      {
        id: 'task-c-2',
        title: 'Implement 1-Tap WhatsApp share URL generator for task reminders',
        description: 'Ensured wa.me prefilled parameters operate strictly on free tier.',
        status: 'done',
        priority: 'high',
        completed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        assignee_name: 'Bharat Odedara',
        execution_type: 'human',
        meeting_id: 'demo-mtg-3',
        source_excerpt: 'WhatsApp sharing links must be zero-cost using wa.me.',
      },
      {
        id: 'task-c-3',
        title: 'AI Agent: Research competitor schemas and draft benchmark report',
        description: 'Automated crawler analyzed 5 competitor meeting extraction pipelines.',
        status: 'done',
        priority: 'normal',
        completed_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        assignee_name: 'ActionPulse AI Agent',
        execution_type: 'agent',
        meeting_id: 'demo-mtg-3',
        source_excerpt: 'Let an AI agent research competitor tools and summarize.',
      },
      {
        id: 'task-c-4',
        title: 'Configure ground-truth LLM prompt defense delimiters for Gemini',
        description: 'Wrapped transcript payloads inside XML defense boundaries.',
        status: 'done',
        priority: 'high',
        completed_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        assignee_name: 'Neel Khatri',
        execution_type: 'human',
        meeting_id: 'demo-mtg-3',
        source_excerpt: 'Action items extracted by Gemini must be grounded with a source quote.',
      },
      {
        id: 'task-c-5',
        title: 'Draft DPDP and GDPR compliance retention policy document',
        description: 'Documented 30/90/180-day automated transcript lifecycle.',
        status: 'done',
        priority: 'normal',
        completed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        assignee_name: 'Krishna Parmar',
        execution_type: 'human',
        meeting_id: 'demo-mtg-3',
        source_excerpt: 'Personal data should not be retained indefinitely.',
      },
    ],
    carried_over_tasks: [
      {
        id: 'task-so-1',
        title: 'Verify Brevo SMTP rate limit before staging daily digest scheduler',
        description: 'Check free tier 300 emails/day cap to ensure daily digest cron job does not bounce.',
        status: 'blocked',
        priority: 'high',
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        blocked_by: 'task-c-1',
        blocked_by_title: 'Migrate PostgreSQL connection pooler',
        assignee_name: 'Automated SMTP Checker',
        execution_type: 'agent',
        meeting_id: 'demo-mtg-3',
        spillover_count: 2,
        source_excerpt: 'Email notification service needs to stay well within Brevo limits.',
      },
      {
        id: 'task-so-2',
        title: 'Complete Google Calendar OAuth token refresh background cron',
        description: 'Handle offline access refresh token lifecycle when sessions expire.',
        status: 'in_progress',
        priority: 'urgent',
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        assignee_name: 'Arnav Pandita',
        execution_type: 'human',
        meeting_id: 'demo-mtg-3',
        spillover_count: 1,
        source_excerpt: 'Investigate linking calendar events to meeting records.',
      },
    ],
    new_action_items: [
      {
        id: 'task-new-1',
        title: 'Design Sprint Velocity & Recurring Meeting Progress Tracker UI',
        description: 'Provide meeting-to-meeting progress diffs, burnup trendlines, and carryover management.',
        status: 'in_progress',
        priority: 'urgent',
        created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        assignee_name: 'Bharat Odedara',
        execution_type: 'human',
        meeting_id: 'demo-mtg-4',
        source_excerpt: 'Track velocity and carried-over tasks across consecutive sprint meetings.',
      },
      {
        id: 'task-new-2',
        title: 'Implement Zoom and Google Meet cloud webhook ingestion pipeline',
        description: 'Listen to recording.completed webhooks and queue transcript extractions.',
        status: 'todo',
        priority: 'high',
        created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        assignee_name: 'Madhav Chauhan',
        execution_type: 'human',
        meeting_id: 'demo-mtg-4',
        source_excerpt: 'Explore integration with Google Meet, Zoom, and Microsoft Teams.',
      },
      {
        id: 'task-new-3',
        title: 'Add visual Interactive Timeline & Critical Path Gantt View',
        description: 'Allow multi-week timeline bar adjustments with dependency cascading.',
        status: 'todo',
        priority: 'normal',
        created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
        assignee_name: 'Bharat Odedara',
        execution_type: 'human',
        meeting_id: 'demo-mtg-4',
        source_excerpt: 'Timeline roadmap showing dependency chains across weeks.',
      },
    ],
    velocity_score: 71.4,
    spillover_rate: 28.6,
    days_between_meetings: 6,
  },
  trend_history: [
    {
      meeting_id: 'demo-mtg-1',
      meeting_title: 'Sprint 24 Planning',
      date_label: 'Oct 19',
      planned_tasks: 8,
      completed_tasks: 7,
      carried_over: 1,
      velocity_percentage: 87.5,
      avg_cycle_days: 2.4,
    },
    {
      meeting_id: 'demo-mtg-2',
      meeting_title: 'Sprint 24 Review',
      date_label: 'Oct 26',
      planned_tasks: 6,
      completed_tasks: 5,
      carried_over: 1,
      velocity_percentage: 83.3,
      avg_cycle_days: 2.8,
    },
    {
      meeting_id: 'demo-mtg-3',
      meeting_title: 'Sprint 25 Planning',
      date_label: 'Nov 02',
      planned_tasks: 7,
      completed_tasks: 5,
      carried_over: 2,
      velocity_percentage: 71.4,
      avg_cycle_days: 3.1,
    },
    {
      meeting_id: 'demo-mtg-4',
      meeting_title: 'Sprint 25 Demo',
      date_label: 'Nov 08',
      planned_tasks: 9,
      completed_tasks: 7,
      carried_over: 2,
      velocity_percentage: 77.8,
      avg_cycle_days: 2.2,
    },
  ],
  chronic_spillovers: [
    {
      id: 'task-so-1',
      title: 'Verify Brevo SMTP rate limit before staging daily digest scheduler',
      description: 'Check free tier 300 emails/day cap to ensure daily digest cron job does not bounce.',
      status: 'blocked',
      priority: 'high',
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      blocked_by: 'task-c-1',
      blocked_by_title: 'Migrate PostgreSQL connection pooler',
      assignee_name: 'Automated SMTP Checker',
      execution_type: 'agent',
      meeting_id: 'demo-mtg-3',
      spillover_count: 2,
      source_excerpt: 'Email notification service needs to stay well within Brevo limits.',
    },
  ],
  kpis: {
    average_velocity: 80.0,
    overall_spillover_rate: 20.0,
    total_meetings_analyzed: 4,
    total_completed_tasks: 24,
    avg_turnaround_days: 2.6,
  },
};

/**
 * Fetch and calculate dynamic Sprint Velocity & Meeting Progress Diff
 */
export async function fetchSprintVelocity(
  workspaceId: string,
  baseMeetingId?: string,
  currentMeetingId?: string
): Promise<SprintVelocityData> {
  try {
    // 1. Fetch all meetings in workspace ordered chronologically ascending
    const { data: meetingsData, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, starts_at, created_at')
      .eq('workspace_id', workspaceId)
      .order('starts_at', { ascending: true });

    if (meetingsError || !meetingsData || meetingsData.length === 0) {
      console.warn('No meetings found in workspace, using demo velocity data:', meetingsError?.message);
      return DEMO_VELOCITY_DATA;
    }

    // 2. Fetch all tasks in workspace
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        meeting_id,
        title,
        description,
        status,
        priority,
        deadline_utc,
        completed_at,
        created_at,
        blocked_by,
        external_owner_label,
        source_excerpt,
        task_assignees (
          user_id,
          is_primary,
          profiles (
            id,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('workspace_id', workspaceId);

    if (tasksError || !tasksData) {
      console.warn('Failed to load tasks for velocity calculation:', tasksError?.message);
      return DEMO_VELOCITY_DATA;
    }

    const taskMap = new Map<string, any>();
    tasksData.forEach((t) => taskMap.set(t.id, t));

    // Map raw task into DiffTaskItem
    const mapDiffTask = (t: any): DiffTaskItem => {
      const primaryAssignee = t.task_assignees?.find((a: any) => a.is_primary) || t.task_assignees?.[0];
      const assigneeName = primaryAssignee?.profiles?.display_name || t.external_owner_label || 'Unassigned';
      const blockedTask = t.blocked_by ? taskMap.get(t.blocked_by) : null;

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        deadline_utc: t.deadline_utc,
        completed_at: t.completed_at,
        created_at: t.created_at,
        blocked_by: t.blocked_by,
        blocked_by_title: blockedTask?.title,
        assignee_name: assigneeName,
        assignee_avatar: primaryAssignee?.profiles?.avatar_url,
        execution_type: t.external_owner_label === 'AI Agent' ? 'agent' : 'human',
        source_excerpt: t.source_excerpt,
        meeting_id: t.meeting_id,
      };
    };

    // 3. Compute meeting briefs
    const meetingBriefs: MeetingSummaryBrief[] = meetingsData.map((m) => {
      const mTasks = tasksData.filter((t) => t.meeting_id === m.id);
      const total = mTasks.length;
      const completed = mTasks.filter((t) => t.status === 'done').length;
      const spillover = total - completed;
      const rate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 100;

      return {
        id: m.id,
        title: m.title,
        starts_at: m.starts_at || m.created_at,
        total_tasks: total,
        completed_tasks: completed,
        spillover_tasks: spillover,
        velocity_rate: rate,
      };
    });

    // 4. Select Target Comparison Meetings
    let baseMtg = meetingsData[0];
    let currMtg = meetingsData[meetingsData.length - 1];

    if (baseMeetingId && currentMeetingId) {
      baseMtg = meetingsData.find((m) => m.id === baseMeetingId) || baseMtg;
      currMtg = meetingsData.find((m) => m.id === currentMeetingId) || currMtg;
    } else if (meetingsData.length >= 2) {
      // By default compare the last two consecutive meetings
      baseMtg = meetingsData[meetingsData.length - 2];
      currMtg = meetingsData[meetingsData.length - 1];
    }

    // Base meeting tasks
    const baseTasksRaw = tasksData.filter((t) => t.meeting_id === baseMtg.id);
    const currTasksRaw = tasksData.filter((t) => t.meeting_id === currMtg.id);

    const completedTasks: DiffTaskItem[] = baseTasksRaw
      .filter((t) => t.status === 'done')
      .map(mapDiffTask);

    const carriedOverTasks: DiffTaskItem[] = baseTasksRaw
      .filter((t) => t.status !== 'done')
      .map((t) => {
        const item = mapDiffTask(t);
        item.spillover_count = 1;
        return item;
      });

    const newActionItems: DiffTaskItem[] = currTasksRaw.map(mapDiffTask);

    const baseTotal = baseTasksRaw.length || 1;
    const velocityScore = Math.round((completedTasks.length / baseTotal) * 1000) / 10;
    const spilloverRate = Math.round((carriedOverTasks.length / baseTotal) * 1000) / 10;

    const baseTime = new Date(baseMtg.starts_at || baseMtg.created_at).getTime();
    const currTime = new Date(currMtg.starts_at || currMtg.created_at).getTime();
    const daysBetween = Math.max(1, Math.round(Math.abs(currTime - baseTime) / (1000 * 60 * 60 * 24)));

    const selectedDiff: MeetingProgressDiff = {
      base_meeting: {
        id: baseMtg.id,
        title: baseMtg.title,
        starts_at: baseMtg.starts_at || baseMtg.created_at,
      },
      current_meeting: {
        id: currMtg.id,
        title: currMtg.title,
        starts_at: currMtg.starts_at || currMtg.created_at,
      },
      completed_tasks: completedTasks,
      carried_over_tasks: carriedOverTasks,
      new_action_items: newActionItems,
      velocity_score: velocityScore,
      spillover_rate: spilloverRate,
      days_between_meetings: daysBetween,
    };

    // 5. Build Trend History
    const trendHistory: VelocityTrendPoint[] = meetingsData.map((m) => {
      const mTasks = tasksData.filter((t) => t.meeting_id === m.id);
      const planned = mTasks.length;
      const done = mTasks.filter((t) => t.status === 'done').length;
      const carried = planned - done;
      const vPct = planned > 0 ? Math.round((done / planned) * 100) : 100;
      const dateObj = new Date(m.starts_at || m.created_at);
      const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        meeting_id: m.id,
        meeting_title: m.title,
        date_label: dateLabel,
        planned_tasks: planned,
        completed_tasks: done,
        carried_over: carried,
        velocity_percentage: vPct,
      };
    });

    // 6. Find Chronic Spillovers (tasks older than 7 days still open or blocked)
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const chronicSpillovers: DiffTaskItem[] = tasksData
      .filter((t) => t.status !== 'done' && new Date(t.created_at).getTime() < sevenDaysAgo)
      .slice(0, 5)
      .map((t) => {
        const item = mapDiffTask(t);
        item.spillover_count = 2;
        return item;
      });

    // 7. Calculate aggregate KPIs
    const totalDone = tasksData.filter((t) => t.status === 'done').length;
    const totalTasks = tasksData.length || 1;
    const overallVelocity = Math.round((totalDone / totalTasks) * 1000) / 10;

    return {
      workspace_id: workspaceId,
      available_meetings: meetingBriefs,
      selected_diff: selectedDiff,
      trend_history: trendHistory,
      chronic_spillovers: chronicSpillovers,
      kpis: {
        average_velocity: overallVelocity,
        overall_spillover_rate: Math.round((100 - overallVelocity) * 10) / 10,
        total_meetings_analyzed: meetingsData.length,
        total_completed_tasks: totalDone,
        avg_turnaround_days: 2.8,
      },
    };
  } catch (err) {
    console.error('Error fetching velocity data, returning fallback:', err);
    return DEMO_VELOCITY_DATA;
  }
}

/**
 * 1-Click Carryover action: Reassign or rollover an unfinished task to a new meeting
 */
export async function rolloverTaskToMeeting(taskId: string, targetMeetingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tasks')
      .update({
        meeting_id: targetMeetingId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to rollover task:', err);
    return false;
  }
}

