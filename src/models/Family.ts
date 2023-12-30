import { Data } from './Data';
import { TreeNode } from './TreeNode';
import { Person } from './Person';

import { DateTime } from 'luxon';
import { mean } from 'd3';
import type { DateInfo } from './Tree';

export type DefinedFamily = Family & Required<Pick<Family, 'marriage'>>;

export class Family extends TreeNode {
  parents: Person[] = [];
  marriage?: DateInfo;
  children: Person[] = [];
  name = '';

  constructor(handle: string, data: Data, doSetup: boolean) {
    super(handle);

    //add family to list of all families
    data.tree.families[this.handle] = this;

    if (!doSetup) {
      console.log('Family Ref: ' + handle);
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

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const thisFamily = this;
      family.selectAll<HTMLElement, unknown>('eventref').each(function () {
        const e = data.xml.select(
          'event[handle=' + this.getAttribute('hlink') + ']',
        );

        if (!e.empty()) {
          switch (e.select('type').text()) {
            case 'Marriage':
              thisFamily.marriage = {
                date: new Date(e.select('dateval').attr('val')),
                isEstimate: false,
              };
              data.tree.addToDateRange(thisFamily.marriage);
              break;
            default:
              console.log('Unhandled event', e.select('type').text());
          }
        }
      });

      family.selectAll<HTMLElement, unknown>('childref').each(function () {
        const handle = this.getAttribute('hlink');

        if (!handle) {
          console.error(`No id (hlink): ${this.outerHTML}`);
          return;
        }

        if (data.tree.people[handle]) {
          thisFamily.children.push(data.tree.people[handle]);
        } else {
          thisFamily.children.push(new Person(handle, data));
        }
      });

      this.name =
        this.parents
          .map((p) => p.surnames.find((n) => n.derivation === 'Taken')?.name)
          .find((n) => n !== undefined) ?? 'Unknown';

      this.estimate();
    } else {
      throw new Error(`Empty family: ${this.handle}`);
    }
  }

  setRotationChildren(): void {
    const familiesToDo = new Map<Family, Person>([[this, this.children[0]]]);

    return super.setRotationChildren(familiesToDo);
  }

  estimate() {
    if (this.marriage?.isEstimate !== false) {
      console.log('Undefined marriage');

      // Don't have an exact date for this marriage - try to estimate.
      const childBirths = this.children
        .filter((p) => p.birth?.isEstimate === false)
        .map((p) => p.birth!);
      const earliestChild = childBirths.length
        ? childBirths.reduce((a, b) => (a < b ? a : b))
        : undefined;

      const earliestParent = mean(
        this.parents
          .filter((p) => p.birth?.isEstimate === false)
          .map((p) => p.birth!.date.getUTCMilliseconds()),
      );

      let marriageDate: Date | undefined;

      if (earliestChild) {
        console.log(' 5 years before earliest definite birth of child.');

        marriageDate = DateTime.fromJSDate(earliestChild.date)
          .minus({ years: 5 })
          .toJSDate();
      } else if (earliestParent) {
        console.log(' 25 years after average definite birth of parents.');

        marriageDate = DateTime.fromMillis(earliestParent)
          .plus({ years: 25 })
          .toJSDate();
      } else {
        console.log(
          ' Average of indefinite births of parents (+25) and children (-5).',
        );

        const dates: number[] = [];

        if (this.parents.some((p) => p.birth)) {
          dates.push(
            DateTime.fromMillis(
              this.parents
                .filter((p) => p.birth)
                .map((p) => p.birth!.date.getUTCMilliseconds())
                .reduce((a, b, i) => (a * i + b) / (i + 1)),
            )
              .plus({ years: 25 })
              .valueOf(),
          );
        }

        if (this.children.some((c) => c.birth)) {
          dates.push(
            DateTime.fromJSDate(
              this.children
                .filter((p) => p.birth)
                .map((c) => c.birth!.date)
                .reduce((a, b) => (a < b ? a : b)),
            )
              .minus({ years: 5 })
              .valueOf(),
          );
        }

        if (dates.length == 0) {
          throw new Error('No data with which to place this marriage date.');
        }

        marriageDate = new Date(dates.reduce((t, d) => t + d) / dates.length);
      }

      this.marriage = {
        date: marriageDate,
        isEstimate: true,
      };

      console.log(` Guessed marriage: ${this.marriage.date.toString()}`);
    }

    this.parents
      .filter(
        (p) => p.birth?.isEstimate !== false && p.death?.isEstimate !== false,
      )
      .forEach((p) => {
        p.birth = {
          date: DateTime.fromJSDate(this.marriage!.date)
            .minus({ years: 25 })
            .toJSDate(),
          isEstimate: true,
        };
        p.death = {
          date: DateTime.fromJSDate(p.birth.date)
            .plus({ years: TreeNode.estimateLifespan(p.birth.date) })
            .toJSDate(),
          isEstimate: true,
        };
      });

    this.children
      .filter(
        (c) => c.birth?.isEstimate !== false && c.death?.isEstimate !== false,
      )
      .forEach((c, i) => {
        c.birth = {
          date: DateTime.fromJSDate(this.marriage!.date)
            .plus({ years: 2 + i * 2 })
            .toJSDate(),
          isEstimate: true,
        };
        c.death = {
          date: DateTime.fromJSDate(c.birth.date)
            .plus({ years: TreeNode.estimateLifespan(c.birth.date) })
            .toJSDate(),
          isEstimate: true,
        };
      });
  }
}
