// mobile/services/gamificationApi.ts
import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────
export interface AchievementItem {
  id:        string;
  name:      string;
  icon_key:  string;
  earned:    boolean;
  earned_at: string | null;
}

export interface ProgressResponse {
  user_id:                  string;
  xp:                       number;
  level:                    number;
  coins:                    number;
  current_streak:           number;
  longest_streak:           number;
  streak_freezes:           number;
  nutrition_buff_date:      string | null;  // ISO date when the +5% XP buff applies
  current_campaign_id:      string | null;
  current_chapter_id:       string | null;
  campaign_path:            string | null;
  last_workout_at:          string | null;
  updated_at:               string | null;
  total_sessions:             number;
  total_workouts:             number;
  missions_completed_count:   number;
  campaign_started_workouts:  number;
  campaign_started_missions:  number;
  avatar_stage:             number;
  avatar_stage_name:        string;
  achievements:             AchievementItem[];
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
  reward_xp:      number;
  reward_coins:   number;
}

export interface ChapterRequirement {
  label:   string;
  current: number;
  target:  number;
  met:     boolean;
}

export interface CampaignCurrentResponse {
  campaign:        CampaignResponse;
  current_chapter: ChapterResponse | null;
  chapters:        ChapterWithStatus[];
  campaign_path:   string | null;
  requirements:    ChapterRequirement[];
}

export interface ChapterWithStatus {
  id:             string;
  chapter_number: number;
  title:          string;
  status:         'completed' | 'active' | 'locked';
  has_branch:     boolean;
  narrative_text: string | null;
  branch_a_label: string | null;
  branch_b_label: string | null;
  reward_xp:      number;
  reward_coins:   number;
}

export interface MissionTemplateResponse {
  id:                   string;
  name:                 string;
  type:                 string;
  description_template: string;
  base_target:          number;
  preview_target:       number;  // experience-scaled at level 1, set by server
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
  completed: UserMissionResponse[];
  expired:   UserMissionResponse[];   // recently expired (last 7 days), shown as a banner until dismissed
  available: MissionTemplateResponse[];
  trend:     MlTrend | null;          // current ML-driven ordering — null if cold start
  reroll_available: boolean;
  reroll_cost:      number;           // coin cost to reroll an active mission
  next_reroll_at:   string | null;    // ISO timestamp when next reroll unlocks (null if available now)
}

// ─── ML / Coach types ───────────────────────────────────────────
export type MlTrend = 'improving' | 'plateau' | 'declining';
export type CoachTone = 'motivating' | 'neutral' | 'warning';

export interface MlStatusResponse {
  available:         boolean;
  trend?:            MlTrend;
  confidence?:       number;
  prediction_date?:  string;
  top_feature?:      string;
  features?:         Record<string, number>;
  shap_values?:      Record<string, number>;
  cold_start_reason?: string;
}

export interface CoachMessageResponse {
  id:           string;
  message_text: string;
  tone:         CoachTone;
  trend:        MlTrend | null;
  is_read:      boolean;
  created_at:   string;
}

// ─── API ────────────────────────────────────────────────────────
// Keep these in sync with backend constants in api/progress.py
export const STREAK_FREEZE_COST_COINS = 50;
export const STREAK_FREEZE_MAX_OWNED  = 2;

export const progressApi = {
  get: () =>
    api.get<ProgressResponse>('/api/progress'),

  patch: (data: {
    campaign_path?: 'A' | 'B';
    current_campaign_id?: string;
    current_chapter_id?: string;
  }) =>
    api.patch<ProgressResponse>('/api/progress', data),

  buyStreakFreeze: () =>
    api.post<ProgressResponse>('/api/progress/buy-streak-freeze'),
};

export const campaignApi = {
  list: () =>
    api.get<CampaignResponse[]>('/api/campaigns'),

  current: () =>
    api.get<CampaignCurrentResponse>('/api/campaigns/current'),

  chapters: (campaignId: string) =>
    api.get<ChapterResponse[]>(`/api/campaigns/${campaignId}/chapters`),
};

export const missionApi = {
  getAll: () =>
    api.get<AvailableMissionsResponse>('/api/missions'),

  accept: (templateId: string) =>
    api.post<UserMissionResponse>(`/api/missions/${templateId}/accept`),

  reroll: (userMissionId: string) =>
    api.post<UserMissionResponse>(`/api/missions/${userMissionId}/reroll`),
};

export const coachApi = {
  getMessages: (limit = 20) =>
    api.get<CoachMessageResponse[]>(`/api/coach?limit=${limit}`),

  markRead: (id: string) =>
    api.patch(`/api/coach/${id}/read`),
};

export const mlApi = {
  status: () =>
    api.get<MlStatusResponse>('/api/progress/ml-status'),
};
