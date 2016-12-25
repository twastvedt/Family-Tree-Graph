/* global require */
/* global console */

'use strict';

import * as d3 from 'd3';

import settings from './settings';

import Pt from './Pt';

import {Data, Link, Tree} from './Data';
import * as Nodes from './TreeNode';


export class Graph {
	force: d3.layout.Force<Link, Nodes.TreeNode>;
	scale: d3.time.Scale<number, number>;
	data: Data;

	constructor(xmlDoc: Document) {

		this.data = new Data(xmlDoc);

		//combine people and families to make list of all nodes
		this.data.tree.nodeList = (<Nodes.TreeNode[]>d3.values(this.data.tree.people)).concat(<Nodes.TreeNode[]>d3.values(this.data.tree.families));

		this.scale = d3.time.scale()
			.domain(this.data.tree.dateRange)
			.range([settings.width / 2, 0]);

		this.setupGraph();
	}

	setupGraph() {

		var width = window.innerWidth - 50,
			svgNode: any = this.data.svg.node(),
			height = window.innerHeight - svgNode.getBoundingClientRect().top - 50;

		this.data.svg.attr({
			'width': width,
			'height': height
		});

		this.force = <d3.layout.Force<Link, Nodes.TreeNode>>d3.layout.force()
			.gravity(settings.gravity)
			.charge(settings.charge)
			.friction(settings.friction)
			.alpha(settings.alpha)
			.size([1, 1])

			.nodes(this.data.tree.nodeList)
			.links(this.data.tree.links);

		var main = this.data.svg.append('g')
			.attr({ 'transform': 'translate(' + width / 2 + ',' + height / 2 + ')' })
			.call(d3.behavior.zoom().scaleExtent([0.5, 8]).on('zoom', function () {
				main.attr('transform', 'translate(' + (<d3.ZoomEvent>d3.event).translate + ')scale(' + (<d3.ZoomEvent>d3.event).scale + ')');
			}))
			.append('g');

		main.append('rect')
			.attr({'transform': 'translate(' + (-width / 2) + ',' + (-height / 2) + ')',
				'class': 'overlay',
				'width': width,
				'height': height
			});

		//////////////////////
		//grid background
		var grid = main.append('g')
			.attr({'class': 'grid'});

		var ticks = this.scale.ticks(this.data.tree.maxLevel);

		for (var i = 0; i < ticks.length; i++) {
			var r = this.scale(ticks[i]);
			grid.append('path')
					.attr({
						'class': 'level',
						'd': 'M' + r + ',0A' + r + ',' + r + ' 0 0,1 -' + r + ',0A' + r + ',' + r + ' 0 0,1 ' + r + ',0',
						'id': 'level-' + i
					});

			grid.append('text')
					.attr('class', 'label')
				.append('textPath')
					.attr({
						'startOffset': '75%',
						'xlink:href': '#level-' + i
					})
					.text(ticks[i].getFullYear());
		}

		///////////
		//draw tree
		var links = main.selectAll('.link')
			.data(this.data.tree.links)
			.enter().append('line')
			.attr({
				'class': function(d) {
					var c = 'link';
					if (d.hasOwnProperty('type')) {
						c += ' ' + d.type;
					}
					return c;
				}
			});

		var parentLinks = links.filter('.parent'),
			childLinks = links.filter('.child');

		var nodes = main.selectAll('.node')
			.data(this.data.tree.nodeList, function(d) { return d.handle; })
			.enter().append('g')
			.attr({
				'class': function(d) {
					var c = 'node ' + (<any>d.constructor).name;

					if ((<any>d.constructor).name == 'Person') {
						var person: Nodes.Person = <Nodes.Person>d;
						c += ' ' + person.gender;
					}
					return c;
				},
				'id': function(d) { return d.handle; }
			});

		var people = main.selectAll('.Person');
		var families = main.selectAll('.Family');

		var familyArcs = families.append('path')
			.attr({
				'class': 'familyArc',
				'id': function(d) { return d.handle + '-arc'; }
			});

		//add text to each family
		families.append(function(d) { return d.nameSVG; });

		//add text to each person
		people.append(function(d) { return d.nameSVG; });

		//add person line for people with no parent
		people.filter(function(d) { return !d.hasOwnProperty('childOf'); })
			.append('line')
				.attr({
					'class': 'link tail',
					'x1': 0,
					'y1': (d) => settings.ringSpacing * d.level,
					'x2': 0,
					'y2': (d) => settings.ringSpacing * (d.level + 0.5)
				});

		//add life lines to people
		people.filter((d) => d.birth)
			.append('line')
				.attr({
					'class': 'lifeLine',
					'x1': 0,
					'y1': (d) => this.scale(d.birth),
					'x2': 0,
					'y2': (d) => this.scale(d.death ? d.death : new Date())
				});

		////////
		//events
		this.force.on('tick', () => {

			people.each(function(d) {
				if (d.x && d.y) {
					//lock nodes on correct ring
					var loc = d.Pt(),
						currentPolar = loc.toPolar(),
						newPos = new Pt(d.level * settings.ringSpacing, currentPolar[1]).fromPolar();

					d.x = newPos[0];
					d.y = newPos[1];
					d.polar = currentPolar;

					//move label out to halfway up person line, rotate to stay upright
					d3.select(this).select('.name').attr('transform', function(d) {
						var transform = 'translate(0, ' + (d.level + 0.5) * settings.ringSpacing + ')';
						if (d.y < 0) {
							transform += ' rotate(180)';
						}
						return transform;
					});
				}
			});

			//Keep family node between parents
			families.each(function(d) {
				if (d.x && d.y && d.father && d.mother) {
					var fatherPolar = new Pt(d.father.x, d.father.y).toPolar(),
						avgPos = [(d.father.x + d.mother.x)/2, (d.father.y + d.mother.y)/2],
						currentPolar = new Pt(fatherPolar[0], Math.atan2(avgPos[1], avgPos[0])),
						newPos = currentPolar.fromPolar();

					d.x = newPos[0];
					d.y = newPos[1];
					d.polar = currentPolar;
				}
			});

			//Apply transformations
			childLinks.attr({
				'x1': function(d) {
					return d.source.x;
				},
				'y1': function (d) { return d.source.y; },
				'x2': function(d) { return d.target.x; },
				'y2': function(d) { return d.target.y; }
			});

			familyArcs.attr({
				'd': (d) => {
					return d.arc();
				}
			});

			people.attr('transform', function(d) {
				return 'rotate(' + (d.polar[1] * 360 / (2 * Math.PI) - 90) + ')';
			});

			//can't stop won't stop
			this.force.resume();
		});

		d3.select('#button-playPause').on('click', () => {
			this.playPause();
		});

		///////
		//start
		this.force.linkDistance(function(d) {
				switch (d.type) {
					case Nodes.SortRelation.Parent:
						return settings.ringSpacing * settings.parentLinkDistance;
					case Nodes.SortRelation.Child:
						return settings.ringSpacing * settings.childLinkDistance;
					default:
						return 1;
				}
			})
			.linkStrength(function(d) {
				switch (d.type) {
					case Nodes.SortRelation.Parent:
						return 0;
					case Nodes.SortRelation.Child:
						return 1;
					default:
						return 1;
				}
			});

		this.force.start();
	};

	playPause () {
		if (this.force.alpha() > 0) {
			this.force.stop();

			d3.select('#button-playPause').text('Resume');
		} else {
			this.force.resume();

			d3.select('#button-playPause').text('Pause');
		}
	};
}
