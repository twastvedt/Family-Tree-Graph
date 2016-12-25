import {Graph} from './Graph';
import * as d3 from 'd3';

var graph: Graph;

d3.xml('./data/family-tree.xml', (error: Error, xmlDoc: Document) => {
	graph = new Graph(xmlDoc);
});

