import * as TreeNode from './TreeNode';
import settings from './settings';
import Pt from './Pt';

import * as d3 from 'd3';

interface FamilyData {
	level: number;
	sorting: TreeNode.SortItem[];
}

export class Data {
	tree = new Tree();

	//this map holds a list of families that need to be parsed (key) along with their data: [level, [sorting data]]
	familiesToDo = d3.map<FamilyData>();

	xml: d3.Selection<any>;

	svg: d3.Selection<any>;

	constructor(xmlDoc: Document) {
		this.parseData(xmlDoc);
	}

	parseData(xmlDoc: Document) {
		this.svg = d3.select('body').append('svg:svg');
		this.xml = d3.select(xmlDoc);

		var rootFamilyHandle = this.xml.select('family#' + settings.rootFamilyId)
			.attr('handle');

		this.familiesToDo.set(rootFamilyHandle, { 'level': 1, 'sorting': [{ 'rel': TreeNode.SortRelation.Parent, 'order': 0 }] });

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

			var familyData = this.familiesToDo.get(familyId),
				level:number = familyData.level,
				sortList: TreeNode.SortItem[] = familyData.sorting;

			family.level = level;

			//keep track of how many levels this.data contains, for scaling and graph lines
			this.tree.maxLevel = Math.max(this.tree.maxLevel, level);

			this.familiesToDo.remove(familyId);

			//store data for each parent of family
			for (var parent of family.parents) {
				this.addParentSorting(family, parent, sortList.slice());
			}

			var nameSVG = this.svg.append('text')
				.remove()
				.attr('class', 'name');

			//Perhaps the family shouldn't have a name - just display last names for each person?

			// var textPath = <Node>nameSVG.append('textPath')
			// 	.attr({
			// 		'class': 'textPath',
			// 		'startOffset': '50%',
			// 		'xlink:href': '#' + family.handle + '-arc'
			// 	})
			// 	.node();

			// d3.select(parent.nameSVG.cloneNode(true))
			// 	.selectAll('*').each(function () {
			// 		textPath.appendChild(this);
			// 	});

			//store DOM node not d3 selection
			family.nameSVG = <Node>nameSVG.node();

			//store data for each child of family
			for (var i = 0; i < family.children.length; i++) {
				console.log('child ', i + 1, ' of ', family.children.length);
				var child = family.children[i];

				if (!child.complete) {
					//setup child object and add to list of people
					child.setup(this);
				}

				if (!child.hasOwnProperty('level')) {
					this.tree.addToLevel(child, level - 1);
				}

				// Copy family's sortlist to child
				child.sortList = sortList.slice();

				if (sortList[0].rel == TreeNode.SortRelation.Child) {
					//sortList comes from sibling
					child.sortList[0] = { 'rel': TreeNode.SortRelation.Sibling, 'order': i };

					if (child.sortList.length > 1) {
						//if this family is linked by a child on the right side of a marriage, add siblings to the right, and vice versa
						child.sortList[0].order += (child.sortList[1].order >= 0 ? 1 : -1);
					}
				} else {
					//sortList comes from parent
					child.sortList[0] = { 'rel': TreeNode.SortRelation.Child, 'order': i };
				}

				//add child's family to list to do if it hasn't already been processed
				if (child.hasOwnProperty('parentIn') && !this.tree.families.hasOwnProperty(child.parentIn.handle)) {
					this.familiesToDo.set(child.parentIn.handle,
						{
							'level': child.level,
							'sorting': [<TreeNode.SortItem>{ 'rel': TreeNode.SortRelation.Parent, 'order': 0 }].concat(child.sortList)
						}
					);
				}

				family.children[i] = child;

				//add links from family to children
				this.tree.links.push({
					'source': family,
					'target':child,
					'type': TreeNode.SortRelation.Child
				});
			}
			console.log('families left: ', this.familiesToDo.size());
		}

		for (var i = 0; i < this.tree.levels.length; i++) {
			this.tree.levels[i].sort(this.tree.sortLevel);

			//for people without dates, define a default (average) level date
			this.tree.levelAvg[i] = new Date(d3.mean(this.tree.levels[i], (el) => el.hasOwnProperty('birth') ? el.birth.valueOf() : null ));
		}


		//assign a starting location to each person
		for (i = 0; i < this.tree.levels.length; i++) {
			var length = this.tree.levels[i].length,
				curLevel = this.tree.levels[i];

			for (var j = 0; j < length; j++) {
				var person = curLevel[j],
					theta = j / length * 2 * Math.PI,
					coords = new Pt(i * settings.ringSpacing, theta).fromPolar();

				person.x = coords[0];
				person.y = coords[1];
			}
		}
	}

	//Add sorting info to a parent and the tree
	addParentSorting (family: TreeNode.Family, parent: TreeNode.Person, sortList: TreeNode.SortItem[]) {

		if (!parent.complete) {
			//parent not already processed

			//create object for parent and add to list of people
			parent.setup(this);
		}

		if (!parent.hasOwnProperty('level')) {
			this.tree.addToLevel(parent, family.level);
		}

		parent.sortList = sortList;

		if (sortList[0].rel == TreeNode.SortRelation.Child) {
			//sortList comes from child
			parent.sortList[0] = { 'rel': TreeNode.SortRelation.Parent };
		} else {
			//sortList comes from other parent
			parent.sortList[0] = { 'rel': TreeNode.SortRelation.Spouse };
		}
		//father defaults to left side of marriage in graph, mother to right
		parent.sortList[0].order = (parent.gender == TreeNode.Gender.Male ? -1 : 1);

		//add parent's family to list to do if it hasn't already been processed
		if (parent.hasOwnProperty('childOf') &&
			(!this.tree.families.hasOwnProperty(parent.childOf.handle) ||
			!this.tree.families[parent.childOf.handle].complete)) {
				this.familiesToDo.set(parent.childOf.handle,
					{
						'level': parent.level + 1,
						'sorting': [<TreeNode.SortItem>{ 'rel': TreeNode.SortRelation.Child, 'order': 0 }].concat(parent.sortList)
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

export interface Link extends d3.layout.force.Link < TreeNode.TreeNode > {
	'source': TreeNode.TreeNode;
	'target': TreeNode.TreeNode;
	'type': TreeNode.SortRelation;
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

	//Sort people in each level based on lateral location in the graph
	sortLevel(a: TreeNode.Person, b: TreeNode.Person) {

		var aLen = a.sortList.length,
			bLen = b.sortList.length,
			minLen = Math.min(aLen, bLen);

		//move backwards through the sortLists to find the first branch
		for (var i = 1; i <= minLen; i++) {
			var aSort = a.sortList[aLen - i],
				bSort = b.sortList[bLen - i];

			if (aSort.order !== bSort.order) {
				return bSort.order - aSort.order;
			}
		}
		throw 'Can\'t sort people!';
	};

	//Add a person to a level of the graph
	addToLevel(person: TreeNode.Person, level:number) {

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
