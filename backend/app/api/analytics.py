"""Workspace Analytics API (Sprint 2 - Task 7).

Endpoints:
- GET /workspaces/{workspace_id}/analytics: Retrieve workspace progress, duration metrics,
  bottleneck analysis, meeting yields, and role-restricted employee performance evaluations.
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import ORGANISER_ROLES, CurrentUser, get_current_user, require_role
from app.core.supabase import get_supabase_client
from app.schemas.analytics import (
    BottleneckTask,
    MeetingYieldItem,
    MemberPerformanceItem,
    TaskPriorityBreakdown,
    TaskStatusBreakdown,
    WorkspaceAnalyticsResponse,
    WorkspaceKpiSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_utc_datetime(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        # Handles ISO-8601 strings like "2026-10-12T14:30:00+00:00" or "...Z"
        clean = val.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except Exception:
        return None


@router.get(
    "/{workspace_id}/analytics",
    response_model=WorkspaceAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Workspace Analytics and Manager-Only Employee Evaluations"
)
def get_workspace_analytics(
    workspace_id: UUID,
    timeframe: str = Query("30d", pattern="^(7d|30d|90d|all)$"),
    meeting_id: UUID | None = Query(None, description="Optional meeting filter"),
    user: CurrentUser = Depends(get_current_user)
) -> WorkspaceAnalyticsResponse:
    """Retrieve aggregate workspace productivity metrics.
    
    Role Permissions:
    - Member: Can view workspace-level KPIs, status breakdowns, and bottlenecks.
    - Admin / Organiser: In addition to workspace KPIs, receives full individual
      employee performance evaluation (tasks assigned, on-time completion, overdue).
    """
    # 1. Enforce Workspace Membership & Retrieve User Role
    user_role = require_role(workspace_id, {"admin", "organiser", "member"}, user)
    can_view_employee_scorecards = user_role in ORGANISER_ROLES

    client = get_supabase_client()
    now = datetime.now(UTC)

    # Calculate timeframe boundary
    timeframe_start: datetime | None = None
    if timeframe == "7d":
        timeframe_start = now - timedelta(days=7)
    elif timeframe == "30d":
        timeframe_start = now - timedelta(days=30)
    elif timeframe == "90d":
        timeframe_start = now - timedelta(days=90)

    # 2. Query Tasks for the Workspace
    tasks_query = (
        client.table("tasks")
        .select(
            "id, title, status, priority, deadline_utc, blocked_by, "
            "created_at, updated_at, completed_at, meeting_id, external_owner_label"
        )
        .eq("workspace_id", str(workspace_id))
    )

    if meeting_id:
        tasks_query = tasks_query.eq("meeting_id", str(meeting_id))

    if timeframe_start:
        tasks_query = tasks_query.gte("created_at", timeframe_start.isoformat())

    tasks_resp = tasks_query.execute()
    tasks_data = tasks_resp.data or []

    # Map of all tasks in workspace for dependency lookups (by task ID)
    task_map: dict[str, dict] = {t["id"]: t for t in tasks_data}

    # 3. Query Task Assignees for Tasks in Workspace
    task_ids = [t["id"] for t in tasks_data]
    assignee_map: dict[str, list[dict]] = {}
    if task_ids:
        # Fetch assignees for these tasks
        assignees_resp = (
            client.table("task_assignees")
            .select("task_id, user_id, is_primary")
            .in_("task_id", task_ids)
            .execute()
        )
        for a in (assignees_resp.data or []):
            tid = a["task_id"]
            if tid not in assignee_map:
                assignee_map[tid] = []
            assignee_map[tid].append(a)

    # 4. Compute High-Level Workspace KPIs
    total_tasks = len(tasks_data)
    status_counts = {"todo": 0, "in_progress": 0, "blocked": 0, "done": 0}
    priority_counts = {"urgent": 0, "high": 0, "normal": 0, "low": 0}

    completed_tasks = 0
    currently_overdue = 0
    currently_blocked = 0
    on_time_completions = 0
    late_completions = 0
    cycle_time_durations_sec: list[float] = []

    bottleneck_list: list[BottleneckTask] = []

    for t in tasks_data:
        st = t.get("status", "todo")
        status_counts[st] = status_counts.get(st, 0) + 1

        pr = t.get("priority", "normal")
        priority_counts[pr] = priority_counts.get(pr, 0) + 1

        created_at = _parse_utc_datetime(t.get("created_at"))
        completed_at = _parse_utc_datetime(t.get("completed_at"))
        deadline_utc = _parse_utc_datetime(t.get("deadline_utc"))

        # Overdue check for open tasks
        if st != "done":
            if deadline_utc and deadline_utc < now:
                currently_overdue += 1
            if st == "blocked" or t.get("blocked_by"):
                currently_blocked += 1

        # Completed tasks analytics
        if st == "done":
            completed_tasks += 1
            if completed_at and created_at:
                dur_sec = max(0.0, (completed_at - created_at).total_seconds())
                cycle_time_durations_sec.append(dur_sec)

            if deadline_utc and completed_at:
                if completed_at <= deadline_utc:
                    on_time_completions += 1
                else:
                    late_completions += 1
            else:
                # No deadline or completed without deadline set
                on_time_completions += 1

        # Bottleneck detection
        if t.get("blocked_by") or st == "blocked":
            blocked_by_id = t.get("blocked_by")
            blocked_by_title = None
            if blocked_by_id and str(blocked_by_id) in task_map:
                blocked_by_title = task_map[str(blocked_by_id)].get("title")

            # Determine primary assignee name if available
            t_assignees = assignee_map.get(t["id"], [])
            assignee_user_id = t_assignees[0]["user_id"] if t_assignees else None
            assignee_display = t.get("external_owner_label") or (
                f"User {assignee_user_id[:8]}" if assignee_user_id else "Unassigned"
            )

            days_open = max(0, (now - created_at).days) if created_at else 0

            bottleneck_list.append(
                BottleneckTask(
                    task_id=str(t["id"]),
                    title=t["title"],
                    status=st,
                    priority=pr,
                    deadline_utc=deadline_utc,
                    blocked_by_id=str(blocked_by_id) if blocked_by_id else None,
                    blocked_by_title=blocked_by_title,
                    assignee_name=assignee_display,
                    days_open=days_open,
                )
            )

    completion_rate = round((completed_tasks / total_tasks * 100.0), 1) if total_tasks > 0 else 0.0
    on_time_rate = (
        round((on_time_completions / (on_time_completions + late_completions) * 100.0), 1)
        if (on_time_completions + late_completions) > 0
        else 0.0
    )
    avg_cycle_time_hours = (
        round(sum(cycle_time_durations_sec) / len(cycle_time_durations_sec) / 3600.0, 1)
        if cycle_time_durations_sec
        else None
    )

    kpi_summary = WorkspaceKpiSummary(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=completion_rate,
        currently_overdue=currently_overdue,
        currently_blocked=currently_blocked,
        on_time_completions=on_time_completions,
        late_completions=late_completions,
        on_time_completion_rate=on_time_rate,
        avg_cycle_time_hours=avg_cycle_time_hours,
        status_breakdown=TaskStatusBreakdown(
            todo=status_counts["todo"],
            in_progress=status_counts["in_progress"],
            blocked=status_counts["blocked"],
            done=status_counts["done"],
            total=total_tasks,
        ),
        priority_breakdown=TaskPriorityBreakdown(
            urgent=priority_counts["urgent"],
            high=priority_counts["high"],
            normal=priority_counts["normal"],
            low=priority_counts["low"],
        ),
    )

    # 5. Compute Meeting Yield
    meetings_resp = (
        client.table("meetings")
        .select("id, title, starts_at")
        .eq("workspace_id", str(workspace_id))
        .order("starts_at", desc=True)
        .limit(10)
        .execute()
    )
    meeting_yield: list[MeetingYieldItem] = []
    for m in (meetings_resp.data or []):
        mid = m["id"]
        m_tasks = [t for t in tasks_data if t.get("meeting_id") == mid]
        m_total = len(m_tasks)
        m_done = sum(1 for t in m_tasks if t.get("status") == "done")
        m_rate = round((m_done / m_total * 100.0), 1) if m_total > 0 else 0.0
        meeting_yield.append(
            MeetingYieldItem(
                meeting_id=str(mid),
                meeting_title=m["title"],
                starts_at=_parse_utc_datetime(m.get("starts_at")),
                total_tasks=m_total,
                completed_tasks=m_done,
                completion_rate=m_rate,
            )
        )

    # 6. Compute Individual Employee Performance Scorecard (RESTRICTED TO MANAGERS/ORGANISERS)
    member_evaluations: list[MemberPerformanceItem] | None = None

    if can_view_employee_scorecards:
        # Load workspace members with profiles
        members_resp = (
            client.table("workspace_members")
            .select("user_id, role")
            .eq("workspace_id", str(workspace_id))
            .execute()
        )
        members_data = members_resp.data or []
        user_ids = [m["user_id"] for m in members_data]

        profiles_map: dict[str, dict] = {}
        if user_ids:
            profiles_resp = (
                client.table("profiles")
                .select("id, display_name, email, avatar_url")
                .in_("id", user_ids)
                .execute()
            )
            for p in (profiles_resp.data or []):
                profiles_map[p["id"]] = p

        member_evaluations = []
        for m in members_data:
            uid = m["user_id"]
            prof = profiles_map.get(uid, {})
            name = prof.get("display_name") or prof.get("email") or f"Member {uid[:8]}"
            email = prof.get("email") or ""
            avatar = prof.get("avatar_url")

            # Find all tasks assigned to this member
            assigned_task_ids = {
                tid for tid, assignees in assignee_map.items()
                if any(a.get("user_id") == uid for a in assignees)
            }
            assigned_tasks = [t for t in tasks_data if t["id"] in assigned_task_ids]

            m_total = len(assigned_tasks)
            m_completed = 0
            m_on_time = 0
            m_late = 0
            m_overdue = 0
            m_in_prog = 0
            m_todo = 0
            m_blocked = 0
            m_cycle_seconds: list[float] = []

            for t in assigned_tasks:
                st = t.get("status", "todo")
                created_at = _parse_utc_datetime(t.get("created_at"))
                completed_at = _parse_utc_datetime(t.get("completed_at"))
                deadline_utc = _parse_utc_datetime(t.get("deadline_utc"))

                if st == "done":
                    m_completed += 1
                    if completed_at and created_at:
                        m_cycle_seconds.append(max(0.0, (completed_at - created_at).total_seconds()))

                    if deadline_utc and completed_at:
                        if completed_at <= deadline_utc:
                            m_on_time += 1
                        else:
                            m_late += 1
                    else:
                        m_on_time += 1
                else:
                    if st == "in_progress":
                        m_in_prog += 1
                    elif st == "blocked":
                        m_blocked += 1
                    elif st == "todo":
                        m_todo += 1

                    if deadline_utc and deadline_utc < now:
                        m_overdue += 1

            m_on_time_rate = (
                round((m_on_time / (m_on_time + m_late) * 100.0), 1)
                if (m_on_time + m_late) > 0
                else (100.0 if m_total == 0 else 0.0)
            )
            m_avg_cycle = (
                round(sum(m_cycle_seconds) / len(m_cycle_seconds) / 3600.0, 1)
                if m_cycle_seconds
                else None
            )

            member_evaluations.append(
                MemberPerformanceItem(
                    user_id=str(uid),
                    display_name=name,
                    email=email,
                    avatar_url=avatar,
                    role=m.get("role", "member"),
                    total_assigned=m_total,
                    completed_total=m_completed,
                    completed_on_time=m_on_time,
                    completed_late=m_late,
                    currently_overdue=m_overdue,
                    in_progress=m_in_prog,
                    pending_todo=m_todo,
                    blocked=m_blocked,
                    on_time_rate=m_on_time_rate,
                    avg_cycle_time_hours=m_avg_cycle,
                )
            )

        # Sort members by total assigned tasks descending
        member_evaluations.sort(key=lambda x: x.total_assigned, reverse=True)

    return WorkspaceAnalyticsResponse(
        workspace_id=str(workspace_id),
        user_role=user_role,
        timeframe=timeframe,
        kpis=kpi_summary,
        bottlenecks=bottleneck_list,
        meeting_yield=meeting_yield,
        member_evaluations=member_evaluations,
    )
