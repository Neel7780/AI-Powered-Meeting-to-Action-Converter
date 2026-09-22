# Preliminary Requirements Specification
## Survey/Form-Based Elicitation Findings

> **Note:** The findings and requirements in this document are derived
> from the survey/form circulated during the initial requirements
> elicitation phase. They are **preliminary requirements** and do not
> represent the complete system requirements. Additional requirements
> will be identified, validated, and refined using other elicitation
> techniques such as interviews, observation, document analysis,
> stakeholder discussions, and prototype-based elicitation.

---

# 1. Survey/Form Elicitation Findings

## 1.1 Current Task Management

Teams currently use multiple tools such as WhatsApp, Notion, Slack,
Google Docs, Google Sheets, and physical notebooks for managing tasks.

This indicates a need for a centralized task-management system where
meeting-related tasks can be recorded, assigned, tracked, and followed
up from a single location.

## 1.2 Missed Tasks and Follow-up

Tasks are often forgotten or lost in chats, notes, or meeting
discussions. Repeated reminders and difficulty tracking task progress
also create follow-up problems.

The system should therefore provide centralized task storage,
progress tracking, and automated reminders.

## 1.3 Task Ownership and Deadlines

Unclear ownership and missing or forgotten deadlines are common concerns.

Every confirmed action item should therefore clearly identify:

- Task
- Owner
- Deadline
- Priority
- Status

## 1.4 AI Task Extraction

Respondents found value in using AI to identify important information
from meeting transcripts, including:

- Action items
- Task owners
- Deadlines
- Priorities
- Decisions
- Important discussion points

## 1.5 AI Review and Uncertainty Handling

Users generally prefer reviewing AI-generated tasks, especially when the
AI is uncertain.

Suggested approaches include:

- Marking the item as **Needs Review**
- Asking the meeting organizer for clarification
- Confirming information with the responsible person
- Allowing users to edit AI-generated information before confirmation

## 1.6 Reminders and Integration

Respondents preferred receiving reminders through channels such as:

- WhatsApp
- Email
- In-app notifications
- Slack
- Microsoft Teams

Respondents also generally supported adding confirmed tasks directly
to a shared task board.

## 1.7 Additional Requirements Identified

Respondents additionally suggested:

- Automatic prioritization
- Progress tracking
- Task explanations
- Meeting summaries
- Transcript access
- Deadline alerts
- Team-wide integration

---

# 2. Overall Preliminary Elicitation Finding

The survey indicates that the main difficulty is not simply taking
meeting notes, but **turning meeting discussions into clearly assigned,
trackable, and actionable work**.

Based on the survey/form responses, the proposed system should support:

1. Extracting action items from meetings.
2. Identifying task owners.
3. Identifying deadlines.
4. Assigning priorities.
5. Capturing important decisions.
6. Capturing pending questions.
7. Handling uncertain information through human confirmation.
8. Moving confirmed tasks into a shared task board.
9. Tracking task progress.
10. Sending reminders before deadlines.
11. Keeping meeting-related tasks in one centralized location.

---

# 3. Functional Requirements (FRs)

Functional requirements describe what the proposed system should do.

## FR-01: Meeting Transcript Input

The system shall accept a live or recorded meeting transcript as input.

## FR-02: Meeting Record Creation

The system shall create a unique record for each meeting and associate
the transcript and extracted information with that meeting.

## FR-03: AI Action-Item Extraction

The system shall identify actionable tasks from meeting transcripts and
distinguish them from general discussion.

## FR-04: Task Owner Identification

The system shall identify the person responsible for an action item when
sufficient information is available in the transcript.

## FR-05: Deadline Identification

The system shall identify explicit deadlines and relevant date/time
information from meeting discussions.

## FR-06: Priority Identification

The system shall identify task priorities when priority information is
explicitly stated or can be reliably inferred according to defined
system rules.

## FR-07: Decision Extraction

The system shall identify important decisions made during the meeting
and store them separately from action items.

## FR-08: Pending Question Identification

The system shall identify unresolved questions and pending
clarifications from the meeting.

## FR-09: Important Discussion Point Extraction

The system shall identify and summarize important discussion points
that may provide context for tasks and decisions.

## FR-10: AI Confidence and Uncertainty Detection

The system shall identify uncertain AI-generated information and mark
the relevant task or field as **Needs Review**.

## FR-11: Human Review

The system shall provide a review interface through which users can
confirm, edit, or reject AI-generated tasks.

## FR-12: Task Confirmation

The system shall allow a user to confirm an extracted task before it is
treated as an official task when review is required.

## FR-13: Task Owner Editing

The system shall allow authorized users to change or assign the owner
of a task.

## FR-14: Deadline Editing

The system shall allow authorized users to modify or confirm task
deadlines.

## FR-15: Priority Editing

The system shall allow authorized users to modify task priorities.

## FR-16: Shared Task Board

The system shall provide a centralized task board containing confirmed
meeting-related tasks.

## FR-17: Task Status Management

The system shall support task statuses such as:

- To Do
- In Progress
- Blocked
- Completed

## FR-18: Progress Tracking

The system shall allow users to track the progress of assigned tasks.

## FR-19: Task Search and Filtering

The system shall allow users to search and filter tasks by meeting,
owner, deadline, priority, and status.

## FR-20: Deadline Reminders

The system shall generate reminders for upcoming deadlines.

## FR-21: Overdue Notifications

The system shall identify overdue tasks and notify relevant users.

## FR-22: Notification Channels

The system shall support in-app notifications and, where integrations
are available, notifications through email, WhatsApp, Slack, or
Microsoft Teams.

## FR-23: Meeting Summary

The system shall generate a meeting summary containing relevant
discussion points, decisions, action items, owners, and deadlines.

## FR-24: Transcript Access

The system shall allow authorized users to access the transcript
associated with a meeting.

## FR-25: Task Explanation

The system shall provide relevant source context explaining why an
action item was extracted.

## FR-26: External Task Integration

The system shall support transferring confirmed tasks to supported
external task-management or collaboration platforms.

---

# 4. Non-Functional Requirements (NFRs)

Non-functional requirements describe quality attributes and constraints
for the system.

## NFR-01: Performance

The system should process transcript content with low latency and
provide AI-generated task suggestions within a reasonable response
time.

## NFR-02: Reliability

The system shall minimize task duplication and shall maintain
consistency between meeting records, transcripts, extracted tasks, and
confirmed tasks.

## NFR-03: Availability

The system should remain available during normal meeting and working
hours.

## NFR-04: Accuracy

The AI should accurately identify action items, owners, deadlines,
priorities, decisions, and pending questions.

## NFR-05: Uncertainty Handling

The system shall avoid presenting uncertain AI-generated information
as confirmed information.

## NFR-06: Security

Meeting transcripts, tasks, and user information shall be protected
against unauthorized access.

## NFR-07: Authentication and Authorization

Protected system functionality shall require authentication, and
access shall be restricted according to user permissions.

## NFR-08: Privacy

The system shall clearly define how meeting transcripts and extracted
information are collected, processed, stored, and deleted.

## NFR-09: Usability

The interface shall make task ownership, deadlines, priorities, status,
and review requirements easy to understand.

## NFR-10: Scalability

The system should support increasing numbers of users, meetings,
transcripts, and tasks.

## NFR-11: Maintainability

The system should use modular components for transcript processing,
AI extraction, task management, notifications, and integrations.

## NFR-12: Interoperability

The system should use standard APIs and data formats for supported
external integrations.

## NFR-13: Auditability

Important task changes such as creation, confirmation, editing,
assignment, status changes, and completion should be recorded.

## NFR-14: Explainability

AI-generated tasks should provide sufficient source context so users
can understand and verify the extraction.

## NFR-15: Data Integrity

The system shall validate required task information and maintain
consistent task records during creation, editing, and synchronization.

## NFR-16: Accessibility

The user interface should follow applicable accessibility practices
and provide usable controls and readable task information.

---

# 5. Domain Requirements (DRs)

Domain requirements describe rules specific to meeting-based task
management and AI-assisted requirement analysis.

## DR-01: Meeting-Task Association

Every confirmed task shall be associated with the meeting from which it
originated.

## DR-02: Action-Item Structure

An action item should contain, where available:

- Task ID
- Task description
- Owner
- Deadline
- Priority
- Status
- Meeting ID
- Source transcript reference
- Creation/confirmation timestamp

## DR-03: Requirement Classification

Extracted meeting information shall be distinguishable as:

- Action item
- Decision
- Pending question
- Important discussion point
- General discussion

## DR-04: Requirement Traceability

Each AI-generated action item should be traceable to the transcript
segment that resulted in its extraction.

## DR-05: Human-in-the-Loop Validation

AI-generated information shall be treated as a suggestion until it is
reviewed or confirmed according to the configured workflow.

## DR-06: Ownership Rule

A confirmed task should have a clearly identified owner. If the owner
cannot be determined, the task should remain in a review or pending
state rather than being arbitrarily assigned.

## DR-07: Deadline Rule

A deadline shall only be treated as confirmed when it is supported by
the meeting discussion or user confirmation.

## DR-08: Ambiguous Date Handling

Ambiguous relative dates such as "next Friday" should be interpreted
using the meeting date, time zone, and applicable locale, and should
remain reviewable when ambiguity exists.

## DR-09: Priority Rule

Task priority should be based on explicit meeting statements or defined
organizational rules. AI-inferred priority must remain editable.

## DR-10: Task Lifecycle

Tasks should follow a defined lifecycle:

**Extracted → Needs Review → Confirmed → To Do → In Progress →
Blocked/Completed**

## DR-11: Overdue Rule

A task shall be considered overdue when its confirmed deadline has
passed and its status is not Completed.

## DR-12: Meeting Context

Tasks, decisions, and summaries should preserve sufficient meeting
context to maintain the original meaning of the discussion.

## DR-13: Collaboration Rule

Authorized team members should have shared visibility of confirmed
tasks and their progress.

## DR-14: Notification Rule

Notifications should be generated according to configured reminder and
deadline rules.

## DR-15: Requirement Change Management

Changes to important task attributes such as owner, deadline, priority,
or description should be traceable where audit history is enabled.

## DR-16: External Integration Rule

External integrations shall use authorized accounts and supported APIs.
Synchronization conflicts should be detected and handled without
silently overwriting confirmed information.

---

# 6. User Stories

## Epic 1: Meeting and Transcript Management

### US-01: Process Meeting Transcript

**As a meeting participant, I want to provide a meeting transcript so
that the system can analyze the discussion and identify actionable
information.**

**Acceptance Criteria:**
- A transcript can be submitted successfully.
- A meeting record is created.
- The transcript remains associated with the meeting.

### US-02: Access Previous Meetings

**As a team member, I want to access previous meeting records so that I
can review earlier discussions and tasks.**

**Acceptance Criteria:**
- Previous meetings are listed.
- Authorized users can open meeting records.
- Associated tasks and decisions are accessible.

### US-03: View Transcript Context

**As a user, I want to view the transcript segment behind an extracted
task so that I can verify its meaning.**

**Acceptance Criteria:**
- Extracted tasks have source references where available.
- Selecting the source displays relevant transcript context.

---

## Epic 2: AI-Based Extraction

### US-04: Extract Action Items

**As a meeting participant, I want AI to extract action items from the
transcript so that I do not have to manually identify every task.**

**Acceptance Criteria:**
- Actionable statements are identified.
- General discussion is not automatically converted into tasks.
- Extracted items are presented for review when required.

### US-05: Identify Task Owner

**As a team member, I want the system to identify the task owner so
that responsibility is clear.**

**Acceptance Criteria:**
- An owner is extracted when supported by the transcript.
- The owner is linked to a participant.
- Uncertain ownership is marked **Needs Review**.

### US-06: Identify Deadline

**As a team member, I want the system to identify deadlines so that
tasks can be tracked against time.**

**Acceptance Criteria:**
- Explicit deadlines are extracted.
- Dates are normalized.
- Ambiguous deadlines are flagged for review.

### US-07: Identify Priority

**As a team member, I want the system to identify task priority so
that different levels of urgency can be managed.**

**Acceptance Criteria:**
- Explicit priority information is extracted.
- Users can modify the priority.
- Uncertain priority can be marked for review.

### US-08: Extract Decisions

**As a meeting participant, I want important decisions extracted from
the meeting so that agreed outcomes are not forgotten.**

**Acceptance Criteria:**
- Decisions are displayed separately from tasks.
- Decisions contain source context where available.

### US-09: Identify Pending Questions

**As a meeting participant, I want unresolved questions identified so
that they can be followed up later.**

**Acceptance Criteria:**
- Unresolved questions are listed.
- A question can be assigned to a responsible person.
- A question can be marked as resolved.

---

## Epic 3: Review and Validation

### US-10: Review AI Suggestions

**As a meeting organizer, I want to review AI-generated tasks before
confirmation so that incorrect or incomplete information can be
corrected.**

**Acceptance Criteria:**
- AI suggestions are displayed in a review interface.
- Users can confirm, edit, or reject suggestions.
- Confirmed tasks are separated from unconfirmed suggestions.

### US-11: Resolve Uncertainty

**As a meeting organizer, I want uncertain task information to be
clearly flagged so that I can resolve it before assigning work.**

**Acceptance Criteria:**
- Uncertain fields are visibly marked.
- The user can provide corrected information.
- The updated information is stored with the task.

### US-12: Confirm Task

**As a responsible team member, I want to confirm an extracted task so
that it becomes an official team task.**

**Acceptance Criteria:**
- Confirmation changes the task to a confirmed state.
- The confirmed task appears on the shared task board.
- Confirmation information is recorded where applicable.

---

## Epic 4: Task Management

### US-13: Shared Task Board

**As a team member, I want a centralized task board so that meeting
tasks are not scattered across multiple tools.**

**Acceptance Criteria:**
- Confirmed tasks appear on the board.
- Authorized team members can view relevant tasks.
- Owner, deadline, priority, and status are visible where available.

### US-14: Update Task Status

**As a task owner, I want to update my task status so that the team can
see my progress.**

**Acceptance Criteria:**
- Task status can be changed.
- Supported statuses include To Do, In Progress, Blocked, and
  Completed.
- Changes are reflected on the task board.

### US-15: Track Progress

**As a team member, I want to see task progress so that I can understand
what remains pending.**

**Acceptance Criteria:**
- Pending and completed tasks are distinguishable.
- Blocked and overdue tasks can be identified.
- Progress information updates after status changes.

### US-16: Search and Filter Tasks

**As a team member, I want to search and filter tasks so that I can
quickly find work relevant to me.**

**Acceptance Criteria:**
- Tasks can be searched.
- Tasks can be filtered by owner, meeting, priority, deadline, and
  status.

---

## Epic 5: Reminders and Follow-up

### US-17: Receive Deadline Reminder

**As a task owner, I want to receive reminders before a deadline so
that I can complete my assigned task on time.**

**Acceptance Criteria:**
- Reminders are generated according to configured rules.
- The reminder identifies the relevant task and deadline.

### US-18: Receive Overdue Notification

**As a task owner, I want to be notified when a task becomes overdue so
that I can take corrective action.**

**Acceptance Criteria:**
- Overdue tasks are identified.
- The owner receives a notification through a supported channel.

### US-19: Receive Team Notifications

**As a team member, I want relevant task updates and reminders through
supported communication channels so that I do not need to repeatedly
check the task board.**

**Acceptance Criteria:**
- Configured notification channels can receive notifications.
- Users can distinguish task reminders from other notifications.

---

## Epic 6: Summaries and Explanations

### US-20: Generate Meeting Summary

**As a meeting participant, I want an automatic meeting summary so that
I can quickly understand what was discussed and agreed upon.**

**Acceptance Criteria:**
- The summary contains key discussion points.
- Decisions and action items are highlighted.
- Owners and deadlines are included when available.

### US-21: Understand Task Explanation

**As a user, I want to know why the AI created a task so that I can
verify that it correctly represents the meeting discussion.**

**Acceptance Criteria:**
- The task includes relevant source context.
- The user can inspect the supporting transcript segment.

---

## Epic 7: Integration

### US-22: Add Confirmed Task to External Tool

**As a team member, I want confirmed tasks to synchronize with supported
task or collaboration tools so that I can continue using my team's
workflow.**

**Acceptance Criteria:**
- Authorized integrations can receive confirmed tasks.
- Owner, deadline, priority, and status are transferred where
  supported.
- Synchronization errors are reported.

### US-23: Centralized Meeting Workspace

**As a team member, I want meeting transcripts, summaries, decisions,
questions, and tasks linked together so that all meeting-related work
is available in one place.**

**Acceptance Criteria:**
- A meeting record links to its transcript.
- The meeting links to extracted decisions, questions, and tasks.
- Authorized team members can access related information.

---
