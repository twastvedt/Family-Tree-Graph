import { Family } from './Family';
import { Data } from './Data';
import { TreeNode } from './TreeNode';
import { Name } from './Name';

import { DateTime } from 'luxon';
import type { BaseType } from 'd3';
import type { DateInfo } from './Tree';

export type PersonSelection = d3.Selection<
  SVGGElement,
  Person,
  BaseType,
  unknown
>;

export enum Gender {
  Male,
  Female,
}

export enum Spouse {
  Father,
  Mother,
}

export type DefinedPerson = Person & Required<Pick<Person, 'birth'>>;

export class Person extends TreeNode {
  angle = 0;
  gender = Gender.Female;
  parentIn?: Family = undefined;
  childOf?: Family = undefined;

  parentOrder?: number = undefined;

  birth?: DateInfo;
  death?: DateInfo;

  firstName = '';
  surnames: Name[] = [];

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
      return;
    } else {
      console.log('Person: ' + handle);
      this.setup(data);
    }
  }

  setup(data: Data): void {
    this.complete = true;

    const person = data.xml.select<HTMLElement>(
      'person[handle=' + this.handle + ']',
    );

    if (person.empty()) {
      console.log('Empty Person handle:', this.handle);

      return;
    }

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

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const thisPerson = this;
    person.selectAll<HTMLElement, unknown>('eventref').each(function () {
      const e = data.xml.select(
        'event[handle=' + this.getAttribute('hlink') + ']',
      );

      if (!e.empty()) {
        switch (e.select('type').text()) {
          case 'Birth':
            thisPerson.birth = {
              date: new Date(e.select('dateval').attr('val')),
              isEstimate: false,
            };
            data.tree.addToDateRange(thisPerson.birth);
            break;
          case 'Death':
            thisPerson.death = {
              date: new Date(e.select('dateval').attr('val')),
              isEstimate: false,
            };
            data.tree.addToDateRange(thisPerson.death);
            break;
          default:
            console.log('Unhandled Person event:', e.select('type').text());
        }
      }
    });

    this.firstName =
      person.select('name').select<HTMLElement>('first').node()?.innerHTML ??
      '';

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;

    person
      .select('name')
      .selectAll<HTMLElement, unknown>('surname')
      .each(function () {
        that.surnames.push(
          new Name(
            this.innerHTML,
            this.getAttribute('derivation') ?? undefined,
          ),
        );
      });

    this.estimate();

    console.log('  ', this.firstName);
  }

  setRotationChildren(): void {
    if (!this.childOf) {
      this.rotationChildren = [this];
      return;
    }

    super.setRotationChildren([[this.childOf, this]], [this]);
  }

  estimate() {
    if (this.birth && this.death?.isEstimate) {
      // Estimate unknown death from known birth.
      if (
        DateTime.now().diff(DateTime.fromJSDate(this.birth.date), 'year')
          .years > (TreeNode.estimateLifespan(undefined, new Date()) ?? 0 * 1.5)
      ) {
        // Unlikely this person is still living.
        this.death.date = DateTime.fromJSDate(this.birth.date)
          .plus({ years: TreeNode.estimateLifespan(this.birth.date) ?? 0 })
          .toJSDate();
      }
    } else if (this.death && this.birth?.isEstimate) {
      // Estimate unknown birth from death.
      this.birth.date = DateTime.fromJSDate(this.death.date)
        .minus({
          years: TreeNode.estimateLifespan(undefined, this.death.date) ?? 0,
        })
        .toJSDate();
    }

    if (
      !this.birth &&
      this.parentIn &&
      this.parentIn.marriage?.isEstimate === false
    ) {
      // Estimate unknown birth from marriage date.
      this.birth = {
        date: DateTime.fromJSDate(this.parentIn.marriage.date)
          .minus({ years: 25 })
          .toJSDate(),
        isEstimate: true,
      };
    }

    if (
      this.childOf &&
      this.birth?.isEstimate !== false &&
      this.childOf.marriage?.isEstimate === false
    ) {
      // Adjust birth by parents' marriage
      if (!this.birth || this.birth.date < this.childOf.marriage.date) {
        this.birth = {
          date: DateTime.fromJSDate(this.childOf.marriage.date)
            .plus({ years: 5 })
            .toJSDate(),
          isEstimate: true,
        };
      }
    }
  }
}
