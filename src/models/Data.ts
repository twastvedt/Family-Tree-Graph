import { Person } from './Person';
import { Family } from './Family';
import { SortRelation } from './SortItem';
import { select } from 'd3';
import { Tree } from './Tree';
import { useSettingsStore, type Settings } from '@/stores/settingsStore';
import { toRef, type Ref } from 'vue';

interface FamilyData {
  level: number;
  sourcePerson?: Person;
}

export class Data {
  tree = new Tree();

  //this map holds a list of families that need to be parsed (key) along with their data: [level, [sorting data]]
  private familiesToDo = new Map<string, FamilyData>();

  xml: d3.Selection<XMLDocument, unknown, null, undefined>;
  settings: Ref<Settings>;

  constructor(xmlDoc: Document) {
    const settingsStore = useSettingsStore();
    this.settings = toRef(settingsStore.settings);

    this.xml = select(xmlDoc);

    this.parseData();
  }

  private parseData(): void {
    const rootFamilyHandle = this.xml
      .select('family#' + this.settings.value.rootFamilyId)
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
        `familyWidth: ${familyWidth}, family angle: ${familyCenter}, sourcePerson.angle: ${sourcePerson?.angle}, sourcePerson: ${sourcePerson?.firstName}`,
      );

      this.familiesToDo.delete(familyId);

      //store data for each parent of family
      family.parents
        .filter((p) => p !== sourcePerson)
        .forEach((parent, i) => {
          parent.angle = familyCenter + (i - 0.5) * familyWidth;

          parent.parentOrder = i;

          this.addParentSorting(family, parent, level);
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

          child.angle =
            familyCenter -
            familyWidth / 2 +
            (familyWidth / (family.children.length + 1)) * (i + 1);

          //add child's family to list to do if it hasn't already been processed
          if (child.parentIn && !this.tree.families[child.parentIn.handle]) {
            this.familiesToDo.set(child.parentIn.handle, {
              level: level - 1,
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

    // Set overrides
    for (const [handle, override] of Object.entries(
      this.settings.value.overrides.people,
    )) {
      const person = this.tree.people[handle];
      if (person) {
        if (override.angle != undefined) {
          person.angle = override.angle;
        }
        if (override.birth != undefined) {
          person.birth = {
            date: new Date(override.birth, 0, 1),
            isOverridden: true,
            isEstimate: true,
          };
        }
        if (override.death != undefined) {
          person.death = {
            date: new Date(override.death, 0, 1),
            isOverridden: true,
            isEstimate: true,
          };
        }
        continue;
      }

      console.warn(`Override for unknown person: ${handle}.`);
    }

    for (const node of Object.entries(this.settings.value.overrides.families)) {
      const family = this.tree.families[node[0]];
      if (family) {
        if (node[1].year != undefined) {
          family.marriage = {
            date: new Date(node[1].year, 0, 1),
            isOverridden: true,
            isEstimate: true,
          };
        }
        continue;
      }

      console.warn(`Override for unknown family: ${node[0]}.`);
    }

    // Compile list of all nodes, ordered by proximity to nodes with known dates.

    const nodes = this.tree.nodeList;
    nodes.push(
      ...Object.values(this.tree.people).filter(
        (p) => p.birth?.isEstimate === false || p.death?.isEstimate === false,
      ),
    );
    nodes.push(
      ...Object.values(this.tree.families).filter(
        (f) => f.marriage?.isEstimate === false,
      ),
    );

    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];

      if (node instanceof Person) {
        if (
          node.childOf &&
          !nodes.some((n) => n.handle === node.childOf!.handle)
        ) {
          nodes.push(node.childOf);
        }

        if (
          node.parentIn &&
          !nodes.some((n) => n.handle === node.parentIn!.handle)
        ) {
          nodes.push(node.parentIn);
        }
      } else if (node instanceof Family) {
        nodes.push(
          ...node.children
            .concat(...node.parents)
            .filter((c) => !nodes.some((n) => n.handle === c.handle)),
        );
      }

      i++;
    }

    this.tree.estimate();

    this.tree.updateScale();
  }

  //Add sorting info to a parent and the tree
  addParentSorting(family: Family, parent: Person, level: number): void {
    if (!parent.complete) {
      //parent not already processed

      //create object for parent and add to list of people

      parent.setup(this);
    }

    //add parent's family to list to do if it hasn't already been processed
    if (
      parent.childOf &&
      !this.tree.families[parent.childOf.handle]?.complete
    ) {
      this.familiesToDo.set(parent.childOf.handle, {
        level: level + 1,
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
