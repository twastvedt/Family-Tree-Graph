import { scaleTime } from 'd3';
import type { Family } from './Family';
import type { Person } from './Person';
import type { SortRelation } from './SortItem';
import type { TreeNode } from './TreeNode';

enum LinkSource {
  Family,
}

export interface Link {
  source: TreeNode;
  target: TreeNode;
  type: SortRelation;
}

export class Tree {
  people: { [handle: string]: Person } = {};
  families: { [handle: string]: Family } = {};
  links: Link[] = [];
  levels: Person[][] = [];
  maxLevel = 0;
  dateRange: Date[] = [];
  levelAvg: Date[] = [];
  nodeList: TreeNode[] = [];
  scale = scaleTime();

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

  addToDateRange(d: Date): void {
    if (this.dateRange[0]) {
      this.dateRange[0] = new Date(
        Math.min(this.dateRange[0].getTime(), d.getTime()),
      );
    } else {
      this.dateRange[0] = d;
    }

    if (this.dateRange[1]) {
      this.dateRange[1] = new Date(
        Math.max(this.dateRange[1].getTime(), d.getTime()),
      );
    } else {
      this.dateRange[1] = d;
    }
  }
}
