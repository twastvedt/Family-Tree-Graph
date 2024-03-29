import { Family } from './Family';
import { Data } from './Data';
import { TreeNode } from './TreeNode';
import { Name } from './Name';

import { DateTime } from 'luxon';
import { scaleLinear, type BaseType } from 'd3';
import { type DateInfo, getDateInfo, estimable } from './Tree';

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
          case 'Birth': {
            const date = getDateInfo(e);
            if (date) {
              thisPerson.birth = date;
              data.tree.addToDateRange(thisPerson.birth);
            }
            break;
          }
          case 'Death': {
            const date = getDateInfo(e);
            if (date) {
              thisPerson.death = date;
              data.tree.addToDateRange(thisPerson.death);
            }
            break;
          }
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

    console.log('  ', this.firstName);
  }

  setRotationChildren(): void {
    if (!this.childOf) {
      this.rotationChildren = [this];
      return;
    }

    super.setRotationChildren([[this.childOf, this]], [this]);
  }

  static estimateLifespan(
    birth: Date | undefined,
    death: Date | undefined = undefined,
  ): number {
    const interp = scaleLinear().domain([1775, 2020]).range([38, 80]);
    let age;

    if (birth !== undefined) {
      age = interp(birth.getUTCFullYear());
    } else if (death !== undefined) {
      age = interp.domain(interp.domain().map((d, i) => d + interp.range()[i]))(
        death.getUTCFullYear(),
      );
    }

    return Math.max(35, age ?? 40);
  }

  estimate() {
    if (estimable(this.birth) && this.parentIn?.marriage) {
      // Estimate unknown birth from marriage date.
      this.birth = {
        date: DateTime.fromJSDate(this.parentIn.marriage.date)
          .minus({ years: 25 })
          .toJSDate(),
        isEstimate: true,
      };
    }

    if (estimable(this.birth) && this.childOf?.marriage) {
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

    if (!this.birth && this.death) {
      this.birth = {
        date: DateTime.fromJSDate(this.death.date)
          .minus({
            years: Person.estimateLifespan(undefined, this.death.date),
          })
          .toJSDate(),
        isEstimate: true,
      };
    } else if (this.birth && estimable(this.death)) {
      // Estimate unknown death from known birth.
      if (
        DateTime.now().diff(DateTime.fromJSDate(this.birth.date), 'year')
          .years >
        Person.estimateLifespan(undefined, new Date()) * 1.5
      ) {
        // Unlikely this person is still living.
        this.death = {
          date: DateTime.fromJSDate(this.birth.date)
            .plus({ years: Person.estimateLifespan(this.birth.date) })
            .toJSDate(),
          isEstimate: true,
        };
      }
    }

    if (!this.birth?.date) {
      throw new Error(`Could not estimate birth for ${this.handle}.`);
    }
  }

  clearEstimates(): void {
    if (estimable(this.birth)) {
      delete this.birth;
    }

    if (estimable(this.death)) {
      delete this.death;
    }
  }
}
