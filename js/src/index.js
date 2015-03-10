/* global require */

'use strict';

var d3 = require('d3'),

	rootFamilyID = 'F0000',

	xml,

	data = {
		"people": [],
		"families": [],
		"links": []
	};

var getPerson = function(handle) {
	var person = xml.select('person[handle=' + handle + ']');

	if (! person.empty()) {
		person = person[0];

		var personData = {
				"gender": person.select('gender').innerHTML(),
				"handle": handle
			};

		if (! person.select('parentIn').empty()) {
			personData.parentIn = person.select('parentin').getAttribute('hlink');
		}
		if (! person.select('childOf').empty()) {
			personData.childOf = person.select('childof').getAttribute('hlink');
		}

		var nameXML = person.select('name'),

			name = nameXML.select('first').innerHTML();

		nameXML.selectAll('surname').each(function() {
			name += ' ' + this.innerHTML();
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
			"children": []
		};

		if (! family.select('father').empty()) {
			family.father = family.select('father').getAttribute('hlink');
		}
		if (! family.select('mother').empty()) {
			family.mother = family.select('mother').getAttribute('hlink');
		}

		family.selectAll('childref').each(function() {
			familyData.children.push(this.getAttribute('hlink'));
		});

		return familyData;

	} else {
		return null;
	}
};

var parseData = function(error, xml) {
	var rootFamilyHandle = xml.select('family[id=' + rootFamilyID + ']')
							.getAttribute('handle'),

		familiesToDo = [rootFamilyHandle];

	while (familiesToDo.length) {
		var family = getFamily(familiesToDo.pop());

		data.families.push(family);

		if (family.hasOwnProperty("father")) {
			//create object for father and add to list of people
			var father = getPerson(family.father);
			data.people.push(father);

			//add father's family to list to do
			if (father.hasOwnProperty("childOf")) {
				familiesToDo.push(father.childOf);
			}

			//add link from father to family
			data.links.push({
				"source": father,
				"target": family
			});
		}

		if (family.hasOwnProperty("mother")) {
			//create object for mother and add to list of people
			var mother = getPerson(family.mother);
			data.people.push(mother);

			//add mother's family to list to do
			if (mother.hasOwnProperty("childOf")) {
				familiesToDo.push(mother.childOf);
			}

			//add link from mother to family
			data.links.push({
				"source": mother,
				"target": family
			});
		}

		for (var child in family.children) {
			if (family.children.hasOwnProperty(child)) {
				//create child object and add to list of people
				child = getPerson(child);
				data.people.push(child);

				//add links from family to children
				data.links.push({
					"source": family,
					"target": child
				});
			}
		}
	}
};

var setupGraph = function() {
	var margin = {top: 20, right: 20, bottom: 30, left: 50},
		width = 1200 - margin.left - margin.right,
		height = 600 - margin.top - margin.bottom;

	var svg = d3.select("body").append("svg:svg")
		.attr({
			"width": width + margin.left + margin.right,
			"height": height + margin.top + margin.bottom
		});

	var force = d3.layout.force()
		.gravity(0.05)
		.distance(100)
		.charge(-100)
		.size([svg.width, svg.height])

		.nodes(data.people + data.families)
		.links(data.links)

		.start();

	svg.append("g")
		.attr({"class": "main",
			"transform": "translate(" + margin.left + "," + margin.top + ")"
		});

	var link = svg.select(".main").selectAll(".link")
		.data(data.links)
		.enter().append("line")
		.attr("class", "link");

	var people = svg.select(".main").selectAll(".person")
		.data(data.people, function(d) { return d.handle; })
		.enter().append("g")
		.attr({
			"class": "person",
			"id": function(d) { return d.handle; }
		});

	var families = svg.select(".main").selectAll(".family")
		.data(data.families, function(d) { return d.handle; })
		.enter().append("g")
		.attr({
			"class": "family",
			"id": function(d) { return d.handle; }
		});

	people.append("text")
		.text("P");

	families.append("text")
		.text("+");

	force.on("tick", function() {
		link.attr("x1", function(d) { return d.source.x; })
			.attr("y1", function(d) { return d.source.y; })
			.attr("x2", function(d) { return d.target.x; })
			.attr("y2", function(d) { return d.target.y; });

		people.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
		});
		families.attr("transform", function(d) {
			return "translate(" + d.x + "," + d.y + ")";
		});
	});

	return svg;
};

d3.xml('data/family-tree.gramps', parseData);

setupGraph();
