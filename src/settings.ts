import settings from './settings.json';

interface Settings {
  rootFamilyId: string;
  dataPath: string;
  layout: {
    ringSpacing: number;
    width: number;
    textSize: number;
    maxYear: number;
    /**
     * Size of lifeline gradient, in years, when date of death is uncertain.
     */
    fadeYears: number;
  };
}

const settingsTyped: Settings = settings;
export default settingsTyped;
