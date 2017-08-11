// This file contains functions for handling charts and graphs


function initializeChart( chart, labelX, labelY, columnNames, columnColors ){

	var emptyData = new Array(chart.domainX).fill(0);

	var width = $(chart.wrapperId).width();
	var height = $(chart.wrapperId).height();

	var zoom = d3.zoom()
		.scaleExtent([1, 5])
		.translateExtent([[0, 0], [width, height]])
		.on("zoom", function(){
			d3.select(chart.wrapperId).selectAll(".graphLine").attr("transform", d3.event.transform);
			gX.call(xAxis.scale(d3.event.transform.rescaleX(chart.xScale)));
			gY.call(yAxis.scale(d3.event.transform.rescaleY(chart.yScale)));
		})

	graph = d3.select(chart.wrapperId).append("svg")
		.attr("width", "100%").attr("height", "100%")

	chart.xScale = d3.scaleLinear().domain([chart.domainX, 0]).range([-5, width-20]); 
	chart.yScale = d3.scalePow().domain([chart.domainY, 0]).range([0, height-41]);
	chart.yScale.exponent([ (logScaleCharts && chart.logScalePossible) ? 0.5 : 1 ]);

	var xAxis = d3.axisBottom(chart.xScale)
		.ticks(10)
		.tickFormat(function(d){
			if(d == 0 || d == chart.domainX){
				return "";
			}
			var time = Math.floor(d/60)%3600 + "m";
			if(d%60 != 0 ){
				time += ", " + d%60 + "s"
			}
			if(d>3600){
				time = Math.floor(d/3600) + "h, " + time;
			}
			return time;
		})
		.tickSize(2*height - 20)
		.tickPadding(8 - height);


	var yAxis = d3.axisRight(chart.yScale)
		// .ticks(12)
		.tickFormat(function(d){ 
			if (d < 0 || d == chart.domainY){ 
				return "";
			} else {
				return d >= 1000 ? (d/1000).toFixed(1) + "k" : d;
			}
		})


	// legend and text labels for the axes, animated chart is wonky so we add them outside the svd
	var labelXDiv = $("<div></div>")
		.addClass("axisLabel")
		.css({ "transform":"translate( -30px, -20px)" })
		.text(labelX);
	$(chart.wrapperId).append(labelXDiv);

	var labelYDiv = $("<div></div>")
		.addClass("axisLabel")
		.css({ "transform":"translate( " + (width/2 -14) + "px, " + (-height/2 -30) + "px) rotate(90deg)" })
		.text(labelY);
	$(chart.wrapperId).append(labelYDiv);

	var legend = $("<ul></ul>")
		.addClass("legend")
		.css({ "transform":"translate( 10px, " + (-height ) + "px)" })
	$(chart.wrapperId).append(legend);

	// display one shape per data column by appending it to a path element
	for (var i = 0; i < columnNames.length; i++) {

		if(chart.type == "area"){

			graph.append("path")
				.attr("class", "graphLine line_" + i) // Assign classes for styling 
				.attr("style", "stroke-width:1; fill-opacity:0.8; fill:" + columnColors[i] + "; stroke:" + columnColors[i])

		} else if(chart.type == "line"){

			graph.append("path")
				.attr("class", "graphLine line_" + i) // Assign classes for styling 
				.attr("style", "stroke-width:3; fill:none; stroke:" + columnColors[i])
		}


		var legendItem = $("<li></li>")
			.addClass("legendItem")
			.addClass("legend_" + i)
		legendItem
			.append("<span class='legendText'>" + columnNames[i] + "</span>")
			.append("<span class='legendColor' style='background-color:" + columnColors[i] + "'></span>")

		legend.append(legendItem)
	}

	// draw the actual axes and rectangles to hide everything behind them
	graph.append("rect")
		.attr("class", "x axisBgRect statics")
		.attr("width", width)
		.attr("transform","translate( 0, " + (height-40) + ")")
		.attr("height",40);

	graph.append("rect")
		.attr("class", "x axisRect statics")
		.attr("width", width-54)
		.attr("transform","translate( 0, " + (height-40) + ")")
		.attr("height",1);

	graph.append("rect")
		.attr("class", "y axisBgRect statics")
		.attr("width", 74)
		.attr("height",height)
		.attr("transform","translate(" + (width-65) + ")")

	graph.append("rect")
		.attr("class", "y axisRect statics")
		.attr("width", 1)
		.attr("height",height-40)
		.attr("transform","translate(" + (width-65) + ")")

	// display the axes
	var gX = graph.append("g")
		.attr("class", "x axis")
		.attr("transform","translate( 0," + (-20) + ")")
		.call(xAxis); // Create the X axis markers

	var gY = graph.append("g")
		.attr("class", "y axis")
		.attr("transform","translate(" + (width -60) + ")")
		.call(yAxis); // Create the Y axis markers

	graph.call(zoom);
}


function refreshChart(chart, dataColumns, hiddenColumns ){

	var graph = d3.select(chart.wrapperId).select("svg");
	var path = graph.selectAll(".graphLine").data(dataColumns)

	// create a shape object that represents the SVN shape we're creating
	if(chart.type == "area"){

		var shape = d3.area()
			.x(function(d,i) { return chart.xScale(i); })
			.y1(function(d) { return chart.yScale(d); })
			.y0(chart.yScale(0))
			.curve(d3.curveCardinal)

	} else if(chart.type == "line"){

		var shape = d3.line()
			.x(function(d,i) { return chart.xScale(i); })
			.y(function(d) { return chart.yScale(d); })
			.curve(d3.curveBasis)
	}

	var scale = 1/d3.zoomTransform(graph.node()).k;
	var offset1 = chart.xScale(chart.domainX + 24*scale*scale) * d3.zoomTransform(graph.node()).k;
	var offset2 = chart.xScale(chart.domainX + 1 + 24*scale*scale) * d3.zoomTransform(graph.node()).k;

	// Non continuous animated graph
	if(!animatedChartRefresh){

		graph.attr("transform", "translate(" + offset1 + ")") 	// move the whole svg left to bring out the line
		graph.selectAll("text, .statics").attr("x", -offset1 )	// put statics back where they were, relatively
		
		path.attr("d", shape); // update values directly

	} else {

		// We want to show a continuous animated graph, but zoom functionality uses translate()
		// Therefore, we have only one logical option: move the entire graph and animate it
		// Elements that need to remain static (text and axes) are animated in reverse

		graph.attr("transform", "translate(" + offset1 + ")") 	// set the transform to right, hide the new value
		var statics = graph.selectAll("text, .statics")			// put statics back where they were, relatively
			.attr("x", -offset1 ) 


		path.attr("d", shape) 				// apply the new data values

		graph
			.transition() 					// start a transition to bring the new value into view
			.ease(d3.easeLinear)
			.duration(980 * settings.refreshPeriod) 	// continual slide, refreshPeriod (in ms) minus 2% for animation delay
			.attr("transform", "translate(" + offset2 + ")"); // animate slide back left, reveal the new value

		statics
			.transition() 					// start the reverse transition to keep statics in their positions
			.ease(d3.easeLinear)
			.duration(980 * settings.refreshPeriod) 	// continual slide, refreshPeriod (in ms) minus 2% for animation delay
			.attr("x", -offset2 ); 			// animate slide back right, hold your ground
	}



	if(hiddenColumns !== undefined){

		$(chart.wrapperId + ' .graphLine').css({"visibility":"visible"});
		$(chart.wrapperId + ' .legendItem').css({"display":"block"});

		for (var i = 0; i < hiddenColumns.length; i++) {
			
			$(chart.wrapperId + ' .graphLine.line_' + hiddenColumns[i]).css({"visibility":"hidden"});
			$(chart.wrapperId + ' .legend_' + hiddenColumns[i]).css({"display":"none"});
		}
	}
}


function toggleChartZoom(chart){

	chart.yScale.exponent([ (logScaleCharts && chart.logScalePossible) ? 0.5 : 1 ]);

	resetScaleY(chart);
}

function resetScaleY(chart){

	var yAxis = d3.axisRight(chart.yScale)
		.ticks(12)
		.tickFormat(function(d){ 
			if (d < 0 || d == chart.domainY){ 
				return "";
			} else {
				return d >= 1000 ? (d/1000).toFixed(1) + "k" : d;
			}
		})

	d3.select(chart.wrapperId).select("svg").select(".y.axis").call(yAxis.scale(chart.yScale));
}