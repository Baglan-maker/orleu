// mobile/store/unitsStore.ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEY_UNITS = 'pref_units';
export const LB_PER_KG = 2.20462;

interface UnitsState {
  useKg: boolean;
  init: () => Promise<void>;
  setUseKg: (v: boolean) => void;
}

export const useUnitsStore = create<UnitsState>((set) => ({
  useKg: true,

  init: async () => {
    const saved = await SecureStore.getItemAsync(KEY_UNITS).catch(() => null);
    if (saved !== null) {
      set({ useKg: saved !== 'lb' });
    }
  },

  setUseKg: (v: boolean) => {
    set({ useKg: v });
    SecureStore.setItemAsync(KEY_UNITS, v ? 'kg' : 'lb').catch(() => {});
  },
}));

// Convert a kg value for display in the current unit
export function kgToDisplay(kg: number, useKg: boolean): number {
  return useKg ? kg : Math.round(kg * LB_PER_KG * 10) / 10;
}

// Convert a display value back to kg for storage
export function displayToKg(val: number, useKg: boolean): number {
  return useKg ? val : val / LB_PER_KG;
}
