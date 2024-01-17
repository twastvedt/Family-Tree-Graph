import { computed, ref } from 'vue';
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
     * Year in SVG units.
     */
    unitsPerYear: number;
    textSize: number;
    /**
     * Date value of center of graph. If unset, the current year.
     */
    maxYear?: number;
    /**
     * Minimum arc length of a family.
     */
    minFamilyWidth?: number;
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

    const maxYear = computed(
      () => settingsTyped.value.layout.maxYear ?? new Date().getFullYear(),
    );

    const maxDate = computed(() => new Date(maxYear.value, 0));

    return { settings: settingsTyped, maxDate, maxYear, reset };
  },
  { persist: true },
);
