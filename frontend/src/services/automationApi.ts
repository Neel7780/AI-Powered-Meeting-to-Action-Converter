import { requestApi } from '../lib/api';
export interface AutomationProviderStatus {
  provider: string;
  name: string;
  connected: boolean;
  auto_ingest_enabled: boolean;
  limitations?: string;
}
export interface AutomationStatusResponse {
  workspace_id: string;
  auto_ingest_global: boolean;
  providers: AutomationProviderStatus[];
  total_automated_meetings: number;
}
export const automationApi = {
  getStatus: (workspaceId: string) => requestApi<AutomationStatusResponse>(`/api/meetings/automation/status?workspace_id=${workspaceId}`),
};
