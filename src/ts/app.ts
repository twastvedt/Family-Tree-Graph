import {Graph} from './Graph';
import settings from './settings';
import d3 from 'd3';
import 'mousetrap';

var graph: Graph;

d3.xml(settings.dataPath, (error: Error, xmlDoc: Document) => {
	graph = new Graph(xmlDoc);
});

Mousetrap.bind('space', () => graph.playPause());
