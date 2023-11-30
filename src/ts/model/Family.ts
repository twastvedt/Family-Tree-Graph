import Pt from './Pt';
import { Data } from '../Data';
import { TreeNode } from './TreeNode';
import { Person } from './Person';

import { DateTime } from 'luxon';

export class Family extends TreeNode {
  parents: Person[] = [];
  marriage: Date;
  marriageIsEstimate: boolean;
  children: Person[] = [];
  name: string;

  constructor(handle: string, data: Data, doSetup: boolean) {
    super(handle);

    //add family to list of all families
    data.tree.families[this.handle] = this;

    if (!doSetup) {
      console.log('Family Ref: ' + handle);
      this.complete = false;

      return;
    } else {
      console.log('Family: ' + handle);
      this.setup(data);
    }
  }

  setup(data: Data): void {
    this.complete = true;

    const family = data.xml.select('[handle=' + this.handle + ']');

    if (!family.empty()) {
      if (!family.select('father').empty()) {
        this.parents.push(
          new Person(family.select('father').attr('hlink'), data),
        );
      }
      if (!family.select('mother').empty()) {
        this.parents.push(
          new Person(family.select('mother').attr('hlink'), data),
        );
      }

      this.marriageIsEstimate = true;

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const thisFamily = this;
      family.selectAll<HTMLElement, unknown>('eventref').each(function () {
        const e = data.xml.select(
          'event[handle=' + this.getAttribute('hlink') + ']',
        );

        if (!e.empty()) {
          switch (e.select('type').text()) {
            case 'Marriage':
              thisFamily.marriage = new Date(e.select('dateval').attr('val'));
              thisFamily.marriageIsEstimate = false;
              data.tree.addToDateRange(thisFamily.marriage);
              break;
            default:
              console.log('Unhandled event', e.select('type').text());
          }
        }
      });

      family.selectAll<HTMLElement, unknown>('childref').each(function () {
        const handle = this.getAttribute('hlink');

        if (data.tree.people[handle]) {
          thisFamily.children.push(data.tree.people[handle]);
        } else {
          thisFamily.children.push(new Person(handle, data));
        }
      });

      this.name = this.parents
        .map((p) => p.surnames.find((n) => n.derivation === 'Taken')?.name)
        .find((n) => n !== undefined);

      if (this.marriageIsEstimate) {
        console.log('Undefined marriage');

        // Don't have an exact date for this marriage - try to estimate.

        if (this.children.some((c) => !c.birthIsEstimate)) {
          console.log(' 2 years before earliest definite birth of child.');

          this.marriage = DateTime.fromJSDate(
            this.children
              .filter((p) => !p.birthIsEstimate)
              .map((p) => p.birth)
              .reduce((a, b) => (a < b ? a : b)),
          )
            .minus({ years: 2 })
            .toJSDate();
        } else if (this.parents.some((c) => !c.birthIsEstimate)) {
          console.log(' 25 years after average definite birth of parents.');

          this.marriage = DateTime.fromMillis(
            this.parents
              .filter((p) => !p.birthIsEstimate)
              .map((p) => p.birth.getUTCMilliseconds())
              .reduce((a, b, i) => (a * i + b) / (i + 1)),
          )
            .plus({ years: 25 })
            .toJSDate();
        } else {
          console.log(
            ' Average of indefinite births of parents (+25) and children (-2).',
          );

          const dates: number[] = [];

          if (this.parents.some((p) => p.birth !== undefined)) {
            dates.push(
              DateTime.fromMillis(
                this.parents
                  .filter((p) => p.birth !== undefined)
                  .map((p) => p.birth.getUTCMilliseconds())
                  .reduce((a, b, i) => (a * i + b) / (i + 1)),
              )
                .plus({ years: 25 })
                .valueOf(),
            );
          }

          if (this.children.some((c) => c.birth !== undefined)) {
            dates.push(
              DateTime.fromJSDate(
                this.children
                  .map((c) => c.birth)
                  .reduce((a, b) => (a < b ? a : b)),
              )
                .minus({ years: 2 })
                .valueOf(),
            );
          }

          if (dates.length == 0) {
            throw new Error('No data with which to place this marriage date.');
          }

          this.marriage = new Date(
            dates.reduce((t, d) => t + d) / dates.length,
          );
        }

        console.log(` Guessed marriage: ${this.marriage.toString()}`);
      }

      this.parents
        .filter((p) => p.birthIsEstimate && p.deathIsEstimate)
        .forEach((p) => {
          p.birth = DateTime.fromJSDate(this.marriage)
            .minus({ years: 25 })
            .toJSDate();
          p.death = DateTime.fromJSDate(p.birth)
            .plus({ years: TreeNode.estimateLifespan(p.birth) })
            .toJSDate();
        });

      this.children
        .filter((c) => c.birthIsEstimate && c.deathIsEstimate)
        .forEach((c, i) => {
          c.birth = DateTime.fromJSDate(this.marriage)
            .plus({ years: 2 + i * 2 })
            .toJSDate();
          c.death = DateTime.fromJSDate(c.birth)
            .plus({ years: TreeNode.estimateLifespan(c.birth) })
            .toJSDate();
        });
    } else {
      console.log('Empty family:', this.handle);
    }
  }

  // path generator for arcs
  arc(scale: d3.ScaleTime<number, number>): string {
    let start: number, end: number;

    //keep text upright
    if (this.angle % 360 > 180) {
      start = this.parents[0].angle;
      end = this.parents[1].angle;
    } else {
      start = this.parents[1].angle;
      end = this.parents[0].angle;
    }

    let dTheta = end - start;

    dTheta += dTheta > 180 ? -360 : dTheta < -180 ? 360 : 0;

    const largeArc = Math.abs(dTheta) > 180 ? 1 : 0,
      sweep = dTheta > 0 ? 1 : 0,
      r = scale(this.marriage);

    return (
      'M' +
      new Pt(r, (start * Math.PI) / 180).fromPolar().toString() +
      'A' +
      r +
      ',' +
      r +
      ' 0 ' +
      largeArc +
      ',' +
      sweep +
      ' ' +
      new Pt(r, (end * Math.PI) / 180).fromPolar().toString()
    );
  }

  getRotationChildren(): Iterable<TreeNode> {
    const familiesToDo = new Map<Family, Person>();
    const rotationChildren = new Set<TreeNode>([this]);

    for (const parent of this.parents) {
      if (parent.childOf) {
        familiesToDo.set(parent.childOf, parent);
      } else {
        rotationChildren.add(parent);
      }
    }

    return super.getRotationChildren(familiesToDo, rotationChildren);
  }
}
