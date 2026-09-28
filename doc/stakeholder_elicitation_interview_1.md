# Stakeholder Elicitation Interview 1 — Requirements Findings

## 1. Interview Details

- **Date:** September 26, 2026
- **Stakeholder:** Industry Professional, Agency & Corporate Experience
- **Interviewee Role:** Lead Content and Brand Manager
- **Interview Type:** Stakeholder Interview + Throw-away Prototype Validation
- **Project:** AI-Powered Meeting-to-Action Converter
- **Interview Duration:** ~21 minutes
- **Audio Available:** ~15 minutes 52 seconds
- **Full Meeting Recording:** Available as complete video
- **Interviewers:** Neel & Teammate
- **Recording consent:** The interviewee's consent to record must be documented. The recording is kept in the team drive and must not be committed to the repository.

## 2. Stakeholder Context

The interviewee actively participates in internal and external/client meetings. Her experience includes agency and corporate environments. Meetings commonly involve internal standups, external client meetings, multiple organisations/teams, multiple participants, verbal task assignment, and explicit, vague, or implied deadlines.

## 3. Key Elicitation Findings

### 3.1 Human-in-the-Loop Validation

AI-generated action items should be treated as suggestions. A manager/organiser should review, edit, approve, or reject them before they become official assignments.

### 3.2 Offline / Shared-Microphone Meetings

Offline meetings may have 5–7 people sharing a laptop, microphone, or meeting account. Reliable speaker identification may therefore be unavailable. The system must not assume that the recording account owner is the action owner.

### 3.3 Multi-Party and Two-Way Assignments

Tasks can move in both directions between organisations, such as Client → Agency and Agency → Client. Actions may also involve multiple stakeholders or cross-functional teams.

### 3.4 Task Dependencies

Some actions depend on prerequisite deliverables. If an upstream deliverable is delayed, downstream work may also be delayed.

### 3.5 Notification Channel Preferences

Corporate enterprises may prefer Email, formal ticketing tools, or Teams, while agencies and fast-paced startups may prefer WhatsApp or Slack. Notification channels should therefore be configurable.

### 3.6 Business Context and Meeting Crux

Existing AI note-takers may produce superficial notes and miss the crux or business context. Extracted actions should retain sufficient context for users to understand why an action was identified.

### 3.7 AI Agent Automation

There was interest in AI agents executing repetitive tasks derived from meeting action items, particularly for startups. This should be treated as a future/optional capability rather than a core Sprint 1 requirement.

## 4. Functional Requirements

| ID | Requirement | Initial Priority Candidate |
|---|---|---|
| FR-INT-01 | The system shall allow an authorised manager/organiser to review, edit, approve, or reject AI-extracted action items before they become official assignments. | Must |
| FR-INT-02 | The system shall allow an action item to have one primary owner (single point of accountability) plus optional collaborators. | Should |
| FR-INT-03 | The system shall support assignments between different teams or organisations, such as client-to-agency and agency-to-client assignments. External (non-registered) parties are recorded as a text owner label and receive no in-app notifications. | Should |
| FR-INT-04 | The system shall allow users to define a prerequisite task for an action item (single `blocked_by` reference). | Could |
| FR-INT-05 | The system shall flag downstream tasks whose prerequisite is overdue. Deadlines are not shifted automatically (MVP default; see Open Question 1). | Could |
| FR-INT-06 | The system shall allow an organisation/team to enable or disable notification channels from those available at zero cost (in-app, email, Web Push, WhatsApp share link). | Should |
| FR-INT-07 | The system shall support manual attribution of action items when reliable speaker identification is unavailable. | Must |
| FR-INT-08 | The system shall provide relevant source/context information for extracted action items so users can understand why an action was identified. | Should |

> Priorities are initial candidates from this interview only. Final MoSCoW priority should be decided during backlog refinement.

## 5. Non-Functional Requirements

### NFR-INT-01 — Reliability
The system should avoid automatically assigning action items when ownership cannot be reliably determined.

### NFR-INT-02 — Traceability
Extracted action items should be traceable to relevant meeting content.

### NFR-INT-03 — Usability
Managers/organisers should be able to review and correct extracted action items through a simple workflow.

### NFR-INT-04 — Configurability
Notification behaviour should be configurable according to organisational requirements.

### NFR-INT-05 — Robustness
The system should remain usable for meetings where individual speaker identification is unavailable.

> The interview does not establish quantitative targets for these NFRs. They map to measurable targets in the master SRS (`doc/refined.md`): NFR-INT-01 → NFR-03 (assignee accuracy) and DR-02; NFR-INT-02 → FR-08 (source excerpt); NFR-INT-03 → NFR-11 (usability); NFR-INT-04 → FR-17 / NFR-10 (channels and nudge cap); NFR-INT-05 → FR-07 (null owner + uncertainty flag).

## 6. Domain Requirements

- **DR-INT-01:** The person speaking in a meeting is not necessarily the person responsible for the resulting action.
- **DR-INT-02:** A meeting action may involve multiple stakeholders or organisations.
- **DR-INT-03:** An action item may depend on completion of another action or deliverable.
- **DR-INT-04:** Meeting participants may not always be individually identifiable from a shared-room recording.
- **DR-INT-05:** An action item may have an unclear or unspecified owner.
- **DR-INT-06:** Deadlines may be explicit, vague, or implied.
- **DR-INT-07:** Notification preferences can differ according to organisational culture and working environment.

## 7. User Stories

### US-INT-01 — Human Review
**As a manager, I want to review AI-generated action items before assignment, so that incorrect tasks or owners can be corrected.**

**Acceptance Criteria**
- AI-generated items are presented as suggestions.
- Manager can edit an action item.
- Manager can approve an action item.
- Manager can reject an action item.
- An unapproved item does not become an official assignment.

### US-INT-02 — Multiple Assignees
**As a meeting organiser, I want to assign an action item to multiple stakeholders, so that cross-functional responsibilities are represented correctly.**

**Acceptance Criteria**
- More than one assignee can be selected.
- All relevant assignees are associated with the action.
- Assignees can view the assignment according to their permissions.

### US-INT-03 — Task Dependencies
**As a task owner, I want to define prerequisite tasks, so that I know what must be completed before my task can proceed.**

**Acceptance Criteria**
- A task can reference another task as a prerequisite.
- A dependent task displays its dependency.
- Delayed prerequisites can be flagged.

### US-INT-04 — Configurable Notifications
**As a team administrator, I want to configure notification channels, so that notifications match our organisation's communication practices.**

**Acceptance Criteria**
- Notification channels can be configured.
- Supported channels can be enabled/disabled according to system capabilities.
- Configured channels are used for relevant notifications.

### US-INT-05 — Offline Meeting Attribution
**As a manager, I want to manually assign action items when speaker identification is uncertain, so that incorrect ownership is not automatically assigned.**

**Acceptance Criteria**
- The system identifies when reliable ownership cannot be determined.
- The action item is flagged for manual attribution.
- An authorised manager/organiser can assign the correct owner.
- The action is not automatically assigned to the recording account owner.

## 8. Conflict / Requirement Consideration

### Potential Conflict

**Automation:** Automatically identify and assign action items.

**Reliability / Human Control:** Do not automatically assign ownership when speaker attribution or context is uncertain.

### Proposed Resolution

```text
Meeting Transcript
       ↓
AI Extraction
       ↓
Owner / Deadline Identification
       ↓
Attribution Check
       ↓
Human Review
       ↓
Edit / Assign / Reject
       ↓
Approve
       ↓
Official Action Item
```

This resolution should be reviewed and formally recorded in the team's Conflict Log.

## 9. Open Questions Requiring Further Elicitation

1. Should dependent task deadlines automatically move when prerequisites are delayed?
2. Who is authorised to manually assign an action when speaker identification is uncertain?
3. Should multiple assignees have equal responsibility or different roles?
4. Should every organisation configure its own notification channels?
5. Should notification preferences be configurable per user, team, organisation, or meeting?
6. What exact meeting context should be displayed with an extracted action?
7. What confidence threshold should trigger manual review?
8. Should autonomous AI agents be included in a later EPIC or kept outside the current project scope?

## 10. Summary

This interview strengthens requirements around:

- Human-in-the-loop validation
- Offline/shared-microphone meetings
- Manual ownership attribution
- Multiple assignees
- Two-way client/agency assignments
- Task dependencies
- Configurable notification channels
- Meeting context and traceability

Autonomous AI task execution should be treated as a future/optional capability unless further elicitation establishes it as a current requirement.

**Next Step:** Add these findings to the central Product Backlog, then perform INVEST and MoSCoW refinement. Add identified conflicts to the Conflict Log before Sprint planning. Priorities from this single interview remain provisional until the pending Chair/Organiser and Note-Taker interviews are completed.

## Revision Notes (refinement pass, 28 Sep 2026)
- FR-INT-02: multiple assignees reconciled with the survey's "single point of accountability" (one primary owner + collaborators).
- FR-INT-03: external parties recorded as text owner labels (no accounts), keeping workspace isolation intact.
- FR-INT-04/05: reduced to a single `blocked_by` reference with an overdue-prerequisite flag, and moved to Could.
- FR-INT-06: channels limited to zero-cost options.
- NFRs linked to measurable targets in the master SRS; recording-consent note added.
