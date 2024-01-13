import { scaleTime } from 'd3';
import type { Family } from './Family';
import type { Person } from './Person';
import type { SortRelation } from './SortItem';
import type { TreeNode } from './TreeNode';
import { useSettingsStore, type Settings } from '@/stores/settingsStore';
import { toRef, type Ref } from 'vue';

export interface Link {
  source: TreeNode;
  target: TreeNode;
  type: SortRelation;
}

export interface DateInfo {
  date: Date;
  isEstimate?: boolean;
  isOverridden?: boolean;
}

export function estimable(info?: DateInfo) {
  return !info || (info.isEstimate && !info.isOverridden);
}

export class Tree {
  people: { [handle: string]: Person } = {};
  families: { [handle: string]: Family } = {};
  links: Link[] = [];
  dateRange: Date[] = [];
  nodeList: TreeNode[] = [];
  timeScale = scaleTime();
  settings: Ref<Settings>;

  constructor() {
    const settingsStore = useSettingsStore();
    this.settings = toRef(settingsStore.settings);
  }

  addToDateRange(d: DateInfo): void {
    if (this.dateRange[0]) {
      this.dateRange[0] = new Date(
        Math.min(this.dateRange[0].getTime(), d.date.getTime()),
      );
    } else {
      this.dateRange[0] = d.date;
    }

    if (this.dateRange[1]) {
      this.dateRange[1] = new Date(
        Math.max(this.dateRange[1].getTime(), d.date.getTime()),
      );
    } else {
      this.dateRange[1] = d.date;
    }
  }

  estimate() {
    this.nodeList.forEach((n) => n.estimate());
  }

  clearEstimates() {
    this.nodeList.forEach((n) => n.clearEstimates());
  }

  updateScale() {
    this.timeScale
      .domain([
        this.dateRange[0],
        new Date(this.settings.value.layout.maxYear, 0),
      ])
      .range([this.settings.value.layout.width / 2, 0]);
  }

  scale(date: Date) {
    return this.timeScale(new Date(date.getFullYear(), 0, 1));
  }
}
