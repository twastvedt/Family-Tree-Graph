/* global require */
/* global console */

'use strict';

import * as d3 from 'd3';

import settings from './settings';

import Pt from './Pt';

import { Data, Link, Tree } from './Data';
import * as Nodes from './TreeNode';


export class Graph {
	scale: d3.ScaleTime<number, number>;
	data: Data;

	main: d3.Selection<SVGGElement, any, HTMLElement, undefined>;

	constructor(xmlDoc: Document) {

		this.data = new Data(xmlDoc);

		//combine people and families to make list of all nodes
		this.data.tree.nodeList = (<Nodes.TreeNode[]>d3.values(this.data.tree.people)).concat(<Nodes.TreeNode[]>d3.values(this.data.tree.families));

		this.scale = d3.scaleTime()
			.domain(this.data.tree.dateRange)
			.range([settings.layout.width / 2, 0]);

		this.setupGraph();
	}

	setupGraph() {
		var width = window.innerWidth - 50,
			svgNode: any = this.data.svg.node(),
			height = window.innerHeight - svgNode.getBoundingClientRect().top - 50,
			that = this;

		this.data.svg.attr('width', width);
		this.data.svg.attr('height', height);

		this.main = this.data.svg.append('g')
			.attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
			.call(d3.zoom().scaleExtent([1, 8]).on('zoom', () => {
				var e = d3.event as d3.D3ZoomEvent<SVGGElement, any>;
				this.setZoom(e.transform);
			}))
			.append('g');

		this.main.append('rect')
			.classed('overlay', true)
			.attr('transform', 'translate(' + (-width / 2) + ',' + (-height / 2) + ')')
			.attr('width', width)
			.attr('height', height);

		//////////////////////
		//grid background
		var grid = this.main.append('g')
			.classed('grid', true);

		var ticks = this.scale.ticks(this.data.tree.maxLevel);

		for (var i = 0; i < ticks.length; i++) {
			var r = this.scale(ticks[i]);
			grid.append('path')
				.classed('level', true)
				.attr('d', 'M' + r + ',0A' + r + ',' + r + ' 0 0,1 -' + r + ',0A' + r + ',' + r + ' 0 0,1 ' + r + ',0')
				.attr('id', 'level-' + i);

			grid.append('text')
				.classed('label', true)
				.append('textPath')
				.attr('startOffset', '75%')
				.attr('xlink:href', '#level-' + i)
				.text(ticks[i].getFullYear());
		}

		///////////
		//draw tree
		var links = this.main.selectAll('.link')
			.data(this.data.tree.links)
			.enter().append('line')
			.attr('class', function (d) {
				var c = 'link';
				if (d.hasOwnProperty('type')) {
					c += ' ' + d.type;
				}
				return c;
			});

		var parentLinks = links.filter('.parent'),
			childLinks = links.filter('.child');

		var nodes = this.main.selectAll<SVGGElement, Nodes.TreeNode>('.node')
			.data(this.data.tree.nodeList, (d) => d.handle)
			.enter().append('g')
			.attr('class', function (d) {
				var c = 'node ' + (<any>d.constructor).name;

				if ((<any>d.constructor).name == 'Person') {
					var person: Nodes.Person = <Nodes.Person>d;
					c += ' ' + person.gender;
				}
				return c;
			})
			.attr('id', function (d) { return d.handle; });

		var people: d3.Selection<SVGGElement, Nodes.Person, SVGGElement, any> = this.main.selectAll('.Person');
		var families: d3.Selection<SVGGElement, Nodes.Family, SVGGElement, any> = this.main.selectAll('.Family');

		var familyArcs = families.append('path')
			.classed('familyArc', true)
			.attr('id', function (d) { return d.handle + '-arc'; });

		//add text to each family
		families.append(function (d) { return d.nameSVG; });

		//add text to each person
		people.append(function (d) { return d.nameSVG; });

		//add person line for people with no parent
		people.filter(function (d) { return !d.hasOwnProperty('childOf'); })


		people.each(function (d) {
			if (d.x && d.y) {
				//move label out to halfway up person line, rotate to stay upright
				(d3.select(this).select<SVGGElement>('.name') as d3.Selection<SVGGElement, Nodes.Person, any, unknown>)
					.attr('transform', function (d) {
						var transform = 'translate(0, ' + (d.level + 0.5) * settings.layout.ringSpacing + ')';
						if (d.y < 0) {
							transform += ' rotate(180)';
						}
						return transform;
					});
			}

			var lifeLine = d3.select(this).append('line') as d3.Selection<SVGLineElement, Nodes.Person, any, unknown>;

			lifeLine.classed('link tail', true)
				.attr('x1', 0)
				.attr('x2', 0);

			if (!d.hasOwnProperty('childOf')) {
				//person has no parent
				lifeLine.attr('y1', (d) => settings.layout.ringSpacing * d.level)
					.attr('y2', (d) => settings.layout.ringSpacing * (d.level + 0.5));

			} else if (!d.hasOwnProperty('birth')) {
				//person has no birth info
				lifeLine.attr('y1', (d) => settings.layout.ringSpacing * d.childOf.level)
					.attr('y2', (d) => d.hasOwnProperty('parentIn') ? settings.layout.ringSpacing * d.parentIn.level : 0);

			} else {
				//have all required info
				lifeLine.attr('y1', (d) => that.scale(d.birth))
					.attr('y2', (d) => that.scale(d.death ? d.death : new Date()));
			}
		})

		this.setZoom(d3.zoomIdentity);
	};

	setZoom(transform: d3.ZoomTransform) {
		this.main.attr('transform', transform.toString());

		this.main.selectAll('text').style('font-size', (settings.layout.textSize / transform.k) + 'px');
	}
}
