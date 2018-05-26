import Pt from './Pt';
import settings from './settings';

import {Data} from './Data';
import d3 from 'd3';

export enum Gender { Male, Female };

export class TreeNode {
	x: number;
	y: number;
	polar: Pt;
	level: number;
	sortList: SortItem[];
	complete: boolean;

	constructor(public handle: string) { }

	Pt = () => new Pt(this.x, this.y);
}

export class Person extends TreeNode {
	gender: Gender;
	parentIn: Family;
	childOf: Family;

	birth: Date;
	death: Date;
	firstName: string;
	lastName: string;
	nameSVG: Node;

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
		if (data.xml == null) {
			console.log('Person Ref: ' + handle);
			this.complete = false;

			return;

		} else {
			console.log('Person: ' + handle);
			this.setup(data)
		}
	}

	setup(data: Data) {
		this.complete = true;

		var person = data.xml.select('person[handle=' + this.handle + ']');

		if (!person.empty()) {
			this.gender = person.select('gender').text() == 'M' ? Gender.Male : Gender.Female;

			if (!person.select('parentin').empty()) {
				let familyHandle = person.select('parentin').attr('hlink');

				if (!(this.parentIn = data.tree.families[familyHandle])) {
					this.parentIn = new Family(familyHandle, data, false);
				}
			}

			if (!person.select('childof').empty()) {
				let familyHandle = person.select('childof').attr('hlink');

				if (!(this.childOf = data.tree.families[familyHandle])) {
					this.childOf = new Family(familyHandle, data, false);
				}
			}

			let thisPerson = this;
			person.selectAll('eventref').each(function () {
				var e = data.xml.select('event[handle=' + this.getAttribute('hlink') + ']');

				if (!e.empty()) {
					switch (e.select('type').text()) {
						case 'Birth':
							thisPerson.birth = new Date(e.select('dateval').attr('val'));
							data.tree.addToDateRange(thisPerson.birth);
							break;
						case 'Death':
							thisPerson.death = new Date(e.select('dateval').attr('val'));
							data.tree.addToDateRange(thisPerson.death);
							break;
						default:
							console.log('Unhandled Person event:', e.select('type').text());
					}
				}
			});

			if (this.hasOwnProperty('birth') && !this.hasOwnProperty('death')) {
				//person still living
				data.tree.dateRange[1] = new Date();
			}

			var nameXML = person.select('name');

			this.firstName = nameXML.select('first').text();
			console.log('  ', this.firstName);

			var nameSVG = data.svg.append('text')
				.remove()
				.attr('class', 'name');

			nameSVG.append('tspan')
				.text(this.firstName)
				.attr('class', 'first');

			nameXML.selectAll('surname').each(function () {
				nameSVG.append('tspan')
					.text(' ' + this.innerHTML)
					.attr({
						'class': 'last',
						'type': this.getAttribute('derivation')
					});
			});

			this.nameSVG = <Node>nameSVG.node();

		} else {
			console.log('Empty Person handle:', this.handle);
		}
	}
}

export class Family extends TreeNode {

	parents: Person[] = [];
	marriage: Date;
	children: Person[] = [];
	nameSVG: Node;

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

	setup(data: Data) {
		this.complete = true;

		var family = data.xml.select('[handle=' + this.handle + ']');

		if (!family.empty()) {

			if (!family.select('father').empty()) {
				this.parents.push(new Person(family.select('father').attr('hlink'), data));
			}
			if (!family.select('mother').empty()) {
				this.parents.push(new Person(family.select('mother').attr('hlink'), data));
			}

			let thisFamily = this;
			family.selectAll('eventref').each(function () {
				var e = data.xml.select('event[handle=' + this.getAttribute('hlink') + ']');

				if (!e.empty()) {
					switch (e.select('type').text()) {
						case 'Marriage':
							thisFamily.marriage = new Date(e.select('dateval').attr('val'));
							data.tree.addToDateRange(thisFamily.marriage);
							break;
						default:
							console.log('Unhandled event', e.select('type').text());
					}
				}
			});

			family.selectAll('childref').each(function () {
				var handle = this.getAttribute('hlink');

				if (data.tree.people[handle]) {
					thisFamily.children.push(data.tree.people[handle]);
				} else {
					thisFamily.children.push(new Person(handle, data));
				}
			});

		} else {
			console.log('Empty family:', this.handle);
		}
	}

   // path generator for arcs
   arc () {
	   var start: Pt,
		   end: Pt;

	   //keep text upright
	   if (this.Pt()[1] >= 0) {
		   end = this.parents[0].Pt();
		   start = this.parents[1].Pt();
	   } else {
		   start = this.parents[1].Pt();
		   end = this.parents[0].Pt();
	   }

	   var startP = start.toPolar(),
		   endP = end.toPolar(),

		   dTheta = endP[1] - startP[1];
		   dTheta += (dTheta > Math.PI) ? -(Math.PI * 2) : (dTheta <- Math.PI) ? (Math.PI * 2) : 0;

	   var largeArc = (Math.abs(dTheta) > 180) ? 1 : 0,
		   sweep = (dTheta > 0) ? 1 : 0,
		   r = this.level * settings.layout.ringSpacing;

	   return 'M' + start.toString() +
		   'A' + r + ',' + r + ' 0 ' +
		   largeArc + ',' + sweep + ' ' +
		   end.toString();
   };
};

export enum Spouse { Father, Mother };

export enum SortRelation { Child, Spouse, Parent, Sibling };

export interface SortItem {
	rel: SortRelation;
	order?: number;
};
