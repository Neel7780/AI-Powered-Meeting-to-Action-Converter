/**
 * API service for Online Meeting Automation (Sprint 2 - Task 1: Madhav Chauhan).
 *
 * Integrates Google Meet, Zoom, and Microsoft Teams automated transcript ingestion.
 */

import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export type ProviderType = 'google_meet' | 'zoom' | 'teams';

export interface AutomationProviderStatus {
  provider: ProviderType;
  name: string;
  connected: boolean;
  account_email?: string | null;
  auto_ingest_enabled: boolean;
  capabilities: string[];
  limitations?: string | null;
}

export interface AutomationStatusResponse {
  workspace_id: string;
  auto_ingest_global: boolean;
  providers: AutomationProviderStatus[];
  total_automated_meetings: number;
  last_sync_at?: string | null;
}

export interface SimulateMeetingRequest {
  workspace_id: string;
  provider: ProviderType;
  title: string;
  duration_minutes: number;
  conference_url?: string;
  transcript_text?: string;
  auto_extract?: boolean;
}

export interface SimulateMeetingResponse {
  success: boolean;
  meeting_id: string;
  title: string;
  provider: ProviderType;
  starts_at: string;
  transcript_id?: string;
  segment_count: number;
  extracted_items_count: number;
  message: string;
  review_url: string;
}

export interface AutomatedMeetingFeedItem {
  id: string;
  title: string;
  provider: string;
  starts_at: string;
  timezone: string;
  status: string;
  conference_url?: string | null;
  has_transcript: boolean;
  task_count: number;
  created_at: string;
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const res = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`);
  }
  return data as T;
}

export const automationApi = {
  /**
   * Get current online meeting automation & provider connection status.
   */
  async getStatus(workspaceId: string): Promise<AutomationStatusResponse> {
    return await requestApi<AutomationStatusResponse>(
      `/api/meetings/automation/status?workspace_id=${workspaceId}`
    );
  },

  /**
   * Run end-to-end ingestion & real LLM extraction of an online meeting.
   */
  async simulateMeeting(payload: SimulateMeetingRequest): Promise<SimulateMeetingResponse> {
    return await requestApi<SimulateMeetingResponse>(
      '/api/meetings/automation/simulate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Update automation configuration preferences.
   */
  async updateConfig(
    workspaceId: string,
    config: {
      auto_ingest_global?: boolean;
      enabled_providers?: ProviderType[];
      auto_trigger_extraction?: boolean;
      default_visibility?: string;
    }
  ): Promise<any> {
    return await requestApi(
      `/api/meetings/automation/config?workspace_id=${workspaceId}`,
      {
        method: 'POST',
        body: JSON.stringify(config),
      }
    );
  },

  /**
   * Fetch recent automated online meetings.
   */
  async getFeed(workspaceId: string): Promise<AutomatedMeetingFeedItem[]> {
    return await requestApi<AutomatedMeetingFeedItem[]>(
      `/api/meetings/automation/feed?workspace_id=${workspaceId}`
    );
  },
};
