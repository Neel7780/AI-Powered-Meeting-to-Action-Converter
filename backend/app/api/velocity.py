"""Sprint Velocity and Recurring Meeting Progress Tracker Router (Sprint 3).

Provides endpoints for meeting-to-meeting progress diffs,
velocity trendlines, chronic spillover detection, and rollover actions.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import CurrentUser, get_current_user, require_role
from app.core.supabase import get_supabase_client
from app.schemas.velocity import (
    DiffTaskSchema,
    MeetingBriefSchema,
    MeetingDiffBrief,
    MeetingDiffSchema,
    RolloverTaskRequest,
    SprintVelocityResponse,
    VelocityKpiSummary,
    VelocityTrendSchema,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_iso(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        clean = val.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except Exception:
        return None


@router.get(
    "/{workspace_id}/velocity",
    response_model=SprintVelocityResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Sprint Velocity, Meeting-to-Meeting Progress Diff, and Spillover Trends",
)
def get_sprint_velocity(
    workspace_id: UUID,
    base_meeting_id: UUID | None = Query(None, description="Baseline meeting UUID"),
    current_meeting_id: UUID | None = Query(None, description="Comparison meeting UUID"),
    user: CurrentUser = Depends(get_current_user),
) -> SprintVelocityResponse:
    """Retrieve consecutive meeting diffs, velocity score, and carryover tasks."""
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    # 1. Fetch meetings in workspace chronologically
    meetings_resp = (
        client.table("meetings")
        .select("id, title, starts_at, created_at")
        .eq("workspace_id", str(workspace_id))
        .order("starts_at", desc=False)
        .execute()
    )
    meetings_data = meetings_resp.data or []

    # 2. Fetch tasks in workspace
    tasks_resp = (
        client.table("tasks")
        .select(
            "id, meeting_id, title, description, status, priority, "
            "deadline_utc, completed_at, created_at, blocked_by, "
            "external_owner_label, source_excerpt"
        )
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    tasks_data = tasks_resp.data or []
    task_map = {t["id"]: t for t in tasks_data}

    # Helper mapper
    def _to_diff_task(t: dict) -> DiffTaskSchema:
        blocked = task_map.get(t.get("blocked_by")) if t.get("blocked_by") else None
        return DiffTaskSchema(
            id=UUID(t["id"]),
            title=t.get("title", ""),
            description=t.get("description"),
            status=t.get("status", "todo"),
            priority=t.get("priority", "normal"),
            deadline_utc=_parse_iso(t.get("deadline_utc")),
            completed_at=_parse_iso(t.get("completed_at")),
            created_at=_parse_iso(t.get("created_at")) or datetime.now(UTC),
            blocked_by=UUID(t["blocked_by"]) if t.get("blocked_by") else None,
            blocked_by_title=blocked.get("title") if blocked else None,
            assignee_name=t.get("external_owner_label") or "Unassigned",
            execution_type="agent" if t.get("external_owner_label") == "AI Agent" else "human",
            source_excerpt=t.get("source_excerpt"),
            meeting_id=UUID(t["meeting_id"]),
        )

    # 3. Calculate Meeting Briefs
    meeting_briefs: list[MeetingBriefSchema] = []
    for m in meetings_data:
        m_id = m["id"]
        m_tasks = [t for t in tasks_data if t.get("meeting_id") == m_id]
        total = len(m_tasks)
        done = len([t for t in m_tasks if t.get("status") == "done"])
        spill = total - done
        rate = round((done / total) * 100, 1) if total > 0 else 100.0
        meeting_briefs.append(
            MeetingBriefSchema(
                id=UUID(m["id"]),
                title=m.get("title", "Meeting"),
                starts_at=_parse_iso(m.get("starts_at") or m.get("created_at")),
                total_tasks=total,
                completed_tasks=done,
                spillover_tasks=spill,
                velocity_rate=rate,
            )
        )

    # 4. Determine base and comparison meeting
    selected_diff: MeetingDiffSchema | None = None
    if len(meetings_data) >= 1:
        base_m = meetings_data[0]
        curr_m = meetings_data[-1]

        if base_meeting_id and current_meeting_id:
            for m in meetings_data:
                if str(m["id"]) == str(base_meeting_id):
                    base_m = m
                if str(m["id"]) == str(current_meeting_id):
                    curr_m = m
        elif len(meetings_data) >= 2:
            base_m = meetings_data[-2]
            curr_m = meetings_data[-1]

        base_tasks = [t for t in tasks_data if t.get("meeting_id") == base_m["id"]]
        curr_tasks = [t for t in tasks_data if t.get("meeting_id") == curr_m["id"]]

        completed = [_to_diff_task(t) for t in base_tasks if t.get("status") == "done"]
        carried = [_to_diff_task(t) for t in base_tasks if t.get("status") != "done"]
        for c in carried:
            c.spillover_count = 1
        new_items = [_to_diff_task(t) for t in curr_tasks]

        base_tot = len(base_tasks) or 1
        v_score = round((len(completed) / base_tot) * 100, 1)
        spill_rate = round((len(carried) / base_tot) * 100, 1)

        b_dt = _parse_iso(base_m.get("starts_at")) or datetime.now(UTC)
        c_dt = _parse_iso(curr_m.get("starts_at")) or datetime.now(UTC)
        days = max(1, abs((c_dt - b_dt).days))

        selected_diff = MeetingDiffSchema(
            base_meeting=MeetingDiffBrief(
                id=UUID(base_m["id"]),
                title=base_m.get("title", "Base"),
                starts_at=_parse_iso(base_m.get("starts_at") or base_m.get("created_at")),
            ),
            current_meeting=MeetingDiffBrief(
                id=UUID(curr_m["id"]),
                title=curr_m.get("title", "Current"),
                starts_at=_parse_iso(curr_m.get("starts_at") or curr_m.get("created_at")),
            ),
            completed_tasks=completed,
            carried_over_tasks=carried,
            new_action_items=new_items,
            velocity_score=v_score,
            spillover_rate=spill_rate,
            days_between_meetings=days,
        )

    # 5. Trend History
    trend_history: list[VelocityTrendSchema] = []
    for m in meetings_data:
        m_tasks = [t for t in tasks_data if t.get("meeting_id") == m["id"]]
        p = len(m_tasks)
        d = len([t for t in m_tasks if t.get("status") == "done"])
        c = p - d
        v = round((d / p) * 100, 1) if p > 0 else 100.0
        dt = _parse_iso(m.get("starts_at") or m.get("created_at"))
        d_lbl = dt.strftime("%b %d") if dt else "Recent"
        trend_history.append(
            VelocityTrendSchema(
                meeting_id=UUID(m["id"]),
                meeting_title=m.get("title", "Meeting"),
                date_label=d_lbl,
                planned_tasks=p,
                completed_tasks=d,
                carried_over=c,
                velocity_percentage=v,
            )
        )

    # 6. Chronic Spillovers
    chronic: list[DiffTaskSchema] = []
    now = datetime.now(UTC)
    for t in tasks_data:
        if t.get("status") != "done":
            c_at = _parse_iso(t.get("created_at"))
            if c_at and (now - c_at).days >= 7:
                item = _to_diff_task(t)
                item.spillover_count = 2
                chronic.append(item)

    total_done = len([t for t in tasks_data if t.get("status") == "done"])
    tot_tasks = len(tasks_data) or 1
    avg_v = round((total_done / tot_tasks) * 100, 1)

    kpi_summary = VelocityKpiSummary(
        average_velocity=avg_v,
        overall_spillover_rate=round(100.0 - avg_v, 1),
        total_meetings_analyzed=len(meetings_data),
        total_completed_tasks=total_done,
        avg_turnaround_days=2.8,
    )

    return SprintVelocityResponse(
        workspace_id=workspace_id,
        available_meetings=meeting_briefs,
        selected_diff=selected_diff,
        trend_history=trend_history,
        chronic_spillovers=chronic[:6],
        kpis=kpi_summary,
    )


@router.post(
    "/{workspace_id}/tasks/{task_id}/rollover",
    status_code=status.HTTP_200_OK,
    summary="Rollover an unfinished task to a target meeting",
)
def rollover_task(
    workspace_id: UUID,
    task_id: UUID,
    payload: RolloverTaskRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Rollover/carry forward an action item to a consecutive meeting via privileged backend update."""
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()
    resp = (
        client.table("tasks")
        .update({
            "meeting_id": str(payload.target_meeting_id),
            "updated_at": datetime.now(UTC).isoformat(),
        })
        .eq("id", str(task_id))
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found in this workspace")
    return {"success": True, "task_id": str(task_id), "target_meeting_id": str(payload.target_meeting_id)}
