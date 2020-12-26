import { Graph } from './Graph';
import settings from './settings';
import * as d3 from 'd3';

let graph: Graph;

d3.xml(settings.dataPath).then((xmlDoc) => {
  graph = new Graph(xmlDoc);
});
