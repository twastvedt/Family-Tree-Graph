import * as d3 from 'd3';
import { Family } from './Family';
import { Person } from './Person';

export abstract class TreeNode {
  level?: number;
  complete?: boolean;
  element?: SVGElement;
  rotationChildren?: Iterable<TreeNode>;

  constructor(public handle: string) {}

  static estimateLifespan(
    birth: Date | undefined,
    death: Date | undefined = undefined,
  ): number | undefined {
    const interp = d3.scaleLinear().domain([1775, 2019]).range([38, 82]);

    if (birth !== undefined) {
      return interp(birth.getUTCFullYear());
    } else if (death !== undefined) {
      return interp.domain(
        interp.domain().map((d, i) => d + interp.range()[i]),
      )(death.getUTCFullYear());
    }
  }

  /**
   * Get all tree nodes that should be rotated if this node is rotated.
   * (All descendents of ancestors that are not descendents of this node.)
   * @param families Families to include, and from which to walk the tree.
   * @param nodes Nodes to include without walking their trees.
   */
  getRotationChildren(
    families: Iterable<[Family, Person]> = [],
    nodes: Iterable<TreeNode> = [this],
  ): Iterable<TreeNode> {
    const rotationChildren = new Set<TreeNode>(nodes);
    const familiesToDo = new Map<Family, Person>(families);

    for (const [family, sourcePerson] of familiesToDo) {
      rotationChildren.add(family);

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

    return rotationChildren;
  }

  abstract estimate(): void;
}
