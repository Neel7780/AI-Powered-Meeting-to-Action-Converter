# AI-Powered Meeting-to-Action Converter for Teams

## Overview

Student clubs and project teams take meeting notes but rarely follow up on them properly — action items get lost in WhatsApp chats. This project is a web application that lets users paste, type, or upload meeting notes (or a transcript), automatically extracts action items, owners, and deadlines using GenAI, and — after an organiser reviews and approves them — syncs them into a shared task board with reminders. In-app, email, and browser push notifications (plus a one-tap "Share on WhatsApp" link) ensure assigned people are actually pinged before their deadlines.

## Course Context

- **Course:** IT314 – Software Engineering
- **Methodology:** Agile (SCRUM)
- **Team size:** 10 (1 lead + 9 members)

## Project Planning & Documentation

Stakeholder analysis, requirements elicitation, the product backlog, epics, sprints, and team coordination are tracked in our Notion hub:

**[AI-Powered Meeting-to-Action Converter — IT314 Team Hub](https://app.notion.com/p/AI-Powered-Meeting-to-Action-Converter-IT314-Team-Hub-1666e879513483b0be7881b1b3ccff07?source=copy_link)**

## Requirements Documents

All requirement documents live in [`doc/`](doc/):

- [`doc/FINAL_PROJECT_SPEC.md`](doc/FINAL_PROJECT_SPEC.md) — **start here**: consolidated scope, stack, data model, and Sprint 1 plan
- [`doc/refined.md`](doc/refined.md) — master SRS (FR, NFR, domain requirements, conflict log, backlog)
- [`doc/Admin_Security_Legal_Privacy_Requirements_refined.md`](doc/Admin_Security_Legal_Privacy_Requirements_refined.md)
- [`doc/Survey_Form_Elicitation_Findings_refined.md`](doc/Survey_Form_Elicitation_Findings_refined.md)
- [`doc/stakeholder_elicitation_interview_1.md`](doc/stakeholder_elicitation_interview_1.md)
- [`doc/ai-infra/01-ai-llm.md`](doc/ai-infra/01-ai-llm.md) — LLM provider research

## Status

Requirements elicitation and refinement complete; a throw-away prototype has been built. Next: Sprint 1 (auth + workspace, transcript ingestion, GenAI extraction, review gate, Kanban board) on a zero-budget stack (Vercel, Render, Supabase).
