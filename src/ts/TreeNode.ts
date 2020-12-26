import Pt from './Pt';
import settings from './settings';

import { Data, Tree } from './Data';
import * as d3 from 'd3';

import moment from 'moment';

export enum Gender {
  Male,
  Female,
}

export class TreeNode {
  angle: number;
  level: number;
  complete: boolean;

  constructor(public handle: string) {}

  static estimateLifespan(birth: Date, death: Date = undefined) {
    const interp = d3.scaleLinear().domain([1775, 2019]).range([38, 82]);

    if (birth !== undefined) {
      return interp(birth.getUTCFullYear());
    } else if (death !== undefined) {
      return interp.domain(
        interp.domain().map((d, i) => d + interp.range()[i])
      )(death.getUTCFullYear());
    }
  }
}

export class Name {
  constructor(public name: string, public derivation: string) {}
}

export class Person extends TreeNode {
  gender: Gender;
  parentIn: Family;
  childOf: Family;

  parentOrder: number;

  birth: Date;
  birthIsEstimate: boolean;
  death: Date;
  deathIsEstimate: boolean;

  firstName: string;
  surnames: Name[];

  constructor(handle: string, data: Data) {
    //Get all data from the xml related to one person

    super(handle);

    if (!data.tree.people[this.handle]) {
      //add person to list of all people
      data.tree.people[this.handle] = this;
    } else if (this !== data.tree.people[this.handle]) {
      console.log('Trying to add the same person twice!');
      return;
    }

    //If called without the xml data, this is just being stored as a reference. We'll set up the person later.
    if (data.xml === null) {
      console.log('Person Ref: ' + handle);
      this.complete = false;

      return;
    } else {
      console.log('Person: ' + handle);
      this.setup(data);
    }
  }

  setup(data: Data): void {
    this.complete = true;

    const person = data.xml.select<HTMLElement>(
      'person[handle=' + this.handle + ']'
    );

    if (!person.empty()) {
      this.gender =
        person.select<HTMLElement>('gender').text() == 'M'
          ? Gender.Male
          : Gender.Female;

      if (!person.select('parentin').empty()) {
        const familyHandle = person.select('parentin').attr('hlink');

        if (!(this.parentIn = data.tree.families[familyHandle])) {
          this.parentIn = new Family(familyHandle, data, false);
        }
      }

      if (!person.select('childof').empty()) {
        const familyHandle = person.select('childof').attr('hlink');

        if (!(this.childOf = data.tree.families[familyHandle])) {
          this.childOf = new Family(familyHandle, data, false);
        }
      }

      this.deathIsEstimate = true;
      this.birthIsEstimate = true;

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const thisPerson = this;
      person.selectAll<HTMLElement, unknown>('eventref').each(function () {
        const e = data.xml.select(
          'event[handle=' + this.getAttribute('hlink') + ']'
        );

        if (!e.empty()) {
          switch (e.select('type').text()) {
            case 'Birth':
              thisPerson.birth = new Date(e.select('dateval').attr('val'));
              thisPerson.birthIsEstimate = false;
              data.tree.addToDateRange(thisPerson.birth);
              break;
            case 'Death':
              thisPerson.death = new Date(e.select('dateval').attr('val'));
              thisPerson.deathIsEstimate = false;
              data.tree.addToDateRange(thisPerson.death);
              break;
            default:
              console.log('Unhandled Person event:', e.select('type').text());
          }
        }
      });

      if (!this.birthIsEstimate && this.deathIsEstimate) {
        if (
          moment().diff(this.birth, 'year')
          > TreeNode.estimateLifespan(undefined, new Date()) * 1.5
        ) {
          // Unlikely this person is still living.
          this.death = moment(this.birth)
            .add(TreeNode.estimateLifespan(this.birth))
            .toDate();
        } else {
          data.tree.dateRange[1] = new Date();
        }
      } else if (this.birthIsEstimate && !this.deathIsEstimate) {
        this.birth = moment(this.death)
          .subtract(TreeNode.estimateLifespan(undefined, this.death))
          .toDate();
      }

      this.firstName = person
        .select('name')
        .select<HTMLElement>('first')
        .node().innerHTML;

      this.surnames = [];
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const that = this;

      person
        .select('name')
        .selectAll<HTMLElement, unknown>('surname')
        .each(function () {
          that.surnames.push(
            new Name(this.innerHTML, this.getAttribute('derivation'))
          );
        });

      console.log('  ', this.firstName);
    } else {
      console.log('Empty Person handle:', this.handle);
    }
  }
}

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
          new Person(family.select('father').attr('hlink'), data)
        );
      }
      if (!family.select('mother').empty()) {
        this.parents.push(
          new Person(family.select('mother').attr('hlink'), data)
        );
      }

      this.marriageIsEstimate = true;

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const thisFamily = this;
      family.selectAll<HTMLElement, unknown>('eventref').each(function () {
        const e = data.xml.select(
          'event[handle=' + this.getAttribute('hlink') + ']'
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

          this.marriage = moment(
            this.children
              .filter((p) => !p.birthIsEstimate)
              .map((p) => p.birth)
              .reduce((a, b) => (a < b ? a : b))
          )
            .subtract(2, 'year')
            .toDate();
        } else if (this.parents.some((c) => !c.birthIsEstimate)) {
          console.log(' 25 years after average definite birth of parents.');

          this.marriage = moment(
            this.parents
              .filter((p) => !p.birthIsEstimate)
              .map((p) => p.birth.getUTCMilliseconds())
              .reduce((a, b, i) => (a * i + b) / (i + 1))
          )
            .add(25, 'year')
            .toDate();
        } else {
          console.log(
            ' Average of indefinite births of parents (+25) and children (-2).'
          );

          const dates: number[] = [];

          if (this.parents.some((p) => p.birth !== undefined)) {
            dates.push(
              moment(
                this.parents
                  .filter((p) => p.birth !== undefined)
                  .map((p) => p.birth.getUTCMilliseconds())
                  .reduce((a, b, i) => (a * i + b) / (i + 1))
              )
                .add(25, 'year')
                .valueOf()
            );
          }

          if (this.children.some((c) => c.birth !== undefined)) {
            dates.push(
              moment(
                this.children
                  .map((c) => c.birth)
                  .reduce((a, b) => (a < b ? a : b))
              )
                .subtract(2, 'year')
                .valueOf()
            );
          }

          if (dates.length == 0) {
            throw new Error('No data with which to place this marriage date.');
          }

          this.marriage = new Date(
            dates.reduce((t, d) => t + d) / dates.length
          );
        }

        console.log(` Guessed marriage: ${this.marriage.toString()}`);
      }

      this.parents
        .filter((p) => p.birthIsEstimate && p.deathIsEstimate)
        .forEach((p) => {
          p.birth = moment(this.marriage).subtract(25, 'year').toDate();
          p.death = moment(p.birth)
            .add(TreeNode.estimateLifespan(p.birth), 'year')
            .toDate();
        });

      this.children
        .filter((c) => c.birthIsEstimate && c.deathIsEstimate)
        .forEach((c, i) => {
          c.birth = moment(this.marriage)
            .add(2 + i * 2, 'year')
            .toDate();
          c.death = moment(c.birth)
            .add(TreeNode.estimateLifespan(c.birth), 'year')
            .toDate();
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
      'M'
      + new Pt(r, (start * Math.PI) / 180).fromPolar().toString()
      + 'A'
      + r
      + ','
      + r
      + ' 0 '
      + largeArc
      + ','
      + sweep
      + ' '
      + new Pt(r, (end * Math.PI) / 180).fromPolar().toString()
    );
  }
}

export enum Spouse {
  Father,
  Mother,
}

export enum SortRelation {
  Child,
  Spouse,
  Parent,
  Sibling,
}

export interface SortItem {
  rel: SortRelation;
  order?: number;
}
