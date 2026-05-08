// mobile/store/restTimerStore.ts
/**
 * Global rest-timer state.
 *
 * Why global: the timer must keep counting down (and stay visible via the
 * floating overlay) when the user collapses an exercise card, scrolls past
 * the inline widget, dismisses the workout modal to glance at the profile,
 * etc. The previous local hook in WorkoutLogScreen got torn down whenever
 * that screen unmounted, killing the countdown.
 *
 * The actual "tick every second" interval is driven by useRestTimerInterval()
 * mounted at the app root — keeps a single source of truth and avoids
 * leaking timers if a screen mounts the store more than once.
 */
import { create } from 'zustand';
import * as Haptics from 'expo-haptics';

interface RestTimerState {
  enabled:   boolean;   // user preference: timer auto-starts on set complete
  duration:  number;    // configured rest duration, seconds
  remaining: number;    // ticks down each second while running
  running:   boolean;
  inWorkout: boolean;   // true while the workout-log modal is open — hides the floating overlay

  start:        () => void;
  skip:         () => void;
  tick:         () => void;
  setEnabled:   (v: boolean) => void;
  setDuration:  (v: number) => void;
  setInWorkout: (v: boolean) => void;
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  enabled:   true,
  duration:  90,
  remaining: 0,
  running:   false,
  inWorkout: false,

  start: () => {
    const s = get();
    if (!s.enabled) return;
    set({ remaining: s.duration, running: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },

  skip: () => {
    set({ remaining: 0, running: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },

  tick: () => {
    const s = get();
    if (!s.running) return;
    if (s.remaining <= 1) {
      set({ remaining: 0, running: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      set({ remaining: s.remaining - 1 });
    }
  },

  setEnabled: (v) => {
    set({ enabled: v });
    if (!v) {
      // Toggling off mid-countdown should reset, not freeze it
      set({ remaining: 0, running: false });
    }
  },

  setDuration:  (v) => set({ duration: Math.max(5, Math.min(600, v)) }),
  setInWorkout: (v) => set({ inWorkout: v }),
}));
