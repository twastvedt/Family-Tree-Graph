import { ref } from 'vue';
import settings from '../settings.json';
import { defineStore } from 'pinia';

export interface PersonOverride {
  angle?: number;
  birth?: number;
  death?: number;
}

export interface FamilyOverride {
  year?: number;
}

export interface Settings {
  dataPath?: string;
  data?: string;
  layout: {
    /**
     * Width of drawing in SVG units.
     */
    width: number;
    textSize: number;
    maxYear: number;
    /**
     * Size of lifeline gradient, in years, when date of death is uncertain.
     */
    fadeYears: number;
  };
  /**
   * Angle of each line of date labels.
   */
  dateLabels: number[];
  colors: {
    estimate: string;
    familyConnector: string;
    grid: string;
    gridText: string;
  };
  overrides: {
    people: Record<string, PersonOverride>;
    families: Record<string, FamilyOverride>;
  };
}

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const settingsTyped = ref<Settings>(structuredClone(settings));

    function reset(value?: Settings) {
      settingsTyped.value = value ?? structuredClone(settings);
      location.reload();
    }
    return { settings: settingsTyped, reset };
  },
  { persist: true },
);
