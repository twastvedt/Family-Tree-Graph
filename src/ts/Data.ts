import * as TreeNode from './TreeNode';
import settings from './settings';
import Pt from './Pt';

import * as d3 from 'd3';

interface FamilyData {
	level: number;
	sourcePerson: TreeNode.Person;
}

export class Data {
	tree = new Tree();

	//this map holds a list of families that need to be parsed (key) along with their data: [level, [sorting data]]
	familiesToDo = d3.map<FamilyData>();

	xml: d3.Selection<XMLDocument, unknown, null, undefined>;

	constructor(xmlDoc: Document) {
		this.parseData(xmlDoc);
	}

	parseData(xmlDoc: Document) {
		this.xml = d3.select(xmlDoc);

		var rootFamilyHandle = this.xml.select('family#' + settings.rootFamilyId)
			.attr('handle');

		this.familiesToDo.set(rootFamilyHandle, { level: 1, sourcePerson: null });

		while (this.familiesToDo.size()) {
			var familyId = this.familiesToDo.keys()[0],
				family: TreeNode.Family;

			//check whether family is already in the tree?
			if (this.tree.families.hasOwnProperty(familyId)) {
				if (this.tree.families[familyId].complete) {
					this.familiesToDo.remove(familyId);
					continue;
				} else {
					family = this.tree.families[familyId];
					family.setup(this);
				}
			} else {
				family = new TreeNode.Family(familyId, this, true);
			}

			var familyData = this.familiesToDo.get(familyId);
			var level: number = familyData.level;
			var sourcePerson = familyData.sourcePerson;

			var familyWidth = 360 / (2 ** level);

			if (sourcePerson === null) {
				family.angle = 180;
			} else {
				var sourceIndex = family.parents.findIndex(p => p.handle === sourcePerson.handle);

				if (sourceIndex !== -1) {
					family.angle = sourcePerson.angle + (sourceIndex == 1 ? -1 : 1) * familyWidth / 2;
				} else {
					sourceIndex = family.children.findIndex(p => p.handle === sourcePerson.handle);

					if (sourceIndex !== -1) {
						family.angle = sourcePerson.angle - ((sourceIndex + 1) / (family.children.length + 1)) * familyWidth + familyWidth / 2;
					} else {
						throw new Error('Can\'t find source person in new family!');
					}
				}
			}

			console.log(`familyWidth: ${familyWidth}, family angle: ${family.angle}, level: ${level}, sourcePerson.angle: ${sourcePerson?.angle}, sourcePerson: ${sourcePerson?.firstName}`);

			family.level = level;

			//keep track of how many levels this.data contains, for scaling and graph lines
			this.tree.maxLevel = Math.max(this.tree.maxLevel, level);

			this.familiesToDo.remove(familyId);

			//store data for each parent of family
			family.parents.filter(p => p !== sourcePerson).forEach((parent, i) => {
				parent.angle = family.angle + (i - 0.5) * familyWidth;

				parent.parentOrder = i;

				this.addParentSorting(family, parent);
			});

			// Store data for each child of family.
			family.children.filter(p => p !== sourcePerson).forEach((child, i) => {
				console.log('child ', i + 1, ' of ', family.children.length);

				if (!child.complete) {
					//setup child object and add to list of people
					child.setup(this);
				}

				if (!child.hasOwnProperty('level')) {
					this.tree.addToLevel(child, level - 1);
				}

				child.angle = family.angle - (familyWidth / 2) + (familyWidth / (family.children.length + 1)) * (i + 1);

				//add child's family to list to do if it hasn't already been processed
				if (child.hasOwnProperty('parentIn') && !this.tree.families.hasOwnProperty(child.parentIn.handle)) {
					this.familiesToDo.set(child.parentIn.handle,
						{
							'level': child.level,
							// Offset to center of child's family.
							'sourcePerson': child
						}
					);
				}

				//add links from family to children
				this.tree.links.push({
					'source': family,
					'target': child,
					'type': TreeNode.SortRelation.Child
				});
			});

			console.log('families left: ', this.familiesToDo.size());
		}

		for (var i = 0; i < this.tree.levels.length; i++) {
			//for people without dates, define a default (average) level date
			this.tree.levelAvg[i] = new Date(d3.mean(this.tree.levels[i], (el) => el.hasOwnProperty('birth') ? el.birth.valueOf() : null));
		}
	}

	//Add sorting info to a parent and the tree
	addParentSorting(family: TreeNode.Family, parent: TreeNode.Person) {

		if (!parent.complete) {
			//parent not already processed

			//create object for parent and add to list of people

			parent.setup(this);
		}
		if (!parent.hasOwnProperty('level')) {
			this.tree.addToLevel(parent, family.level);
		}

		//add parent's family to list to do if it hasn't already been processed
		if (parent.hasOwnProperty('childOf') &&
			(!this.tree.families.hasOwnProperty(parent.childOf.handle) ||
				!this.tree.families[parent.childOf.handle].complete)) {
			this.familiesToDo.set(parent.childOf.handle,
				{
					'level': parent.level + 1,
					'sourcePerson': parent
				}
			);
		}

		//add link from father to family
		this.tree.links.push({
			'source': parent,
			'target': family,
			'type': TreeNode.SortRelation.Parent
		});
	};
};

enum LinkSource { Family };

export interface Link {
	source: TreeNode.TreeNode;
	target: TreeNode.TreeNode;
	type: TreeNode.SortRelation;
}

export class Tree {
	people: { [handle: string]: TreeNode.Person } = {};
	families: { [handle: string]: TreeNode.Family } = {};
	links: Link[] = [];
	levels: TreeNode.Person[][] = [];
	maxLevel: number = 0;
	dateRange: Date[] = [];
	levelAvg: Date[] = [];
	nodeList: TreeNode.TreeNode[] = [];

	//Add a person to a level of the graph
	addToLevel(person: TreeNode.Person, level: number) {

		//make sure the list for this level exists before adding a person to it
		if (typeof this.levels[level] === 'undefined') {
			this.levels[level] = [];
		}

		if (person.level && person.level !== level) {
			this.levels[level].splice(this.levels[level].indexOf(person));
		}

		this.levels[level].push(person);
		person.level = level;
	};

	addToDateRange(d: Date) {
		if (this.dateRange[0]) {
			this.dateRange[0] = new Date(Math.min(this.dateRange[0].getTime(), d.getTime()));
		} else {
			this.dateRange[0] = d;
		}

		if (this.dateRange[1]) {
			this.dateRange[1] = new Date(Math.max(this.dateRange[1].getTime(), d.getTime()));
		} else {
			this.dateRange[1] = d;
		}
	}
}
