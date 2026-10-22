import type { TranscriptSegment, ActionItemCandidate } from '../types/review';
import type { RichMeetingDetails } from '../types/meetingDetails';

export const DESIGN_SPRINT_TRANSCRIPT: TranscriptSegment[] = [
  {
    id: 'seg-ds-1',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 0,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 0,
    end_ms: 18000,
    start_seconds: 0,
    timestamp: '00:00',
    text: "Alright team, let's kick off our Design Sprint Review for the AI Notetaker project. The goal today is to go over the latest prototype and align on the next sprint tasks."
  },
  {
    id: 'seg-ds-2',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 1,
    speaker_name: 'Asha',
    speaker_color: 'emerald',
    start_ms: 19000,
    end_ms: 48000,
    start_seconds: 19,
    timestamp: '00:19',
    text: "Perfect. The main focus from last sprint was improving the real-time transcription speed and cleaning up the dashboard navigation, right?"
  },
  {
    id: 'seg-ds-3',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 2,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 50000,
    end_ms: 95000,
    start_seconds: 50,
    timestamp: '00:50',
    text: "Exactly. I've refined the sidebar. it's now grouped into General, AI Insights, and Workspaces. Also added a clean breadcrumb for better navigation inside meeting notes."
  },
  {
    id: 'seg-ds-4',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 3,
    speaker_name: 'Vikram',
    speaker_color: 'purple',
    start_ms: 98000,
    end_ms: 142000,
    start_seconds: 98,
    timestamp: '01:38',
    text: "From the dev side, the live transcription latency is now under one second. I also optimized the API calls for faster summary generation."
  },
  {
    id: 'seg-ds-5',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 4,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 145000,
    end_ms: 182000,
    start_seconds: 145,
    timestamp: '02:25',
    text: "Got it — I'll tweak the accent colors. Maybe shift from blue to teal for better visibility."
  },
  {
    id: 'seg-ds-6',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 5,
    speaker_name: 'Asha',
    speaker_color: 'emerald',
    start_ms: 185000,
    end_ms: 245000,
    start_seconds: 185,
    timestamp: '03:05',
    text: 'One quick note — we should also improve how "Action Items" are displayed. Right now, they\'re just listed under AI Insights; maybe give them their own dedicated tab.'
  },
  {
    id: 'seg-ds-7',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 6,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 248000,
    end_ms: 285000,
    start_seconds: 248,
    timestamp: '04:08',
    text: "I like that idea. It'll make the post-meeting review much easier for users."
  },
  {
    id: 'seg-ds-8',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 7,
    speaker_name: 'Vikram',
    speaker_color: 'purple',
    start_ms: 288000,
    end_ms: 325000,
    start_seconds: 288,
    timestamp: '04:48',
    text: "I can handle that structurally. Should I connect it to the AI tagging system too?"
  },
  {
    id: 'seg-ds-8b',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 8,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 312000,
    end_ms: 327000,
    start_seconds: 312,
    timestamp: '05:12',
    text: "Let's move to navigation and sidebar refinement. The user feedback on our three distinct sections has been overwhelmingly positive."
  },
  {
    id: 'seg-ds-9',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 9,
    speaker_name: 'Asha',
    speaker_color: 'emerald',
    start_ms: 328000,
    end_ms: 375000,
    start_seconds: 328,
    timestamp: '05:28',
    text: "Yes, let's make sure those items are automatically linked to users when detected in transcript."
  },
  {
    id: 'seg-ds-10',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 9,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 380000,
    end_ms: 440000,
    start_seconds: 380,
    timestamp: '06:20',
    text: "Great point. That'll go under the 'Share & Export' workflow so organisers can review before anything syncs to Kanban."
  },
  {
    id: 'seg-ds-11',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 10,
    speaker_name: 'Asha',
    speaker_color: 'emerald',
    start_ms: 760000,
    end_ms: 840000,
    start_seconds: 760,
    timestamp: '12:40',
    text: "Regarding latency, sub-second transcription is huge for user retention. When users finish a 40-minute meeting, how quickly does the summary and chapter breakdown generate?"
  },
  {
    id: 'seg-ds-12',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 11,
    speaker_name: 'Vikram',
    speaker_color: 'purple',
    start_ms: 845000,
    end_ms: 920000,
    start_seconds: 845,
    timestamp: '14:05',
    text: "With Gemini 3.1 Flash-Lite, the entire structured summary and topic chapters are produced in under 3.2 seconds. It runs in the background and streams directly into the review view."
  },
  {
    id: 'seg-ds-13',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 12,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 1247000,
    end_ms: 1330000,
    start_seconds: 1247,
    timestamp: '20:47',
    text: "Here in the timeline view, users can clearly see talk-time ratios: Asha at 35%, Vikram at 30%, and myself at 38%. Clicking any chapter or speaker track instantly scrubs the player and highlights the transcript line."
  },
  {
    id: 'seg-ds-14',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 13,
    speaker_name: 'Asha',
    speaker_color: 'emerald',
    start_ms: 1335000,
    end_ms: 1410000,
    start_seconds: 1335,
    timestamp: '22:15',
    text: "This interactive scrubber is seamless! Also love that clicking a candidate action item automatically centers the source transcript excerpt."
  },
  {
    id: 'seg-ds-15',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 14,
    speaker_name: 'Vikram',
    speaker_color: 'purple',
    start_ms: 2050000,
    end_ms: 2150000,
    start_seconds: 2050,
    timestamp: '34:10',
    text: "I will finalize the PR for the action item auto-tagger and chapter parser by Friday afternoon."
  },
  {
    id: 'seg-ds-16',
    transcript_id: 'tr-ds-01',
    meeting_id: 'mtg-ds-01',
    segment_index: 15,
    speaker_name: 'Karthik',
    speaker_color: 'cyan',
    start_ms: 2600000,
    end_ms: 2747000,
    start_seconds: 2600,
    timestamp: '43:20',
    text: "Awesome work everyone. Let's wrap up and publish the approved tasks to the Kanban board!"
  }
];

export const DESIGN_SPRINT_CANDIDATES: ActionItemCandidate[] = [
  {
    id: 'ai-ds-01',
    meeting_id: 'mtg-ds-01',
    title: 'Tweak UI accent colors from blue to teal for improved accessibility',
    description: 'Refine active tabs and sidebar highlights to high-contrast teal theme.',
    due_date: '2025-11-05',
    assignee_id: 'usr-karthik',
    assignee: {
      id: 'mem-karthik',
      user_id: 'usr-karthik',
      full_name: 'Karthik',
      email: 'karthik@workspace.io',
      role: 'admin',
      initials: 'K'
    },
    status: 'approved',
    confidence_score: 0.98,
    transcript_timestamp: '02:25',
    transcript_segment_id: 'seg-ds-5',
    suggested_tags: ['Design', 'UI', 'Accessibility'],
    created_at: '2025-11-01T10:45:00Z',
    updated_at: '2025-11-01T10:45:00Z'
  },
  {
    id: 'ai-ds-02',
    meeting_id: 'mtg-ds-01',
    title: 'Create dedicated tab for Action Items separate from AI Insights',
    description: 'Ensure candidate items have their own distinct staging tab with batch approval.',
    due_date: '2025-11-07',
    assignee_id: 'usr-asha',
    assignee: {
      id: 'mem-asha',
      user_id: 'usr-asha',
      full_name: 'Asha',
      email: 'asha@workspace.io',
      role: 'meeting_organiser',
      initials: 'A'
    },
    status: 'approved',
    confidence_score: 0.96,
    transcript_timestamp: '03:05',
    transcript_segment_id: 'seg-ds-6',
    suggested_tags: ['UX', 'Review-Gate'],
    created_at: '2025-11-01T10:45:00Z',
    updated_at: '2025-11-01T10:45:00Z'
  },
  {
    id: 'ai-ds-03',
    meeting_id: 'mtg-ds-01',
    title: 'Connect action items to AI tagging system and auto-link detected users',
    description: 'Resolve transcript speaker tags to active workspace members using Gemini Flash-Lite.',
    due_date: '2025-11-08',
    assignee_id: 'usr-vikram',
    assignee: {
      id: 'mem-vikram',
      user_id: 'usr-vikram',
      full_name: 'Vikram',
      email: 'vikram@workspace.io',
      role: 'team_member',
      initials: 'V'
    },
    status: 'pending',
    confidence_score: 0.94,
    transcript_timestamp: '04:48',
    transcript_segment_id: 'seg-ds-8',
    suggested_tags: ['AI-Engine', 'Backend', 'LLM'],
    created_at: '2025-11-01T10:45:00Z',
    updated_at: '2025-11-01T10:45:00Z'
  },
  {
    id: 'ai-ds-04',
    meeting_id: 'mtg-ds-01',
    title: 'Finalize PR for action item auto-tagger and chapter parser',
    description: 'Complete backend unit tests and verify RLS security constraints on tasks.',
    due_date: '2025-11-07',
    assignee_id: 'usr-vikram',
    assignee: {
      id: 'mem-vikram',
      user_id: 'usr-vikram',
      full_name: 'Vikram',
      email: 'vikram@workspace.io',
      role: 'team_member',
      initials: 'V'
    },
    status: 'pending',
    confidence_score: 0.92,
    transcript_timestamp: '34:10',
    transcript_segment_id: 'seg-ds-15',
    suggested_tags: ['Backend', 'PR', 'Sprint-2'],
    created_at: '2025-11-01T10:45:00Z',
    updated_at: '2025-11-01T10:45:00Z'
  }
];

export const DESIGN_SPRINT_MEETING_DETAILS: RichMeetingDetails = {
  id: 'mtg-ds-01',
  title: 'Design Sprint Review',
  workspace_name: "Karthik's Workspace",
  workspace_id: 'ws-design-01',
  breadcrumb: ['Meetings', 'November', 'Client 04', 'Design Sprint Review'],
  date_formatted: 'Nov 01, 2025',
  tags: ['Design Team', 'Sprint 2', 'Prototype'],
  total_duration_seconds: 2747, // 45:47
  total_duration_formatted: '45:47',
  participants: [
    {
      name: 'Karthik',
      initials: 'K',
      role: 'Lead Designer & Organizer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      online: true
    },
    {
      name: 'Asha',
      initials: 'A',
      role: 'Product Strategist',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
      online: true
    },
    {
      name: 'Vikram',
      initials: 'V',
      role: 'Senior Backend Engineer',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      online: false
    }
  ],
  summary: {
    overview:
      "The team conducted a thorough Design Sprint Review focusing on the AI Notetaker prototype. The team validated that live transcription latency has dropped below 1 second, aligned on sidebar reorganization (General, AI Insights, Workspaces), and confirmed creating a dedicated tab for candidate action items with automatic user tagging.",
    key_discussion_points: [
      {
        topic: 'Real-time Latency & ASR Performance',
        points: [
          'Live transcription latency successfully optimized to under 1.0s.',
          'Summary and chapter generation completes in ~3.2s via Gemini 3.1 Flash-Lite background streaming.',
          'Zero paid APIs required; completely within free tier limits.'
        ],
        timestamp: '01:38',
        speakers: ['Vikram', 'Asha']
      },
      {
        topic: 'Navigation & Sidebar Architecture',
        points: [
          'Grouped navigation items into General, AI Insights, and Workspaces.',
          'Introduced hierarchical breadcrumbs for rapid meeting context orientation.',
          'Tweak accent palette from default blue to high-visibility teal.'
        ],
        timestamp: '00:50',
        speakers: ['Karthik']
      },
      {
        topic: 'Action Items & Staging Review Gate',
        points: [
          'Action items will have their own dedicated staging tab instead of being mixed in AI Insights.',
          'Automatic user tagging linking recognized names to workspace members.',
          'Organizer confirmation required before tasks can appear on the Kanban board.'
        ],
        timestamp: '03:05',
        speakers: ['Asha', 'Karthik', 'Vikram']
      }
    ],
    decisions: [
      {
        id: 'dec-1',
        text: 'Switch UI accent styling from blue to accessible teal (#0d9488 / #14b8a6).',
        timestamp: '02:25',
        speaker: 'Karthik',
        segment_id: 'seg-ds-5',
        excerpt: "Got it — I'll tweak the accent colors. Maybe shift from blue to teal for better visibility."
      },
      {
        id: 'dec-2',
        text: 'Provide a dedicated tab for candidate action items with explicit staging gate approval.',
        timestamp: '03:05',
        speaker: 'Asha',
        segment_id: 'seg-ds-6',
        excerpt: "we should also improve how 'Action Items' are displayed... give them their own dedicated tab."
      },
      {
        id: 'dec-3',
        text: 'Auto-link extracted action items to workspace members using LLM participant roster refs.',
        timestamp: '05:28',
        speaker: 'Asha',
        segment_id: 'seg-ds-9',
        excerpt: "let's make sure those items are automatically linked to users when detected in transcript."
      }
    ],
    outcomes: [
      'Sub-second live transcription verified in production prototype.',
      'Approved high-contrast teal theme for dark studio mode.',
      '4 candidate action items extracted and mapped to verbatim transcript timestamps.'
    ],
    next_steps: [
      'Vikram to submit action item auto-tagger PR by Friday.',
      'Karthik to update accent colors across navigation and meeting timeline.',
      'Asha to test staging gate batch approvals before Sprint 2 demo.'
    ],
    speaker_insights: [
      {
        speaker: 'Karthik',
        talk_percentage: 38,
        duration_min: 28,
        key_contribution: 'Presented sidebar UX improvements and facilitated design sprint alignment.'
      },
      {
        speaker: 'Asha',
        talk_percentage: 35,
        duration_min: 25,
        key_contribution: 'Advocated for dedicated Action Items tab and user-tagging automation.'
      },
      {
        speaker: 'Vikram',
        talk_percentage: 30,
        duration_min: 15,
        key_contribution: 'Reported <1s transcription benchmarks and committed to Friday PR release.'
      }
    ],
    generated_at: '2025-11-01T10:46:12Z',
    model_used: 'Gemini 3.1 Flash-Lite'
  },
  chapters: [
    {
      id: 'chap-1',
      title: 'Kickoff & Sprint Review Goals',
      timestamp: '00:00',
      start_seconds: 0,
      duration_seconds: 285,
      duration_str: '04:45',
      summary: 'Karthik introduces the meeting objectives to review latest prototype progress and set up Sprint 2 milestones.',
      speakers: ['Karthik', 'Asha'],
      key_points: ['Review latest prototype', 'Check previous sprint goals', 'Set agenda for review'],
      action_item_ids: [],
      decision_count: 0
    },
    {
      id: 'chap-2',
      title: 'Navigation & Sidebar Refinement',
      timestamp: '05:12',
      start_seconds: 312,
      duration_seconds: 448,
      duration_str: '07:28',
      summary: 'Detailed look at sidebar grouping (General, AI Insights, Workspaces) and switching accent palette to teal.',
      speakers: ['Karthik', 'Asha'],
      key_points: ['Grouped sidebar', 'Breadcrumbs for meeting notes', 'Teal accent color decision'],
      action_item_ids: ['ai-ds-01'],
      decision_count: 1
    },
    {
      id: 'chap-3',
      title: 'Real-time Latency & API Optimizations',
      timestamp: '12:40',
      start_seconds: 760,
      duration_seconds: 487,
      duration_str: '08:07',
      summary: 'Vikram presents latency benchmarks showing sub-second live transcription and 3.2s Gemini Flash-Lite summary generation.',
      speakers: ['Vikram', 'Asha'],
      key_points: ['Under 1-second ASR latency', 'Gemini Flash-Lite pipeline', 'Cost remains ₹0 on free tier'],
      action_item_ids: [],
      decision_count: 0
    },
    {
      id: 'chap-4',
      title: 'Action Items Dedicated Tab & UI',
      timestamp: '20:47',
      start_seconds: 1247,
      duration_seconds: 803,
      duration_str: '13:23',
      summary: 'Deep dive into separating Action Items from AI Insights into a dedicated staging gate with multi-track speaker scrubbers.',
      speakers: ['Asha', 'Karthik', 'Vikram'],
      key_points: ['Separate staging tab', 'Auto-link members to tasks', 'Multi-track speaker talk-time scrub bar'],
      action_item_ids: ['ai-ds-02', 'ai-ds-03'],
      decision_count: 2
    },
    {
      id: 'chap-5',
      title: 'Post-Meeting Review & Export Flow',
      timestamp: '34:10',
      start_seconds: 2050,
      duration_seconds: 697,
      duration_str: '11:37',
      summary: 'Final alignment on Friday PR deadline, one-tap WhatsApp share links, and publishing approved tasks to Kanban.',
      speakers: ['Vikram', 'Karthik'],
      key_points: ['PR release target: Friday', 'Export & WhatsApp wa.me link integration', 'Kanban synchronization'],
      action_item_ids: ['ai-ds-04'],
      decision_count: 0
    }
  ],
  speaker_tracks: [
    {
      speaker: 'Asha',
      role: 'Product Strategist',
      percentage: 35,
      duration_min: 25,
      color: 'emerald',
      segments: [
        { start_pct: 2, width_pct: 12, start_seconds: 19, end_seconds: 375, speaker: 'Asha' },
        { start_pct: 28, width_pct: 16, start_seconds: 760, end_seconds: 1200, speaker: 'Asha' },
        { start_pct: 54, width_pct: 9, start_seconds: 1335, end_seconds: 1600, speaker: 'Asha' },
        { start_pct: 72, width_pct: 14, start_seconds: 1900, end_seconds: 2280, speaker: 'Asha' }
      ]
    },
    {
      speaker: 'Vikram',
      role: 'Backend Engineer',
      percentage: 30,
      duration_min: 15,
      color: 'purple',
      segments: [
        { start_pct: 14, width_pct: 10, start_seconds: 98, end_seconds: 370, speaker: 'Vikram' },
        { start_pct: 32, width_pct: 15, start_seconds: 845, end_seconds: 1260, speaker: 'Vikram' },
        { start_pct: 66, width_pct: 11, start_seconds: 1800, end_seconds: 2110, speaker: 'Vikram' }
      ]
    },
    {
      speaker: 'Karthik',
      role: 'Lead Designer & Organizer',
      percentage: 38,
      duration_min: 28,
      color: 'cyan',
      segments: [
        { start_pct: 0, width_pct: 14, start_seconds: 0, end_seconds: 380, speaker: 'Karthik' },
        { start_pct: 18, width_pct: 12, start_seconds: 480, end_seconds: 810, speaker: 'Karthik' },
        { start_pct: 46, width_pct: 18, start_seconds: 1247, end_seconds: 1740, speaker: 'Karthik' },
        { start_pct: 82, width_pct: 17, start_seconds: 2250, end_seconds: 2747, speaker: 'Karthik' }
      ]
    }
  ],
  comments: [
    {
      id: 'comm-1',
      author: 'Asha',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
      timestamp: '03:15',
      seconds: 195,
      text: 'Make sure the staging gate shows owner confidence percentages!'
    },
    {
      id: 'comm-2',
      author: 'Vikram',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      timestamp: '14:20',
      seconds: 860,
      text: 'Gemini 3.1 Flash-Lite handles up to 1M token context seamlessly.'
    },
    {
      id: 'comm-3',
      author: 'Karthik',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      timestamp: '20:50',
      seconds: 1250,
      text: 'This timeline scrubber matches our Figma design tokens.'
    }
  ],
  clips: [
    {
      id: 'clip-1',
      title: 'Latency Demo (<1s)',
      start_timestamp: '01:38',
      end_timestamp: '02:25',
      start_seconds: 98,
      end_seconds: 145,
      speaker: 'Vikram',
      tag: 'Performance'
    },
    {
      id: 'clip-2',
      title: 'Action Items Dedicated Tab Concept',
      start_timestamp: '03:05',
      end_timestamp: '04:08',
      start_seconds: 185,
      end_seconds: 248,
      speaker: 'Asha',
      tag: 'UX Decision'
    },
    {
      id: 'clip-3',
      title: 'Timeline Multi-track Walkthrough',
      start_timestamp: '20:47',
      end_timestamp: '22:15',
      start_seconds: 1247,
      end_seconds: 1335,
      speaker: 'Karthik',
      tag: 'Feature Demo'
    }
  ],
  trackers: [
    { keyword: 'Action Items', category: 'feature', occurrences: 14, timestamps: ['03:05', '04:48', '20:47', '34:10'] },
    { keyword: 'Latency', category: 'architecture', occurrences: 9, timestamps: ['01:38', '12:40', '14:05'] },
    { keyword: 'Sidebar', category: 'feature', occurrences: 7, timestamps: ['00:50', '02:25', '05:12'] },
    { keyword: 'Kanban', category: 'decision', occurrences: 6, timestamps: ['04:08', '06:20', '43:20'] }
  ],
  metrics: {
    total_duration_str: '45:47',
    total_duration_seconds: 2747,
    pacing_wpm: 142,
    sentiment_score: '96% Positive & Goal-Oriented',
    action_items_count: 4,
    decisions_count: 3,
    questions_count: 11,
    speaker_talk_ratios: [
      { speaker: 'Karthik', percentage: 38, minutes: 28 },
      { speaker: 'Asha', percentage: 35, minutes: 25 },
      { speaker: 'Vikram', percentage: 30, minutes: 15 }
    ]
  }
};
