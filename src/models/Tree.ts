import { scaleTime, type BaseType, type Selection } from 'd3';
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

export function getDateInfo(
  node: Selection<BaseType, unknown, BaseType, unknown>,
): DateInfo | undefined {
  const dateNode = node.select('dateval');
  const dateText = !dateNode.empty() && dateNode.attr('val');

  if (dateText) {
    const date = new Date(dateText);

    if (!isNaN(date.getTime())) {
      return {
        date,
        isEstimate: false,
      };
    }

    console.warn(`Unable to parse date: "${dateText}`);
  }
}

export function estimable(info?: DateInfo) {
  return !info || (info.isEstimate && !info.isOverridden);
}

export class Tree {
  people: { [handle: string]: Person } = {};
  families: { [handle: string]: Family } = {};
  links: Link[] = [];
  levels: Person[][] = [];
  maxLevel = 0;
  dateRange: Date[] = [];
  nodeList: TreeNode[] = [];
  timeScale = scaleTime();
  settings: Ref<Settings>;
  settingsStore = useSettingsStore();

  constructor() {
    this.settings = toRef(this.settingsStore.settings);
  }

  //Add a person to a level of the graph
  addToLevel(person: Person, level: number): void {
    //make sure the list for this level exists before adding a person to it
    if (typeof this.levels[level] === 'undefined') {
      this.levels[level] = [];
    }

    if (person.level && person.level !== level) {
      this.levels[level].splice(this.levels[level].indexOf(person));
    }

    this.levels[level].push(person);
    person.level = level;
  }

  walkFamilies(
    rootHandle: string,
    func: (family: Family, sourcePerson?: Person) => void,
  ) {
    const familiesToDo = new Map<string, Person | undefined>();
    const familiesDone = new Set<string>();
    familiesToDo.set(rootHandle, undefined);

    while (familiesToDo.size) {
      const familyId = familiesToDo.keys().next().value;
      const family = this.families[familyId];

      if (!family) {
        throw new Error(`Could not find family ${familyId}.`);
      }

      const sourcePerson = familiesToDo.get(familyId);

      func(family, sourcePerson);
      familiesToDo.delete(familyId);
      familiesDone.add(familyId);

      family.parents.forEach((p) => {
        if (p.childOf && !familiesDone.has(p.childOf.handle)) {
          familiesToDo.set(p.childOf.handle, p);
        }
      });

      family.children.forEach((c) => {
        if (c.parentIn && !familiesDone.has(c.parentIn.handle)) {
          familiesToDo.set(c.parentIn.handle, c);
        }
      });
    }
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
    const years =
      this.settingsStore.maxYear - this.dateRange[0].getUTCFullYear();

    this.timeScale
      .domain([this.dateRange[0], this.settingsStore.maxDate])
      .range([(years * this.settings.value.layout.unitsPerYear) / 2, 0]);
  }

  scale(date: Date) {
    return this.timeScale(new Date(date.getUTCFullYear(), 0, 1));
  }
}
