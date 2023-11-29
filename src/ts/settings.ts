import settings from './settings.json';

interface Settings {
  rootFamilyId: string;
  dataPath: string;
  layout: {
    ringSpacing: number;
    width: number;
    textSize: number;
  };
}

const settingsTyped: Settings = settings;
export default settingsTyped;
