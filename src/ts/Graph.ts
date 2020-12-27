import * as d3 from 'd3';

import settings from './settings';

import { Data, Link, Tree } from './Data';
import { TreeNode } from './model/TreeNode';
import { Person } from './model/Person';
import moment from 'moment';
import { Family } from './model/Family';

export class Graph {
  scale: d3.ScaleTime<number, number>;
  data: Data;

  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>;
  defs: d3.Selection<SVGDefsElement, unknown, HTMLElement, unknown>;

  main: d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;

  constructor(xmlDoc: Document) {
    this.data = new Data(xmlDoc);

    this.svg = d3.select('body').append('svg:svg');
    this.defs = this.svg.append('defs');

    //combine people and families to make list of all nodes
    this.data.tree.nodeList = (<TreeNode[]>(
      d3.values(this.data.tree.people)
    )).concat(<TreeNode[]>d3.values(this.data.tree.families));

    this.scale = d3
      .scaleTime()
      .domain(this.data.tree.dateRange)
      .range([settings.layout.width / 2, 0]);

    this.setupGraph();
  }

  setupGraph(): void {
    const width = window.innerWidth - 50,
      svgNode: SVGElement = this.svg.node(),
      height = window.innerHeight - svgNode.getBoundingClientRect().top - 50;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;

    this.svg.attr('width', width);
    this.svg.attr('height', height);

    this.main = this.svg
      .append('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
      .call(
        d3
          .zoom()
          .scaleExtent([1, 8])
          .on('zoom', () => {
            const e = d3.event as d3.D3ZoomEvent<SVGGElement, unknown>;
            this.setZoom(e.transform);
          })
      )
      .append('g');

    this.main
      .append('rect')
      .classed('overlay', true)
      .attr('transform', 'translate(' + -width / 2 + ',' + -height / 2 + ')')
      .attr('width', width)
      .attr('height', height);

    //////////////////////
    //grid background

    const grid = this.main.append('g').classed('grid', true);

    for (
      let i = this.scale.invert(Math.max(width, height)).getFullYear();
      i <= moment().year();
      i++
    ) {
      const r = this.scale(new Date(i, 0, 0));

      const circle = grid
        .append('circle')
        .classed('level', true)
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', r)
        .attr('id', 'level-' + i);

      if (i % 50 == 0) {
        circle.classed('level-50', true);

        grid
          .append('text')
          .classed('label', true)
          .append('textPath')
          .attr('startOffset', '75%')
          .attr('xlink:href', '#level-' + i)
          .text(i);
      } else if (i % 10 == 0) {
        circle.classed('level-10', true);
      } else {
        circle.classed('level-1', true);
      }
    }

    ///////////
    //draw tree

    const links = this.main
      .selectAll('.link')
      .data(this.data.tree.links)
      .enter()
      .append('line')
      .attr('class', function (d) {
        let c = 'link';
        if (d.hasOwnProperty('type')) {
          c += ' ' + d.type;
        }
        return c;
      });

    const nodes = this.main
      .selectAll<SVGGElement, TreeNode>('.node')
      .data(this.data.tree.nodeList, (d) => d.handle)
      .enter()
      .append('g')
      .attr('class', function (d) {
        let c = 'node ' + d.constructor.name;

        if (d.constructor.name == 'Person') {
          const person: Person = <Person>d;
          c += ' ' + person.gender;
        }
        return c;
      })
      .attr('id', function (d) {
        return d.handle;
      });

    const people: d3.Selection<
      SVGGElement,
      Person,
      SVGGElement,
      unknown
    > = this.main.selectAll('.Person');

    const families: d3.Selection<
      SVGGElement,
      Family,
      SVGGElement,
      unknown
    > = this.main.selectAll('.Family');

    d3.arc();

    const familyArcs = families
      .append('path')
      .classed('familyArc mainPath', true)
      .classed('estimate', (d) => d.marriageIsEstimate)
      .attr('id', function (d) {
        return d.handle + '-arc';
      })
      .attr('d', (d) => d.arc(this.scale));

    // Add text to each family.
    families
      .append('text')
      .classed('name familyName', true)
      .attr('dy', (d) => (d.angle % 360 < 180 ? 12 : -3))
      .append('textPath')
      .classed('textPath', true)
      .text((d) => d.name)
      .attr('startOffset', '50%')
      .attr('xlink:href', (d) => '#' + d.handle + '-arc');

    // Add text to each person.
    people
      .append('text')
      .classed('name personName', true)
      .text((d) => d.firstName)
      .each(function (d) {
        if ((d.angle + 270) % 360 > 180) {
          d3.select(this)
            .attr(
              'transform',
              `translate(${3 - d.parentOrder * 15}, ${
                that.scale(d.birth) - 7
              }) rotate(90)`
            )
            .classed('reversed', true);
        } else {
          d3.select(this).attr(
            'transform',
            `translate(${-3 - (d.parentOrder - 1) * 15}, ${
              that.scale(d.birth) - 7
            }) rotate(-90)`
          );
        }
      });

    // TODO: add person line for people with no parent
    // people.filter(function (d) { return !d.hasOwnProperty('childOf'); })

    people
      .sort((a, b) => a.level - b.level)
      .each(function (d) {
        if (d.childOf !== undefined) {
          d3.select(this)
            .append('line')
            .classed('link mainPath', true)
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', that.scale(d.childOf.marriage))
            .attr('y2', that.scale(d.birth));
        }

        if (d.parentIn !== undefined) {
          d3.select(this)
            .append('line')
            .classed('life mainPath', true)
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', that.scale(d.birth))
            .attr('y2', that.scale(d.parentIn.marriage));
        }

        const lifeLine = d3.select(this).append('line') as d3.Selection<
          SVGLineElement,
          Person,
          SVGElement,
          unknown
        >;

        lifeLine
          .classed('life', true)
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', that.scale(d.birth))
          .attr('y2', that.scale(d.death ? d.death : new Date()));

        if (!d.birthIsEstimate) {
          d3.select(this)
            .append('circle')
            .attr('cx', 0)
            .attr('cy', that.scale(d.birth))
            .attr('r', 2)
            .classed('birth', true);
        }

        // Rotate into place.
        d3.select(this).attr('transform', `rotate(${d.angle - 90})`);
      });

    this.setZoom(d3.zoomIdentity);
  }

  setZoom(transform: d3.ZoomTransform): void {
    this.main.attr('transform', transform.toString());

    this.main
      .selectAll('text')
      .style('font-size', settings.layout.textSize / transform.k + 'px');
  }
  }
}
