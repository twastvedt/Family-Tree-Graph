﻿import { Family } from './Family';
import { Person } from './Person';

export abstract class TreeNode {
  level?: number;
  complete = false;
  rotationChildren: Iterable<Person> = [];

  constructor(public handle: string) {}

  /**
   * Get all tree nodes that should be rotated if this node is rotated.
   * (All descendants of ancestors that are not descendants of this node.)
   * @param families Families to include, and from which to walk the tree.
   * @param nodes Nodes to include without walking their trees.
   */
  setRotationChildren(
    families: Iterable<[Family, Person]> = [],
    nodes?: Iterable<Person>,
  ): void {
    const rotationChildren = new Set<Person>(nodes);
    if (!nodes && this instanceof Person) {
      rotationChildren.add(this);
    }
    const familiesToDo = new Map<Family, Person>(families);

    for (const [family, sourcePerson] of familiesToDo) {
      family.parents
        .filter((p) => p !== sourcePerson)
        .forEach((parent) => {
          rotationChildren.add(parent);

          if (parent.childOf && !familiesToDo.has(parent.childOf)) {
            familiesToDo.set(parent.childOf, parent);
          }
        });

      family.children
        .filter((p) => p !== sourcePerson)
        .forEach((child) => {
          rotationChildren.add(child);

          if (child.parentIn && !familiesToDo.has(child.parentIn)) {
            familiesToDo.set(child.parentIn, child);
          }
        });
    }

    this.rotationChildren = rotationChildren;
  }

  abstract estimate(): void;
  abstract clearEstimates(): void;
}
