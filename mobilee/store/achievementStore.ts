import { create } from 'zustand';
import { api } from '../services/api';

export interface Achievement {
  id:              string;
  name:            string;
  description:     string;
  icon_key:        string;
  condition_type:  string;
  condition_value: number;
  earned:          boolean;
  earned_at:       string | null;
}

interface AchievementState {
  achievements: Achievement[];
  isLoading:    boolean;
  fetchAchievements: () => Promise<void>;
}

export const useAchievementStore = create<AchievementState>((set) => ({
  achievements: [],
  isLoading:    false,

  fetchAchievements: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<Achievement[]>('/api/achievements');
      set({ achievements: data });
    } catch {
      // keep existing data on failure
    } finally {
      set({ isLoading: false });
    }
  },
}));
