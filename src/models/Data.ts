import settings from '../settings';

import { Person } from './Person';
import { Family } from './Family';
import { SortRelation } from './SortItem';
import { mean, select } from 'd3';
import { Tree } from './Tree';
import type { TreeNode } from './TreeNode';

interface FamilyData {
  level: number;
  sourcePerson?: Person;
}

export class Data {
  tree = new Tree();

  //this map holds a list of families that need to be parsed (key) along with their data: [level, [sorting data]]
  private familiesToDo = new Map<string, FamilyData>();

  xml: d3.Selection<XMLDocument, unknown, null, undefined>;

  constructor(xmlDoc: Document) {
    this.xml = select(xmlDoc);

    this.parseData();
  }

  private parseData(): void {
    const rootFamilyHandle = this.xml
      .select('family#' + settings.rootFamilyId)
      .attr('handle');

    this.familiesToDo.set(rootFamilyHandle, { level: 1 });

    while (this.familiesToDo.size) {
      const familyId = this.familiesToDo.keys().next().value;
      let family: Family;

      //check whether family is already in the tree?
      if (this.tree.families[familyId]) {
        if (this.tree.families[familyId].complete) {
          this.familiesToDo.delete(familyId);
          continue;
        } else {
          family = this.tree.families[familyId];
          family.setup(this);
        }
      } else {
        family = new Family(familyId, this, true);
      }

      const familyData = this.familiesToDo.get(familyId);

      if (!familyData) {
        throw new Error('Missing family');
      }

      const level = familyData.level;
      const sourcePerson = familyData.sourcePerson;

      const familyWidth = 360 / 2 ** level;
      let familyCenter = 180;

      if (sourcePerson) {
        let sourceIndex = family.parents.findIndex(
          (p) => p.handle === sourcePerson.handle,
        );

        if (sourceIndex !== -1) {
          familyCenter =
            sourcePerson.angle +
            ((sourceIndex == 1 ? -1 : 1) * familyWidth) / 2;
        } else {
          sourceIndex = family.children.findIndex(
            (p) => p.handle === sourcePerson.handle,
          );

          if (sourceIndex !== -1) {
            familyCenter =
              sourcePerson.angle -
              ((sourceIndex + 1) / (family.children.length + 1)) * familyWidth +
              familyWidth / 2;
          } else {
            throw new Error("Can't find source person in new family!");
          }
        }
      }

      console.log(
        `familyWidth: ${familyWidth}, family angle: ${familyCenter}, level: ${level}, sourcePerson.angle: ${sourcePerson?.angle}, sourcePerson: ${sourcePerson?.firstName}`,
      );

      family.level = level;

      //keep track of how many levels this.data contains, for scaling and graph lines
      this.tree.maxLevel = Math.max(this.tree.maxLevel, level);

      this.familiesToDo.delete(familyId);

      //store data for each parent of family
      family.parents
        .filter((p) => p !== sourcePerson)
        .forEach((parent, i) => {
          parent.angle = familyCenter + (i - 0.5) * familyWidth;

          parent.parentOrder = i;

          this.addParentSorting(family, parent);
        });

      // Store data for each child of family.
      family.children
        .filter((p) => p !== sourcePerson)
        .forEach((child, i) => {
          console.log('child ', i + 1, ' of ', family.children.length);

          if (!child.complete) {
            //setup child object and add to list of people
            child.setup(this);
          }

          if (!child.level) {
            this.tree.addToLevel(child, level - 1);
          }

          child.angle =
            familyCenter -
            familyWidth / 2 +
            (familyWidth / (family.children.length + 1)) * (i + 1);

          //add child's family to list to do if it hasn't already been processed
          if (child.parentIn && !this.tree.families[child.parentIn.handle]) {
            this.familiesToDo.set(child.parentIn.handle, {
              level: child.level!,
              // Offset to center of child's family.
              sourcePerson: child,
            });
          }

          //add links from family to children
          this.tree.links.push({
            source: family,
            target: child,
            type: SortRelation.Child,
          });
        });

      console.log('families left: ', this.familiesToDo.size);
    }

    for (let i = 0; i < this.tree.levels.length; i++) {
      //for people without dates, define a default (average) level date
      this.tree.levelAvg[i] = new Date(
        mean(this.tree.levels[i], (el) => el.birth?.valueOf()) ?? 0,
      );
    }

    // Combine people and families to make list of all nodes
    this.tree.nodeList = (<TreeNode[]>Object.values(this.tree.people)).concat(
      <TreeNode[]>Object.values(this.tree.families),
    );

    // this.tree.nodeList.forEach((n) => n.estimate());

    this.tree.scale
      .domain(this.tree.dateRange)
      .range([settings.layout.width / 2, 0]);
  }

  //Add sorting info to a parent and the tree
  addParentSorting(family: Family, parent: Person): void {
    if (!parent.complete) {
      //parent not already processed

      //create object for parent and add to list of people

      parent.setup(this);
    }
    if (!parent.level && family.level != undefined) {
      this.tree.addToLevel(parent, family.level);
    }

    //add parent's family to list to do if it hasn't already been processed
    if (
      parent.childOf &&
      !this.tree.families[parent.childOf.handle]?.complete
    ) {
      if (parent.level == undefined) {
        throw new Error('No parent level');
      }
      this.familiesToDo.set(parent.childOf.handle, {
        level: parent.level + 1,
        sourcePerson: parent,
      });
    }

    //add link from father to family
    this.tree.links.push({
      source: parent,
      target: family,
      type: SortRelation.Parent,
    });
  }
}
