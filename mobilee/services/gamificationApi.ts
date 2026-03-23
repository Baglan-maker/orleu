// mobile/services/gamificationApi.ts
import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────
export interface ProgressResponse {
  user_id:             string;
  xp:                  number;
  level:               number;
  coins:               number;
  current_streak:      number;
  longest_streak:      number;
  current_campaign_id: string | null;
  current_chapter_id:  string | null;
  campaign_path:       string | null;
  last_workout_at:     string | null;
  updated_at:          string | null;
}

export interface CampaignResponse {
  id:             string;
  name:           string;
  description:    string | null;
  total_chapters: number;
  order_index:    number;
  is_active:      boolean;
}

export interface ChapterResponse {
  id:             string;
  campaign_id:    string;
  chapter_number: number;
  title:          string;
  narrative_text: string | null;
  has_branch:     boolean;
  branch_a_label: string | null;
  branch_b_label: string | null;
}

export interface MissionTemplateResponse {
  id:                   string;
  name:                 string;
  type:                 string;
  description_template: string;
  base_target:          number;
  base_xp:              number;
  base_coins:           number;
  duration_days:        number;
}

export interface UserMissionResponse {
  id:                  string;
  mission_template_id: string;
  name:                string;
  type:                string;
  description:         string;
  adjusted_target:     number;
  current_progress:    number;
  status:              string;
  xp_reward:           number;
  coins_reward:        number;
  started_at:          string | null;
  expires_at:          string | null;
  completed_at:        string | null;
}

export interface AvailableMissionsResponse {
  active:    UserMissionResponse[];
  available: MissionTemplateResponse[];
}

// ─── API ────────────────────────────────────────────────────────
export const progressApi = {
  get: () =>
    api.get<ProgressResponse>('/api/progress'),

  patch: (data: {
    campaign_path?: 'A' | 'B';
    current_campaign_id?: string;
    current_chapter_id?: string;
  }) =>
    api.patch<ProgressResponse>('/api/progress', data),
};

export const campaignApi = {
  list: () =>
    api.get<CampaignResponse[]>('/api/campaigns'),

  chapters: (campaignId: string) =>
    api.get<ChapterResponse[]>(`/api/campaigns/${campaignId}/chapters`),
};

export const missionApi = {
  getAll: () =>
    api.get<AvailableMissionsResponse>('/api/missions'),

  accept: (templateId: string) =>
    api.post<UserMissionResponse>(`/api/missions/${templateId}/accept`),
};
