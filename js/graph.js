/* global d3 */
/* global $ */

var tcGraphs = (function(){
	'use strict';

	var getWeekDatum = function(day, hour) {
		var curWeekStart = new Date();
		var curOffset = ((curWeekStart.getDay() - day) % 7);
		curWeekStart.setDate(curWeekStart.getDate() - curOffset);
		curWeekStart.setHours(hour);
		curWeekStart.setMinutes(0);
		curWeekStart.setSeconds(0);
		curWeekStart.setMilliseconds(0);

		return curWeekStart;
	};

	var getWeek = function(date) {
		return Math.floor((date - datum) / (7 * 24 * 60 * 60 * 1000), 10);
	};

	var decHours = function(s) {
		if (typeof s === "string") {
			var parts = s.split(":");
			if (parts.length === 3) {
				return parts[0] + 60 * (parts[1] + (parts[2] * 60));
			}
		} else {
			return null;
		}
	};

	var tcParseDate = function(dateString) {
		var parts = dateString.split(/-| |:/g);
		var iParts = parts.map(function(el){
			return parseInt(el, 10);
		});

		return new Date(iParts[0], iParts[1]-1, iParts[2], iParts[3], iParts[4], iParts[5], 0);
	};

	var parseData = function(string) {
		var xml = $.parseXML(string);
		var $xml = $(xml);

		data = [];

		$xml.find('task').each(function(i, task) {
			var $task = $(task);
			var taskData = {
				id: task.getAttribute('id'),
				name: task.getAttribute('subject'),
			budget: decHours(task.getAttribute('budget')),
				cumAll: {line: [], efforts: []},
				cumWeek: []
			};

			if ($task.children('description').length > 0) {
				taskData.description = $task.children('description')[0].innerHTML;
			} else {
				taskData.description = "";
			}

			var efforts = [];
			$(task).find('effort').each(function(i, effort){
				var p = {start: tcParseDate(effort.getAttribute('start'))};

				if (effort.hasAttribute("stop")){
					p.stop = tcParseDate(effort.getAttribute('stop'));
				} else {
					p.stop = new Date();
				}

				efforts.push(p);
			});

			//efforts aren't stored in order
			efforts.sort(function(a, b){
				return a.start - b.start;
			});

			//sum effort time cumulatively
			var timeSum = 0, weekSum = 0, weekI = 0,
				tempWeek = {week: weekI, line: [], efforts: []},
				tempX = new Date(datum);

			efforts.forEach(function(el){
				el.week = getWeek(el.start);

				//moving to new week
				if (el.week !== weekI) {

					if (tempWeek.line.length){
						//extend line to end of week
						tempX.setDate(tempX.getDate() + ((weekI + 1) * 7));
						tempWeek.line.push({x: tempX, y: weekSum});

						//store week line
						taskData.cumWeek.push(tempWeek);
						//reset tempX
						tempX = new Date(datum);
					}

					weekSum = 0;
					weekI = el.week;
					tempWeek = {week: weekI, line: [], efforts: []};

					//start line at start of week
					tempX.setDate(tempX.getDate() + (weekI * 7));
					tempWeek.line.push({x: tempX, y: 0});
					//reset tempX
					tempX = new Date(datum);
				}

				el.time = ((el.stop - el.start) / 1000 / 60 / 60);
				el.cumSum = timeSum + el.time;
				el.weekSum = weekSum + el.time;
				//cumulatively sum all data
				taskData.cumAll.efforts.push([{x: el.start, y: timeSum}, {x: el.stop, y: el.cumSum}]); //add effort
				taskData.cumAll.line.push({x: el.start, y: timeSum}); //add start of effort
				taskData.cumAll.line.push({x: el.stop, y: el.cumSum}); //add end of effort

				//segment sums by week
				tempWeek.efforts.push([{x: el.start, y: weekSum}, {x: el.stop, y: el.weekSum}]); //add effort
				tempWeek.line.push({x: el.start, y: weekSum}); //add start of effort
				tempWeek.line.push({x: el.stop, y: el.weekSum}); //add end of effort

				timeSum = el.cumSum;
				weekSum = el.weekSum;
			});

			//extend line to end of week
			tempX.setDate(tempX.getDate() + ((weekI + 1) * 7));
			tempWeek.line.push({x: tempX, y: weekSum});

			taskData.cumWeek.push(tempWeek);

			data.push(taskData);
		});
	};

	var markerCircle = function() {
		var radius = 1;
		var task = this.parentElement.parentElement.parentElement;

		d3.select(this.viewportElement).selectAll("defs").selectAll("#marker" + task.id)
			.data([task.id])
			.enter().append("marker")
			.attr({"id": ("marker" + task.id),
				"refX": radius,
				"refY": radius,
				"markerWidth": radius*2,
				"markerHeight": radius*2,
				"orient": "auto"})
			.style("fill", task.style.stroke)
			.append("circle")
				.attr({"r": radius,
					"cx": radius,
					"cy": radius});

		return "url(#marker" + task.id + ")";
	};


	// Create custom bisector
	var bisect = d3.bisector(function(d) {
		return d.x;
	}).left;

	var mousemove = function() {
		var x0 = x.invert(d3.mouse(this)[0]),
		curWeek = getWeek(x0);

		graph.selectAll(".focusDots circle")
			.each(function(d) {

				//find correct week line for this task
				var line;

				d.cumWeek.some(function(week) {
					if (week.week === curWeek) {
						line = week.line;
						return false;
					}
					return true;
				});

				if (line === undefined) {
					d3.select(this).classed("display-none", true);
					return false;
				}

				//set up variables to find point along week line to highlight
				var j = bisect(line, x0),
				d0 = line[j - 1],
				d1 = line[j],
				y0;

				if (d0 !== undefined && d1 !== undefined) {
					y0 = ((x0 - d0.x) / (d1.x - d0.x) * (d1.y - d0.y)) + d0.y;
					d3.select(this).classed("display-none", false)
						.attr("transform", "translate(" + x(x0) + "," + y(y0) + ")")
						.select("text").text(y0);
				} else {
					d3.select(this).classed("display-none", true);
				}
			});
	};

	var setupGraph = function(svg) {
		svg.append("defs");

		//create group for focus elements
		var focus = svg.append("g")
			.attr("class", "focus")

		focus.append("g")
			.attr("class", "focusDots");

		focus.append("path")
			.attr({"class": "cursorLine"});

		svg.append("rect")
			.attr({"class": "overlay",
				"width": "100%",
				"height": "100%"
			})
			.on("mouseover", function() { graph.classed("mouseover", true); })
			.on("mouseout", function() { graph.classed("mouseover", false); })
			.on("mousemove", mousemove);

		return svg;
	};

	var updateGraph = function() {

		//create new focus dots
		graph.select(".focusDots").selectAll("circle")
			.data(data, function(d) {
				return d.id;
			})
			.enter().append("circle")
			.attr("r", 4.5)
			.style("stroke", function(d) { return color(d.id); })
			.append("text")
			.attr({
				"x": 9,
				"dy": ".35em"
			});

		//create new task groups
		graph.select(".main").selectAll(".task")
			.data(data, function(d) {return d.id;})
			.enter().append("g")
			.attr({
				"class": "task",
				"id": function (d) { return (d.id); }
			})
			.style("stroke", function (d) { return color(d.id); });

		var tasks = graph.selectAll(".task");

		//create new week groups
		var newWeeks = tasks.selectAll(".week")
			.data(function(d) { return d.cumWeek; })
			.enter().append("g")
			.attr({
				"class": "week",
				"id": function (d) { return (d3.select(this.parentNode).datum().id + "_" + d.week); }
			});

		//draw new week lines
		newWeeks.append("path")
			.attr({
				"class": "weekLine",
				"d": function (d) { return line(d.line);}
			});

		//create new effort groups
		newWeeks.append("g")
			.attr({
				"class": "efforts"
			});

		//create and update effort lines
		graph.selectAll(".efforts")
			.selectAll(".effort")
			.data(function(d) {return d.efforts; })
			.enter().append("path")
			.attr({
				"class": "effort",
				"d": function(d) { return line(d); },
				"marker-start": markerCircle,
				"marker-end": markerCircle
			});
	};

	var makeGraph = function() {
		var margin = {top: 20, right: 20, bottom: 30, left: 50},
			width = 1200 - margin.left - margin.right,
			height = 600 - margin.top - margin.bottom;

		x = d3.time.scale()
			.range([0, width]);

		y = d3.scale.linear()
			.range([height, 0]);

		var xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom")
			.tickFormat(function(d) {
				return d3.time.format('%x')(new Date(d));
			});

		var yAxis = d3.svg.axis()
			.scale(y)
			.orient("left")
			.tickFormat(function(d) {
				var hour = String(parseInt(d, 10));
				var minute = d3.format("02d")((d - hour) * 60);
				return hour + ":" + minute;
			});

		line.x(function (d) {
			return x(d.x);
		})
			.y(function (d) {
			return y(d.y);
		});

		color.domain(data.map(function (d) { return d.id; }));

		var minX = d3.min(data, function (kv) { return d3.min(kv.cumAll.line, function (d) { return d.x; }); });
		var maxX = d3.max(data, function (kv) { return d3.max(kv.cumAll.line, function (d) { return d.x; }); });
		var minY = d3.min(data, function (kv) { return d3.min(kv.cumAll.line, function (d) { return d.y; }); });
		var maxY = d3.max(data, function (kv) { return d3.max(kv.cumAll.line, function (d) { return d.y; }); });

		x.domain([minX, maxX]);
		y.domain([minY, maxY]);

		d3.select('#week_cumulative').remove();

		graph = d3.select(".graphs").append("svg:svg")
			.attr({
				"id": "week_cumulative",
				"width": width + margin.left + margin.right,
				"height": height + margin.top + margin.bottom
			});

		graph.append("g")
			.attr({"class": "main",
				"transform": "translate(" + margin.left + "," + margin.top + ")"
			});

		setupGraph(graph);

		graph.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")")
			.call(xAxis);

		graph.append("g")
			.attr("class", "y axis")
			.call(yAxis)
			.append("text")
				.attr("transform", "rotate(-90)")
				.attr("y", 6)
				.attr("dy", ".71em")
				.style("text-anchor", "end")
				.text("Time spent on task");
/*
		var line = {
			'x1':(function(d) { return x( labl.x ); }),
			'y1':(function(d) { return y( maxY ); }),
			'x2':(function(d) { return x( labl.x ); }),
			'y2':(function(d) { return y( minY) }),
			}


		var label = svg.selectAll(".labels")
			  .data(labels)
			  .enter();

		label.append("svg:line")
				.attr("x1", line.x1)
				.attr("y1", line.y1)
				.attr("x2", line.x2)
				.attr("y2", line.y2)
			.attr("class","label-line");

		weekCSvg.append("g")
			.attr({"class": "guidelines"})
			.call()
*/

	};


	var handleFileSelect = function(evt) {
		$('#file-name').html($('#file').val());

		file = evt.target.files[0]; // file object

		reader = new FileReader();

		reader.onload = function() {
			parseData(reader.result);

			if (graph === undefined) {
				makeGraph();
			}

			updateGraph();
		};

		reader.readAsText(file);
	};

	var reloadData = function() {
		if (file !== 'undefined'){
			reader.readAsText(file);
		}
	};

	var data, graph, x, y,
		datum = getWeekDatum(5, 12),
		color = d3.scale.category10(),
		line = d3.svg.line().interpolate("linear"),
		file,
		reader;


	$('#file').change(handleFileSelect);

	$(window).load(function () {
		$('#browse-click').on('click', function () { // use .live() for older versions of jQuery
			$('#file').click();
			return false;
		});

		$('#refresh').on('click', reloadData);
	});

})();