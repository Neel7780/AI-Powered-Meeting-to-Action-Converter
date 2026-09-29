# Frontend Design System & Landing Page Blueprint (Refined)

**Project:** AI-Powered Meeting-to-Action Converter (ActionPulse)  
**Role:** Lead UI/UX Designer  
**Target Phase:** Sprint 1 — Public Landing Page & Design Foundations  
**Design Philosophy:** *"Linear meets Notion for Meeting Intelligence"* — fast, opinionated, ultra-crisp, trustworthy, and developer-grade.

---

## 1. Executive Summary & Design Principles

This blueprint balances **high-aesthetic visual distinction** (inspired by Linear and Raycast) with **enterprise restraint and disciplined information architecture**. 

### The 80 / 15 / 5 Design Principle
* **80% Information Architecture & Data Density:** Clear visual hierarchy, scannable typography, and immediate demonstration of core product value.
* **15% Typographic Precision & Structural Spacing:** Strict 4px/8px spatial rhythm, balanced line heights, and clear contrast ratios.
* **5% Intentional Visual Accents:** Restrained 1px subtle borders (`border-slate-800/60`), muted ambient gradients, and crisp status badges. No gratuitous neon beams, heavy glassmorphism, or distracting hackathon-style animations.

---

## 2. Design Tokens & Semantic Color Palette

The landing page uses a refined **Obsidian Slate** theme. Dark backgrounds provide high contrast for transcript reading, task cards, and status tags while maintaining a modern B2B SaaS feel.

### 🎨 Color Palette Map (Tailwind CSS Ready)

| Token Role | Hex Code | Semantic Purpose | Tailwind Class |
| :--- | :--- | :--- | :--- |
| **Surface Base** | `#080C14` | Deep Obsidian background canvas | `bg-slate-950` |
| **Surface Raised** | `#0F172A` | Card containers, preview panels | `bg-slate-900` |
| **Surface Overlay** | `#1E293B` | Dropdowns, dialogs, popovers | `bg-slate-800/90` |
| **Border Subtle** | `#334155` (30%) | Clean 1px card outlines & dividers | `border-slate-800/80` |
| **Border Active** | `#6366F1` (50%) | Focused states & active card highlights | `border-indigo-500/50` |
| **Brand Primary** | `#6366F1` | Primary CTA buttons & active indicators | `text-indigo-400` / `bg-indigo-600` |
| **AI Intelligence** | `#8B5CF6` | AI action badges & extraction pills | `text-violet-400` / `bg-violet-950/50` |
| **Grounded / Verified** | `#10B981` | Verbatim source citations & approved tasks | `text-emerald-400` / `bg-emerald-950/50` |
| **Review / Flagged** | `#F59E0B` | Uncertainty flags & missing owner alerts | `text-amber-400` / `bg-amber-950/50` |
| **Destructive / Reject** | `#EF4444` | Rejections, deletions, error states | `text-rose-400` / `bg-rose-950/50` |
| **Text High** | `#F8FAFC` | Headings, hero copy, card titles | `text-slate-50` |
| **Text Body** | `#94A3B8` | Explanations, subheadings, transcript text | `text-slate-400` |
| **Text Muted** | `#64748B` | Timestamps, metadata, labels, footnotes | `text-slate-500` |

---

## 3. Typography & Layout Hierarchy

- **Primary Sans:** `Inter`, `Geist Sans`, or system `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`.
- **Monospace:** `JetBrains Mono`, `Fira Code`, or `ui-monospace` (used for timestamps, transcript segments, and verbatim citations).
- **Scale:**
  - `Hero Headline`: 48px – 60px (`text-4xl sm:text-6xl font-extrabold tracking-tight`).
  - `Section Headline`: 30px – 36px (`text-3xl font-bold tracking-tight`).
  - `Card Title`: 18px – 20px (`text-lg font-semibold`).
  - `Body Copy`: 15px – 16px (`text-sm sm:text-base leading-relaxed`).
  - `Metadata / Badges`: 12px – 13px (`text-xs font-mono font-medium`).
- **Container Widths:**
  - Page Content: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` (1280px).
  - Editorial / Centered Copy: `max-w-3xl mx-auto`.

---

## 4. Page Architecture (Streamlined 9-Section Flow)

```text
┌────────────────────────────────────────────────────────┐
│ [1] Clean Enterprise Navbar (No status widgets)        │
├────────────────────────────────────────────────────────┤
│ [2] Hero Section + Interactive Product Simulator       │
├────────────────────────────────────────────────────────┤
│ [3] How It Works: 4-Step Action Pipeline               │
├────────────────────────────────────────────────────────┤
│ [4] Core Capabilities: 4-Pillar Bento Grid             │
├────────────────────────────────────────────────────────┤
│ [5] AI That Shows Its Work: Grounding & Verification   │
├────────────────────────────────────────────────────────┤
│ [6] Workspace Control: Admin, Organiser & Member Roles │
├────────────────────────────────────────────────────────┤
│ [7] Security, Compliance & Data Sovereignty            │
├────────────────────────────────────────────────────────┤
│ [8] Architecture & Scalability: Built for Your Stack   │
├────────────────────────────────────────────────────────┤
│ [9] High-Impact Final CTA + Minimalist Footer          │
└────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Component Specifications

### 5.1 Clean Enterprise Navbar (`Navbar.tsx`)
- **Restraint Rule:** Remove backend status indicators and server pings. The navbar is reserved strictly for branding, navigation, and auth entry points.
- **Visual Style:** `sticky top-0 w-full z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80`.
- **Layout:**
  - **Left:** Brand Logo (⚡ Electric bolt badge in deep indigo) + `ActionPulse`.
  - **Center:** Navigation Links (`Features`, `How It Works`, `Security`, `Architecture`).
  - **Right:**
    - `Sign in` link (`text-slate-400 hover:text-white text-sm font-medium`).
    - Primary Button: `Get Started` (`bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition`).

---

### 5.2 Hero Section & Interactive Simulator (`Hero.tsx` + `InteractiveDemo.tsx`)

#### Hero Positioning & Copy Hierarchy
- **Eyebrow Badge:**  
  `AI-POWERED MEETING INTELLIGENCE`  
  *(Clean bordered pill: `bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full`)*
- **Main Headline:**  
  **Turn meeting conversations into accountable actions.**
- **Subheadline:**  
  *Extract tasks, owners, and deadlines from meeting transcripts, review every AI suggestion, and move approved actions directly into your team's workspace.*
- **Core Value Pillars:**  
  `Grounded in source quotes • Human approval • Workspace-based`
- **Primary CTAs:**  
  - `[Try the Demo]` (Smooth-scrolls / activates the interactive simulator)
  - `[Get Started]` (Direct to auth/workspace onboarding)

---

#### The Visual Centerpiece: The Product in One Screen

Directly below the hero copy, render an interactive **Transcript &rarr; Review Split Screen**:

```text
┌───────────────────────────────────┬───────────────────────────────────┐
│ MEETING TRANSCRIPT (INPUT)        │ AI EXTRACTED ACTIONS (REVIEW)     │
├───────────────────────────────────┼───────────────────────────────────┤
│                                   │                                   │
│ Priya: "The client demo is next   │ ┌───────────────────────────────┐ │
│ Thursday."                        │ │ Prepare onboarding flow       │ │
│                                   │ │ Owner: Aman Shah (Matched)    │ │
│ Rahul: "I will fix the login bug  │ │ Due: Friday (Resolved)        │ │
│ on Safari by Wednesday."          │ │ Source: "I'll have the..."    │ │
│                                   │ │ [Reject]   [Edit]   [Approve] │ │
│ Priya: "Aman, can you prepare     │ └───────────────────────────────┘ │
│ the revised onboarding flow       │                                   │
│ by Friday?"                       │ ┌───────────────────────────────┐ │
│                                   │ │ Fix Safari login bug          │ │
│ Aman: "Sure, I'll have the        │ │ Owner: Rahul Mehta (Matched)  │ │
│ onboarding flow ready by Friday." │ │ Due: Wednesday                │ │
│                                   │ │ [Reject]   [Edit]   [Approve] │ │
│ Priya: "Someone should update the │ └───────────────────────────────┘ │
│ README at some point."            │                                   │
│                                   │ ┌───────────────────────────────┐ │
│ Rahul: "The vendor will send the  │ │ ⚠ Update the README           │ │
│ invoice by the 5th."              │ │ Owner: Unassigned             │ │
│                                   │ │ Flag: Assignee Required       │ │
│                                   │ │ [Reject]   [Assign & Approve] │ │
│                                   │ └───────────────────────────────┘ │
└───────────────────────────────────┴───────────────────────────────────┘
```

#### Simulator Behavior:
- **Interactive Toggles:** Allow the user to click `[Approve]` on a card to see it instantly transform with a green checkmark (`Task Committed to Kanban`).
- **Quote Grounding Interaction:** Hovering over any action card highlights the corresponding sentence on the left transcript panel.
- **Uncertainty Demo:** Shows the "Update the README" card flagged with an amber warning, proving the system **never hallucinates owners**.

---

### 5.3 How It Works: The 4-Step Action Pipeline (`HowItWorks.tsx`)

A horizontal progress flow explaining the lifecycle from raw conversation to board commitment:

```text
  01 CAPTURE         →        02 EXTRACT         →        03 REVIEW          →        04 EXECUTE
Paste raw text or       AI extracts action-triplets:    Organiser verifies, edits,    Approved tasks sync
upload .vtt, .srt,      tasks, deadlines, and           or rejects suggestions on     to shared Kanban board;
.txt, or .docx.         proposed member owners.         the staging screen.           assignees notified.
```

- **Visual Style:** 4 numbered cards with subtle connector lines, highlighting the shift from automated parsing (01–02) to human control (03–04).

---

### 5.4 Core Capabilities Bento Grid (`FeatureBento.tsx`)

An asymmetric 4-card grid (`grid grid-cols-1 md:grid-cols-3 gap-6`):

1. **Card 1 (Span 2 cols): Grounded Action-Item Triplet Extraction**
   - Focus: Every action item extracts three elements: `Task`, `Owner`, and `Deadline`.
   - Visual: Delimited `<meeting_transcript>` block demonstrating prompt injection defense and verbatim excerpt verification.
2. **Card 2 (Span 1 col): Zero-Guess Assignee Matching**
   - Focus: Automatically matches spoken names against registered workspace members.
   - Guardrail: Ambiguous names or unassigned duties default to `owner: null` and trigger an `Uncertainty Flag`.
3. **Card 3 (Span 1 col): Multi-Format Ingestion**
   - Focus: Native support for pasted meeting notes, Teams/Zoom WebVTT (`.vtt`), SubRip (`.srt`), clean text (`.txt`), and Word (`.docx`).
4. **Card 4 (Span 2 cols): Shared Workspace Kanban & Notifications**
   - Focus: Interactive 4-column task board (`To Do`, `In Progress`, `Blocked`, `Done`) with 1-tap WhatsApp sharing (`wa.me`) and automated email dispatch upon task assignment.

---

### 5.5 AI That Shows Its Work: Grounding & Verification (`VerificationSection.tsx`)

A prominent enterprise credibility section contrasting traditional generative AI against ActionPulse's deterministic grounding:

#### Key Message:
> **"Grounded, reviewable AI extraction. Every AI-generated action is tied to a verbatim transcript quote and requires human approval before becoming a task."**

#### The Verification Card:
```text
┌────────────────────────────────────────────────────────┐
│ EXTRACTED ACTION CARD                                  │
│                                                        │
│ "Prepare revised onboarding flow"                      │
│ Suggested Owner: Aman Shah • Due: Friday               │
│                                                        │
│ VERBATIM SOURCE EXCERPT                                │
│ ❝ Aman: Sure, I'll have the onboarding flow ready      │
│   by Friday. ❞                                         │
│                                                        │
│ [✓ Verbatim Quote Verified]   [⚠ Human Approval Gate]  │
└────────────────────────────────────────────────────────┘
```
- Explains why ActionPulse is enterprise-grade: no phantom deliverables, no guessing who owns what, complete auditability.

---

### 5.6 Workspace Control: Role-Based Boundaries (`WorkspaceRoles.tsx`)

Displays the three canonical roles from [`FINAL_PROJECT_SPEC.md`](file:///home/godllike/Desktop/Sem5/SwE/Project/doc/FINAL_PROJECT_SPEC.md) with clarity:

```text
WORKSPACE ACCESS & ROLES

┌────────────────────────┬────────────────────────┬────────────────────────┐
│ ADMIN                  │ ORGANISER              │ MEMBER                 │
├────────────────────────┼────────────────────────┼────────────────────────┤
│ Manage workspace,      │ Create meetings,       │ View assigned tasks,   │
│ team members, invites, │ upload transcripts,    │ update own task status │
│ and workspace policies │ review AI suggestions, │ on the Kanban board,   │
│                        │ and approve tasks      │ and view meetings      │
└────────────────────────┴────────────────────────┴────────────────────────┘
```

- Communicates that permissions are built into the data layer via Postgres Row-Level Security (RLS).

---

### 5.7 Security, Compliance & Data Sovereignty (`SecuritySection.tsx`)

Four key security guarantees presented as concise enterprise cards:
1. **Human-in-the-Loop Review Gate (CR-01):** AI suggestions cannot write to the board or notify assignees without explicit human approval.
2. **Backend-Only Task Commits:** Frontend clients cannot insert tasks directly (blocked by RLS). All commits pass through verified backend endpoints.
3. **Prompt Injection Defense:** Transcripts are treated as untrusted user input and isolated within XML boundaries.
4. **No-AI Privacy Mode:** One-click meeting setting that bypasses all external AI calls for confidential discussions.

---

### 5.8 Architecture & Scalability: Built for Your Stack (`ArchitectureSection.tsx`)

*(Replaces commercial pricing tiers with a credible, developer-grade architecture breakdown).*

#### Headline:
**Built for your stack. Ready to scale.**

#### Structural Comparison:
```text
┌───────────────────────────────────┬───────────────────────────────────┐
│ PRODUCTION-READY CORE             │ MODULAR & EXTENSIBLE              │
├───────────────────────────────────┼───────────────────────────────────┤
│ • React 18+ (Vite SPA)            │ • Pluggable LLM Provider          │
│ • FastAPI Backend (Python 3.11)   │   (Gemini 3.1 Flash-Lite / Sarvam)│
│ • Supabase Postgres with RLS      │ • Multi-format Ingestion Pipeline │
│ • Automated JWT Verification      │ • Free SMTP Email Worker          │
│ • Audit Logging & Retention Rules │ • Web Push & WhatsApp Sharing     │
└───────────────────────────────────┴───────────────────────────────────┘
```

- **Actions:**  
  - `[View Architecture Spec]` (Links to `/doc/backend_plan.md` or API docs)  
  - `[View on GitHub]` (Links to repository)

---

### 5.9 High-Impact Final CTA & Minimalist Footer (`Footer.tsx`)

#### Closing CTA:
```text
┌────────────────────────────────────────────────────────┐
│        Turn your next meeting into action.             │
│                                                        │
│  Stop losing valuable commitments in meeting notes.    │
│  Extract, review, and deliver with ActionPulse.        │
│                                                        │
│             [ Get Started Free ]                       │
└────────────────────────────────────────────────────────┘
```

#### Minimalist Footer:
- Left: Logo + `ActionPulse • AI-Powered Meeting-to-Action Converter`.
- Center: Quick links (`Features`, `How It Works`, `Documentation`, `GitHub`).
- Right: `Course: IT314 Software Engineering • Team G-10`.

---

## 6. Component Directory & TypeScript Contracts

### Recommended File Structure
```text
frontend/src/
├── components/
│   ├── landing/
│   │   ├── Navbar.tsx             # Clean enterprise navigation
│   │   ├── Hero.tsx               # Headline, value anchors, CTAs
│   │   ├── InteractiveDemo.tsx    # Live Transcript -> Action simulator
│   │   ├── HowItWorks.tsx         # 4-step pipeline cards
│   │   ├── FeatureBento.tsx       # 4-pillar capabilities grid
│   │   ├── VerificationSection.tsx# Grounding & verbatim quote showcase
│   │   ├── WorkspaceRoles.tsx     # Admin / Organiser / Member cards
│   │   ├── SecuritySection.tsx    # RLS, No-AI mode, prompt defense
│   │   ├── ArchitectureSection.tsx# Stack & scalability breakdown
│   │   └── Footer.tsx             # Closing CTA & footer links
│   └── ui/
│       ├── Button.tsx             # Primary, secondary, outline buttons
│       ├── Badge.tsx              # Status chips (Emerald, Amber, Violet)
│       └── Card.tsx               # Slate-900 border-slate-800 container
└── pages/
    └── LandingPage.tsx            # Main landing page view
```

### TypeScript Props Blueprint

```typescript
// types/landing.ts

export type AppRole = 'admin' | 'organiser' | 'member';

export interface ActionItemPreview {
  id: string;
  title: string;
  owner: string | null;
  dueDate: string | null;
  verbatimExcerpt: string;
  isFlagged: boolean;
  flagReason?: string;
  status: 'needs_review' | 'approved' | 'rejected';
}

export interface PipelineStep {
  stepNumber: string;
  title: string;
  description: string;
}

export interface RoleCardProps {
  role: AppRole;
  displayName: string;
  description: string;
  permissions: string[];
}
```

---

## 7. UX Micro-Interactions & Polish Details

1. **Restrained Hover Elevation:**  
   Cards use `hover:border-slate-700 transition-colors duration-200` rather than heavy glowing box shadows.
2. **Interactive Excerpt Sync:**  
   Clicking or hovering over an action card in the simulator highlights the corresponding source text in the transcript pane using a subtle `bg-indigo-950/60 text-indigo-200` highlight.
3. **Simulated Approval Feedback:**  
   Clicking `[Approve]` triggers a clean 150ms checkmark transition with an emerald pill: `Approved & Commited`.
4. **Responsive Integrity:**  
   On mobile screens (`< 768px`), the 2-column Interactive Demo smoothly converts into a segmented tab control (`[Transcript] | [Extracted Actions (3)]`).
