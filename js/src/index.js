/* global require */

'use strict';

var d3 = require('d3'),
	settings = require('./settings.json'),

	xml, svg, force,

	data = {
		"people": {},
		"families": {},
		"links": [],
		"levels": [],
		"maxLevel": 0
	},
	//this map holds a list of families that need to be parsed (key) along with their data: [level, [sorting data]]
	familiesToDo = d3.map();

var toPolar = function(d) {
	return [Math.sqrt(d[0]*d[0] + d[1]*d[1]), Math.atan2(d[1], d[0])];
};

var fromPolar = function(d) {
	return [Math.cos(d[1]) * d[0], Math.sin(d[1]) * d[0]];
};

var getPerson = function(handle) {
	var person = xml.select('person[handle=' + handle + ']');

	if (! person.empty()) {
		var personData = {
				"gender": person.select('gender').text(),
				"handle": handle,
				"type": "person",
				"sort": []
			};

		if (! person.select('parentin').empty()) {
			personData.parentIn = person.select('parentin').attr('hlink');
		}
		if (! person.select('childof').empty()) {
			personData.childOf = person.select('childof').attr('hlink');
		}

		var nameXML = person.select('name'),

			name = nameXML.select('first').text();

		nameXML.selectAll('surname').each(function() {
			name += ' ' + d3.select(this).text();
		});

		personData.name = name;

		return personData;

	} else {
		return null;
	}
};

var getFamily = function(handle) {
	var family = xml.select('[handle=' + handle + ']');

	if (! family.empty()) {
		var familyData = {
			"handle": handle,
			"children": [],
			"type": "family"
		};

		if (! family.select('father').empty()) {
			familyData.father = family.select('father').attr('hlink');
		}
		if (! family.select('mother').empty()) {
			familyData.mother = family.select('mother').attr('hlink');
		}

		family.selectAll('childref').each(function() {
			familyData.children.push(this.getAttribute('hlink'));
		});

		return familyData;

	} else {
		return null;
	}
};

var playPause = function() {
	if (force.alpha() > 0) {
		force.stop();

		d3.select('#button-playPause').text("Resume");
	} else {
		force.resume();

		d3.select('#button-playPause').text("Pause");
	}
};

var setupGraph = function() {
	svg = d3.select("body").append("svg:svg");

	var width = window.innerWidth - 50,
		height = window.innerHeight - svg.node().getBoundingClientRect().top - 50;

	svg.attr({
		"width": width,
		"height": height
	});

	force = d3.layout.force()
		.gravity(settings.gravity)
		.charge(settings.charge)
		.friction(settings.friction)
		.alpha(settings.alpha)
		.size([1, 1])

		.nodes(data.nodeList)
		.links(data.links);

	var zoom = function() {
		main.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	};

	var main = svg.append("g")
				.attr({"transform": "translate(" + width / 2 + "," + height / 2 + ")"})
				.call(d3.behavior.zoom().scaleExtent([0.5, 8]).on("zoom", zoom))
					.append("g");

	main.append("rect")
		.attr({"transform": "translate(" + (-width / 2) + "," + (-height / 2) + ")",
			"class": "overlay",
			"width": width,
			"height": height
		});

	//////////////////////
	//grid background
	var grid = main.append("g")
		.attr({"class": "grid"});

	for (var i = 1; i <= data.maxLevel; i++) {
		grid.append("circle")
			.attr({"class": "level",
				"r": i * settings.ringSpacing});
	}

	///////////
	//draw tree
	var links = main.selectAll(".link")
		.data(data.links)
		.enter().append("line")
		.attr({"class": "link",
			"type": function(d) { return d.type; }
		});

	var nodes = main.selectAll(".node")
		.data(data.nodeList, function(d) { return d.handle; })
		.enter().append("g")
		.attr({
			"class": "node",
			"id": function(d) { return d.handle; }
		})
		.classed('person', function(d) { return d.type === "person"; })
		.classed('family', function(d) { return d.type === "family"; });

	var people = main.selectAll(".person");
	var families = main.selectAll(".family");

	people.append("text")
		.text(function(d) { return d.name; });

	families.append("text")
		.text("+");

	////////
	//events
	force.on("tick", function() {
		//pull nodes to correct ring
		nodes.each(function(d) {
			if (d.x && d.y) {
				var targetR = settings.ringSpacing * d.level,
					currentPolar = toPolar([d.x, d.y]),
					rAdjust = Math.max(-settings.constraintStrength, Math.min(settings.constraintStrength, targetR - currentPolar[0])),

					newPos = fromPolar([currentPolar[0] + rAdjust, currentPolar[1]]);

				d.x = newPos[0];
				d.y = newPos[1];
			}
		});

		//apply transformations
		links.attr({"x1": function(d) { return d.source.x; },
				"y1": function(d) { return d.source.y; },
				"x2": function(d) { return d.target.x; },
				"y2": function(d) { return d.target.y; } });

		people.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
		});
		families.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
		});
		//can't stop won't stop
		force.resume();
	});

	d3.select('#button-playPause').on('click', playPause);

	///////
	//start
	force.linkDistance(function(d) {
			switch (d.type) {
				case "parent":
					return settings.ringSpacing * settings.parentLinkDistance;
				case "child":
					return settings.ringSpacing * settings.childLinkDistance;
				case "spouse":
					return settings.ringSpacing * settings.parentLinkDistance * 2;
				default:
					return 1;
			}
		})
		.linkStrength(function(d) {
			switch (d.type) {
				case "parent":
					return 1;
				case "child":
					return 0.2;
				case "spouse":
					return 0.5;
				default:
					return 1;
			}
		});

	force.start();
};

var addToLevel = function(person, level) {
	//make sure the list for this level exists before adding a person to it

	if (typeof data.levels[level] === 'undefined') {
		data.levels[level] = [];
	}
	data.levels[level].push(person);
};

var addParent = function(family, spouse, sortList) {
	//spouse === 'father'||'mother'

	var parent;

	if (family.hasOwnProperty(spouse)) {

		if (!data.people.hasOwnProperty(family[spouse])) {
			//parent not already processed

			//create object for parent and add to list of people
			parent = getPerson(family[spouse]);

			parent.level = family.level;
			parent.sortList = sortList;

			if (sortList[0].rel === 'child') {
				//sortList comes from child
				parent.sortList[0].rel = 'parent';
			}
			//father defaults to left side of marriage in graph, mother to right
			parent.sortList[0].order = (spouse === 'father' ? -1 : 1);

			data.people[parent.handle] = parent;

			addToLevel(parent, parent.level);

			//add parent's family to list to do if it hasn't already been processed
			if (parent.hasOwnProperty("childOf") && !data.people.hasOwnProperty(parent.childOf)) {
				familiesToDo.set(parent.childOf, parent.sortList.unshift({'rel': 'child', 'order': 0}));
			}
		} else {
			//link to already processed person object
			parent = data.people[family[spouse]];
		}

		//add link from father to family
		data.links.push({
			"source": parent,
			"target": family,
			"type": "parent"
		});
	}
};

var parseData = function(error, xmlDoc) {
	xml = d3.select(xmlDoc);

	var rootFamilyHandle = xml.select('family#' + settings.rootFamilyId)
							.attr('handle');

	familiesToDo.set(rootFamilyHandle, [1, [{'rel': 'parent', 'order': 0}]]);

	while (familiesToDo.size()) {
		var familyId = familiesToDo.keys()[0],
			familyData = familiesToDo.get(familyId),
			level = familyData[0],
			sortList = familyData[1],
			family = getFamily(familyId);

		family.level = level;

		//keep track of how many levels data contains, for scaling and graph lines
		data.maxLevel = Math.max(data.maxLevel, level);

		familiesToDo.remove(familyId);

		//store this family in the list of all families
		data.families[familyId] = family;

		addParent(family, 'father', sortList);
		addParent(family, 'mother', sortList);

		for (var i = 0; i < family.children.length; i++) {
			var childId = family.children[i];

			if (family.children.hasOwnProperty(childId)) {
				var child;

				if (data.people.hasOwnProperty(family.children[childId])) {
					child = data.people[family.children[childId]];
				} else {
					//create child object and add to list of people
					child = getPerson(family.children[childId]);

					child.level = level - 1;

					child.sortList = sortList;

					if (sortList[0].rel === 'child') {
						//sortList comes from sibling
						child.sortList[0] = {'rel': 'sibling',
							//if this family is linked by a child on the right side of a marriage, add siblings to the right, and vice versa
							'order': i + (child.sortList[1].order >= 0 ? 1 : -1)
						};
					} else {
						//sortList comes from parent
						child.sortList[0] = {'rel': 'child', 'order': i};
					}

					//add child's family to list to do if it hasn't already been processed
					if (child.hasOwnProperty("parentIn") && !data.people.hasOwnProperty(child.parentIn)) {
						familiesToDo.set(child.parentIn, child.sortList.unshift({'rel': 'parent', 'order': 0}));
					}

					//add child to list of all people
					data.people[child.handle] = child;
					//add child to list of other people on same level
					addToLevel(child, child.level);
				}

				//add links from family to children
				data.links.push({
					"source": family,
					"target": child,
					"type": "child"
				});
			}
		}
	}

	//distill sortList into a number representing
	//the person's lateral distance from the root family in the graph
	for (var i = 0; i < data.people.length; i++) {
		var person = data.people[i],
			sortValue = 0;

		for (var j = 0; j < person.sortList.length; j++) {
			sortValue += person.sortList[j].order;
		}
		person.sortValue = sortValue;
	}

	//sort people in each level based on lateral location in the graph
	var sortLevel = function(a, b) {
		return a.sortValue > b.sortValue;
	};

	for (i = 0; i < data.levels.length; i++) {
		data.levels[i].sort(sortLevel);
	}

	//assign a starting location to each person
	for (i = 0; i < data.levels.length; i++) {
		var length = data.levels[i].length,
			curLevel = data.levels[i].length;

		for (var j = 0; j < length; j++) {
			var person = curLevel[j],
				theta = j/length * 2 * Math.PI,
				coords = fromPolar([i * settings.ringSpacing, theta]);

			person.x = coords[0];
			person.y = coords[1];
		}
	}


	//combine people and families to make list of all nodes
	data.nodeList = d3.values(data.people).concat(d3.values(data.families));

	setupGraph();
};


d3.xml('data/family-tree.xml', parseData);
