import { Family } from './Family';
import { Data } from '../Data';
import { TreeNode } from './TreeNode';
import { Name } from './Name';

import moment from 'moment';

export enum Gender {
  Male,
  Female,
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

  /**
   * Get all data from the xml related to one person
   */
  constructor(handle: string, data: Data) {
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
