$( document ).ready( function() {

	var waitPeriod = 2; // s, time to wait for state changes
	var refreshPeriod = 1; // s, time to wait between data retrieval (1Hz)

	var smoothChartRefresh = false;
	var logScaleCharts = true;
	
	var timer;
	var lastUpdateTime = 0;
	var settings = [];
	var dataset = {
		'general':{'total':[], 'matched':[], 'limited':[], 'tweetRate':[], 'matchedRate':[], 'startTime':0},
		'groups':[],
		'newsItems':[],
		'feedsNumber':0
	};
	var chartList = {
		'general':{
			'wrapperId':"#generalStatisticsChart",
			'domainX':0,
			'domainY':4000,
			'xScale':{},
			'yScale':{},
			'type': "area"
		}
	}

	// ============ Helper Functions ============

	function rgb2hex(rgb) {
		var rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

		function hex(x) {
			return ("0" + parseInt(x).toString(16)).slice(-2);
		}
		return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
	}

	function randomColor( digits ) {

		if ( digits === undefined ) {

			digits = '0123456789ABCDEF';
		}
		var color = '#';

		for ( var i = 0; i < 6; i++ ) {
			color += digits[ Math.floor( Math.random() * digits.length ) ];
		}

		return color;
	}

	function mergeColors( colorString ) {

		var colors = colorString.split(",");
		var result = {'red': 0, 'green': 0, 'blue': 0};

		for (var i = 0; i < colors.length; i++) {
			
			result.red += parseInt(colors[i].substring(1,3), 16);
			result.green += parseInt(colors[i].substring(3,5), 16);
			result.blue += parseInt(colors[i].substring(5), 16);
		}

		result.red /= i;
		result.green /= i;
		result.blue /= i;

		var finalColor = "#" + Math.round(result.red).toString(16) 
			+ Math.round(result.green).toString(16)
			+ Math.round(result.blue).toString(16);

		return finalColor;
	}

	// ============ Visual Functions ============

	function flashError( element, color ) {

		if ( color === undefined ) {

			color = 'white';
		}
		element.css( { "background-color": "red" } );
		element.fadeIn( 0 ).delay( 200 ).promise().then( function() {
			$( this ).css( { "background-color": color } );
		} );
	}

	function showStatus( status ) {

		if ( status.error !== undefined ) {

			showError( status.error );
		} else {

			$( ".error.box" ).hide();
		}

		switch ( status.state ) {
			case "off":

				$( ".action.message" ).hide();
				$( ".start.button, .stop.button, .reset.button" ).hide();
				$( ".boot.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 1000 );
				$( ".spinner .circle" ).css( { "background-color": "#000", "width": "110px", "height": "110px", "border-radius": "55px" } );
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 1200 ).fadeIn();
				$( ".spinner .circle .status" ).text( "Offline" );
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".data, .control, .info" ).hide();
				$( ".help" ).show();

				$( ".error" ).empty();
				$( ".info" ).empty();
				break;

			case "boot":

				$( ".button" ).hide();
				$( ".action.message" ).text( "Initializing..." );
				$( ".action.message" ).css( { "color": "#F44" } );
				$( ".action.message" ).fadeIn();

				$( ".spinner .ring" ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "background-color": "#F44", "width": "50px", "height": "50px", "border-radius": "25px" } );
				$( ".spinner .circle .status" ).stop().hide();

				$( ".data, .control, .error, .info" ).hide();
				$( ".help" ).fadeOut();
				break;

			case "idle":

				$( ".action.message" ).hide();
				$( ".boot.button, .stop.button, .reset.button" ).hide();
				$( ".start.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 1000 );
				$( ".spinner .circle" ).css( { "background-color": "#28F", "width": "110px", "height": "110px", "border-radius": "55px" } );
				$( ".spinner .circle .status" ).hide();
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 1200 ).fadeIn();
				$( ".spinner .circle .status" ).text( "Ready" );
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".help, .data, .error, .info" ).hide();
				$( ".control" ).show();
				break;

			case "prepare":

				$( ".button" ).hide();
				$( ".action.message" ).text( "Processing..." );
				$( ".action.message" ).css( { "color": "white" } );
				$( ".action.message" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "background-color": "#FAA43A", "width": "50px", "height": "50px", "border-radius": "25px" } );
				$( ".spinner .circle .status" ).stop().hide();

				$( ".help, .data, .error, .info" ).hide();
				$( ".control" ).fadeOut();
				break;

			case "live":

				$( ".action.message" ).hide();
				$( ".boot.button, .start.button, .reset.button" ).hide();
				$( ".stop.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "width": "110px", "height": "110px", "border-radius": "55px", "background-color": "#1A0" } );
				$( ".spinner .circle .status" ).fadeOut( 1 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".help, .control, .error, .info" ).hide();
				$( ".data" ).fadeIn();

				$( ".tabControls .generalData" ).click(); 
				break;

			case "done":

				$( ".action.message" ).hide();
				$( ".start.button, .stop.button, .boot.button" ).hide();
				$( ".reset.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 1000 );
				$( ".spinner .circle" ).css( { "background-color": "#1A0", "width": "110px", "height": "110px", "border-radius": "55px" } );
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle .status" ).text( "Done" );
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".help, .control, .error, .info" ).hide();
				$( ".data" ).show();
				break;
		}
	}

	function showError( errorText ) {

		var errorWrapper = $( "<div></div>" ).html( errorText );
		errorWrapper.find( "style, title" ).remove();

		$( ".error.box" ).append( errorWrapper );
		$( ".error.box" ).show();
	}

	function showInfo( infoText ) {

		$( ".info.box" ).append( infoText );
		$( ".info.box" ).show();
	}

	// ------------ Group Management ------------

	function addGroup( name, color ) {

		// check everything's provided
		if ( name != "" && color != "" ) {

			var group = $(
				'<li class="group">' +
				'<span class="name">' + name + '</span>' +
				'<span class="delete"></span>' +
				'<ul class="feeds">' +
				'<li class="feed new">' +
				'<a class="add"></a>' +
				'<input type="text" name="url" value="">' +
				'</li>' +
				'</ul>' +
				'</li>'
			);
			group.find( ".delete" ).click( removeGroup );
			group.find( ".new.feed .add" ).click( function( event ) {

				var thisGroup = $( event.target ).parents( ".group" );
				var url = $( event.target ).siblings( "input" ).val();
				addFeed( thisGroup, url );
			} );

			if ( parseInt( color[ 1 ], 16 ) + parseInt( color[ 3 ], 16 ) + parseInt( color[ 5 ], 16 ) < 25 ) {

				group.find( ".name" ).css( { "color": "white" } );
			}
			group.css( { "background-color": color } );

			$( ".groups" ).append( group );

			// Set a new random (but nice) color for the next group
			$( "#groupColor" ).val( randomColor() );

			return group;

		} else { // Error in group addition

			flashError( $( "#groupName" ) );
		}
	}

	function removeGroup( event ) {

		$( event.target ).parent().remove();
	}

	function addFeed( group, url ) {

		// check url
		if ( url !== "" ) {

			var feed = $(
				'<li class="feed">' +
				'<a class="remove"></a>' +
				'<span class="url">' + url + '</span>' +
				'</li>'
			);
			feed.find( ".remove" ).click( removeFeed );

			feed.insertBefore( group.find( ".feed.new" ) );

			return feed;

		} else {

			flashError( group.find( ".feed.new input" ) );
		}
	}

	function removeFeed( event ) {

		$( event.target ).parent().remove();
	}

	function getGroups() {

		var newGroups = [];

		$( ".group" ).each( function() {

			var name = $( this ).find( ".name" ).text();
			var color = rgb2hex( $( this ).css( "background-color" ) );
			var group = { "name": name, "color": color, "feedUrls": [] };
			var feeds = [];

			// loop through rss feed urls and add them
			$( this ).find( ".feed:not(.new)" ).each( function() {

				var url = $( this ).find( ".url" ).text();

				if ( url != "" ) {

					feeds.push( url );

				} else {

					flashError( $( this ) );
					return false;
				}
			} );

			// check results for empty items
			if ( name != "" && feeds.length > 0 ) {

				group.feedUrls = feeds;
				newGroups.push( group );

			} else {

				flashError( $( this ), $( this ).css( "background-color" ) );
				return false;
			}
		} );

		if ( newGroups.length > 0 ) {

			return newGroups;

		} else {

			flashError( $( ".groups" ), $( ".groups" ).css( "background-color" ) );
			return false;
		}
	}

	function getSettings() {

		var newSettings = { "date": "", "updatePeriod": 0, "updatePeriod": 0, "newsThreshold": 0, "tweetThreshold": 0 };


		newSettings.date = $( ".date :selected" ).val();

		var updatePeriod = $( "#updatePeriod" ).val();
		if ( updatePeriod != "" && typeof parseInt( updatePeriod ) == "number" ) {

			newSettings.updatePeriod = updatePeriod;

		} else {
			flashError( $( "#updatePeriod" ) );
			return false;
		}

		var refreshPeriod = $( "#refreshPeriod" ).val();
		if ( refreshPeriod != "" && typeof parseInt( refreshPeriod ) == "number" ) {

			newSettings.refreshPeriod = refreshPeriod;

		} else {
			flashError( $( "#refreshPeriod" ) );
			return false;
		}

		var windowPeriod = $( "#windowPeriod" ).val();
		if ( windowPeriod != "" && typeof parseInt( windowPeriod ) == "number" ) {

			newSettings.windowPeriod = windowPeriod*60; // minutes to seconds

		} else {
			flashError( $( "#windowPeriod" ) );
			return false;
		}

		var newsThreshold = $( "#newsThreshold" ).val();
		if ( newsThreshold != "" && typeof parseFloat( newsThreshold ) == "number" ) {

			newSettings.newsThreshold = newsThreshold;

		} else {
			flashError( $( "#newsThreshold" ) );
			return false;
		}

		var tweetThreshold = $( "#tweetThreshold" ).val();
		if ( tweetThreshold != "" && typeof parseFloat( tweetThreshold ) == "number" ) {

			newSettings.tweetThreshold = tweetThreshold;

		} else {
			flashError( $( "#tweetThreshold" ) );
			return false;
		}

		return newSettings;
	}

	function applyPreset1() {

		$( ".group" ).remove();

		var group1 = addGroup( "BBC", "#a91717" );
		addFeed( group1, "http://feeds.bbci.co.uk/news/rss.xml" );
		addFeed( group1, "http://feeds.bbci.co.uk/news/world/rss.xml" );

		var group2 = addGroup( "Fox News", "#fff45b" );
		addFeed( group2, "http://feeds.foxnews.com/foxnews/latest?format=xml" );

		$( ".date option[value='today']").prop('selected', true);

		$( "#updatePeriod" ).val( "5" );
		$( "#refreshPeriod" ).val( "1" );
		$( "#windowPeriod" ).val( "10" );
		$( "#newsThreshold" ).val( "0.3" );
		$( "#tweetThreshold" ).val( "0.1" );
	}

	// ------------ Data Management -------------

	function toggleChartZoom(chart){

		chart.yScale.exponent([ logScaleCharts ? 0.5 : 1 ]);

		var yAxis = d3.axisRight(chart.yScale)
			.ticks(12)
			.tickFormat(function(d){ 
				if (d < 0 || d == chart.domainY){ 
					return "";
				} else {
					return d >= 1000 ? (d/1000).toFixed(1) + "k" : d;
				}
			})
		
		d3.select(chart.wrapperId).select("svg")
			.select(".y.axis").call(yAxis.scale(chart.yScale));
	}

	// ============ Action Handlers =============

	$( ".boot.button" ).click( boot );
	$( ".start.button" ).click( start );

	$( ".tabControls .generalData" ).click(function(){ 

		$( ".content .data.general" ).show()
		$( ".content .data.groupData" ).hide()
		$( ".content .data.newsData" ).hide()
	})
	$( ".tabControls .groupData" ).click(function(){ 

		$( ".content .data.general" ).hide()
		$( ".content .data.groupData" ).show()
		$( ".content .data.newsData" ).hide()
	})
	$( ".tabControls .newsItemData" ).click(function(){ 

		$( ".content .data.general" ).hide()
		$( ".content .data.groupData" ).hide()
		$( ".content .data.newsData" ).show()
	})

	$(window).on("keyup", function(e){ 
		if(e.which == 49){ // toggle log - linear chart scale on "1"

			logScaleCharts = !logScaleCharts;

			toggleChartZoom(chartList.general)

		} else if(e.which == 50){ // toggle smooth - chunky charts
			smoothChartRefresh = !smoothChartRefresh;
		}
	})

	// ------------------------------------------

	// Add group
	$( ".new.source .add" ).click( function() {

		addGroup( $( "#groupName" ).val(), $( "#groupColor" ).val() );
	} );

	// Delete group
	$( ".group .delete" ).click( removeGroup );

	// Add feed
	$( ".new.feed .add" ).click( function( event ) {

		var group = $( event.target ).parents( ".group" );
		var url = $( event.target ).siblings( "input" ).val();
		addFeed( group, url );

	} );

	// Remove feed
	$( ".feed .remove" ).click( removeFeed );

	// Presets
	$( ".preset._1" ).click( applyPreset1 );
	$( ".preset._2" ).click( function() {

		console.log( $( ".date :selected" ).val() ); // DEBUG ONLY
	} );

	// =========== Control Functions ============

	function getAPI( url, callback ) {

		$.get( {
			url: url,
			dataType: "json",
			error: function( error ) {

				showError( error.responseText ? error.responseText : "Server process unreachable!" );
			},
			success: function( data ) {

				callback( data );
			}
		} );
	}


	function boot() {

		$.post( {
			url: "boot",
			dataType: "json",
			error: function( error ) {

				showError( error.responseText ? error.responseText : "Server process unreachable!" );
			},
			success: function( status ) {

				if ( status.state == "off" ) {

					status[ 'error' ] = "Nothing Happened";
					showStatus( status );

				} else {

					// wait until system booted
					waitUntilState( "idle", function( status ){

						// when system is ready, show it
						showStatus( status );
					});
				}
			}
		} );
	}

	function start() {

		var groupsResult = getGroups();
		var settingsResult = getSettings();

		if ( !groupsResult || !settingsResult ) {

			return false;
		}

		$.post( {
			url: "start",
			data: JSON.stringify( { "groups": groupsResult, "settings": settingsResult } ),
			dataType: "json",
			error: function( error ) {

				showError( error.responseText ? error.responseText : "Server process unreachable!" );
			},
			success: function( status ) {

				if ( status.state == "idle" ) {

					status[ 'error' ] = "Nothing Happened";
					showStatus( status );

				} else {

					// Show loading...
					showStatus( status );

					// wait until keyword extraction is done
					waitUntilState( "setup", function( status ){

						// when keyword extraction is done, show a message
						showInfo("Extracting news items and keywords from provided feeds...");
					});	

					// wait until live processing starts
					waitUntilState( "live", function( status ){

						// when news items are ready, load them and start live processing
						showStatus(status);
						initializeData();
					});	
				}

			}
		} );
	}

	function waitUntilState( state, callback ) {

		getAPI( "status", function( status ) {

			if ( status.state != state ) { // wait some more

				setTimeout( function(){

					waitUntilState(state, callback)	
				}, waitPeriod * 1000 );

			} else { // state reached

				callback( status );
			}
		} ); // TODO error handling
	}

	function initializeData() {

		getAPI( "init", function( data ) {

			settings = data.settings;

			// ---------------- General Statistics ----------------

			// store starting time
			dataset.general.startTime = data.statuses[0][4];

			// prepare data buffers according to window size, "recent" data are in 1/20th of window
			var bufferSize = Math.floor(settings.windowPeriod / settings.refreshPeriod);
			var shortWindow = Math.floor(0.05 * settings.windowPeriod / settings.refreshPeriod);

			dataset.general.total = new Array(bufferSize).fill(0);
			dataset.general.matched = new Array(bufferSize).fill(0);
			dataset.general.limited = new Array(bufferSize).fill(0);

			// calculate final totals
			for (var i = 0; i < data.statuses.length; i++) {
				dataset.general.total[0] += data.statuses[i][1];
				dataset.general.matched[0] += data.statuses[i][2];
				dataset.general.limited[0] += data.statuses[i][3];
			}

			// populate the buffers
			for (var i = 1; i < bufferSize/settings.updatePeriod; i++) {

				var bufferStep = i*settings.updatePeriod;
				if(data.statuses.length-i < 0){

					dataset.general.total[bufferStep] = 0;
					dataset.general.matched[bufferStep] = 0;
					dataset.general.total[bufferStep] = 0;

				} else if(data.statuses.length-i > 0){
					// store the true value at the appropriate position
					dataset.general.total[bufferStep] = dataset.general.total[bufferStep - settings.updatePeriod]
						- data.statuses[data.statuses.length - i][1];
					dataset.general.matched[bufferStep] = dataset.general.matched[bufferStep - settings.updatePeriod]
						- data.statuses[data.statuses.length - i][2];
					dataset.general.limited[bufferStep] = dataset.general.limited[bufferStep - settings.updatePeriod]
						- data.statuses[data.statuses.length - i][3];

					// interpolate the rest of the values
					for (var j = 1; j < settings.updatePeriod; j++) {

						// interpolation weights
						var wNew = 1 - j/settings.updatePeriod;
						var wOld = j/settings.updatePeriod;

						// produce interpolated value
						dataset.general.total[bufferStep-j] = 
							wNew * dataset.general.total[bufferStep]
							+ wOld * dataset.general.total[bufferStep - settings.updatePeriod]
						dataset.general.matched[bufferStep-j] = 
							wNew * dataset.general.matched[bufferStep]
							+ wOld * dataset.general.matched[bufferStep - settings.updatePeriod]
						dataset.general.limited[bufferStep-j] = 
							wNew * dataset.general.limited[bufferStep]
							+ wOld * dataset.general.limited[bufferStep - settings.updatePeriod]
					}
				} else { // we are at first status

					dataset.general.total[bufferStep] = data.statuses[0][1];
					dataset.general.matched[bufferStep] = data.statuses[0][2];
					dataset.general.limited[bufferStep] = data.statuses[0][3];

					// interpolate first values
					for (var j = 1; j < settings.updatePeriod; j++) {

						// interpolation weights, old value is 0 anyway
						var wNew = 1 - j/settings.updatePeriod;

						// produce interpolated value
						dataset.general.total[bufferStep - j] = wNew * dataset.general.total[bufferStep];
						dataset.general.matched[bufferStep - j] = wNew * dataset.general.matched[bufferStep];
						dataset.general.limited[bufferStep - j] = wNew * dataset.general.limited[bufferStep];
					}
				}
			}

			// make sure last positions of buffers are populated
			for (var i = 1; i < settings.updatePeriod; i++) {

				dataset.general.total[bufferSize - i] = dataset.general.total[bufferSize - settings.updatePeriod];
				dataset.general.matched[bufferSize - i] = dataset.general.total[bufferSize - settings.updatePeriod];
				dataset.general.total[bufferSize - i] = dataset.general.total[bufferSize - settings.updatePeriod]; 
			}

			// prepare the rate buffers, sized for the entire window
			for (var i = 0; i < bufferSize; i++) {


				if(shortWindow + parseInt(settings.updatePeriod) + i >= bufferSize){

					dataset.general.tweetRate[i] = dataset.general.tweetRate[bufferSize - shortWindow- parseInt(settings.updatePeriod) -1];
					dataset.general.matchedRate[i] = dataset.general.matchedRate[bufferSize - shortWindow- parseInt(settings.updatePeriod) -1];
				
				} else {

					dataset.general.tweetRate[i] = 60*(dataset.general.total[i] - dataset.general.total[shortWindow + i])/
						(shortWindow*settings.refreshPeriod)						
					dataset.general.matchedRate[i] = 60*(dataset.general.matched[i] - dataset.general.matched[shortWindow + i])/
						(shortWindow*settings.refreshPeriod)
				}
			}


			// show the general statistics chart
			chartList.general.domainX = (settings.windowPeriod/settings.refreshPeriod);
			initializeChart( chartList.general, "Time", "Rate (tweets/minute)", ["Total tweets", "Matched tweets"]);


			// ---------------- Group Statistics ----------------

			// process groups into dataset
			for (var i = 0; i < data.groups.length; i++) {
				item = data.groups[i];
				dataset.groups[i] = {'id':item[0], 'name':item[1], 'color':mergeColors(item[2]),'rate':[]}
				for (var j = 0; j < settings.updatePeriod; j++) {
					dataset.groups[i].rate[j] = 0;
				}
			}

			// and show them
			showGroups(dataset.groups);

			dataset.feedsNumber = data.feedsCount;

			// ---------------- News Items Statistics ----------------

			// process news items into dataset
			for (var i = 0; i < data.newsItems.length; i++) {
				item = data.newsItems[i];
				dataset.newsItems[i] = {'id':item[0], 'headline':item[1], 'color':mergeColors(item[2]),'rate':[]}
				for (var j = 0; j < settings.updatePeriod; j++) {
					dataset.newsItems[i].rate[j] = 0;
				}
			}

			// and show them
			showNewsItems(dataset.newsItems);

			refreshData();
		});
	}


	function initializeChart( chart, labelX, labelY, columnNames ){

		var emptyData = new Array(chart.domainX).fill(0);

		var width = $(chart.wrapperId).width();
		var height = $(chart.wrapperId).height();

		var zoom = d3.zoom()
			.scaleExtent([1, 5])
			.translateExtent([[0, 0], [width, height]])
			.on("zoom", function(){
				graph.selectAll(".graphLine").attr("transform", d3.event.transform);
				gX.call(xAxis.scale(d3.event.transform.rescaleX(chart.xScale)));
				gY.call(yAxis.scale(d3.event.transform.rescaleY(chart.yScale)));
			})

		graph = d3.select(chart.wrapperId).append("svg")
			.attr("width", "100%").attr("height", "100%")

		chart.xScale = d3.scaleLinear().domain([chart.domainX, 0]).range([-5, width]); 
		chart.yScale = d3.scalePow().domain([chart.domainY, 0]).range([0, height-41]);
		chart.yScale.exponent([ logScaleCharts ? 0.5 : 1 ]);

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
			.ticks(12)
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
			.css({ "transform":"translate( " + (width/2 -6) + "px, " + (-height/2 -30) + "px) rotate(90deg)" })
			.text(labelY);
		$(chart.wrapperId).append(labelYDiv);

		var legend = $("<ul></ul>")
			.addClass("legend")
			.css({ "transform":"translate( 10px, " + (-height ) + "px)" })
		$(chart.wrapperId).append(legend);

		// display one shape per data column by appending it to a path element
		for (var i = 0; i < columnNames.length; i++) {

			graph.append("path")
				.attr("class", "graphLine line_" + i) // Assign classes for styling 

			var legendItem = $("<li></li>")
				.addClass("legend_" + i)
			legendItem.append("<span class='legendText'>" + columnNames[i] + "</span><span class='legendColor'></span>")

			legend.append(legendItem)
		}

		// display the axes
		var gX = graph.append("g")
			.attr("class", "x axis")
			.attr("transform","translate( 0," + (-20) + ")")

		var gY = graph.append("g")
			.attr("class", "y axis")
			.attr("transform","translate(" + (width -40) + ")")


		// draw the actual axes and rectangles to hide everything behind them
		gX.append("rect")
			.attr("class", "x axisBgRect statics")
			.attr("width", width)
			.attr("transform","translate( 0, " + (height-20) + ")")
			.attr("height",40);

		gX.append("rect")
			.attr("class", "x axisRect statics")
			.attr("width", width-36)
			.attr("transform","translate( 0, " + (height-20) + ")")
			.attr("height",1);

		gY.append("rect")
			.attr("class", "y axisBgRect statics")
			.attr("width", 51)
			.attr("height",height)
			.attr("transform","translate(-4)")

		gY.append("rect")
			.attr("class", "y axisRect statics")
			.attr("width", 1)
			.attr("height",height-40)
			.attr("transform","translate(-4)")

		gX.call(xAxis); // Create the X axis markers
		gY.call(yAxis); // Create the Y axis markers

		graph.call(zoom);
	}


	function refreshData(){

		var timeNow = Math.floor(Date.now() / 1000);

		// check if it's time to update
		if( timeNow - lastUpdateTime >= settings.updatePeriod ){

			lastUpdateTime = timeNow;
			updateData();
		}

		// continue loop
		timer = setTimeout( refreshData, settings.refreshPeriod * 1000 );




		// calculate what part of the refresh cycle we are in
		var refreshIndex = ((timeNow - lastUpdateTime + parseInt(settings.updatePeriod) -1) % settings.updatePeriod);

		// buffers are separated into blocks, corresponding to true values plus interpolations
		var bufferBlockSize = settings.updatePeriod / settings.refreshPeriod;
		// "first" place in latest buffer for this refresh
		var bufferPointer = settings.updatePeriod / settings.refreshPeriod - refreshIndex -1;
		// this contains all "recent" data (1/20th of the window) minus one update
		var shortWindow = Math.floor(0.05 * settings.windowPeriod / settings.refreshPeriod);

		// calculate and store the tweet rates
		dataset.general.tweetRate.unshift(
				60*(dataset.general.total[bufferPointer] - dataset.general.total[shortWindow+bufferPointer])/
				(shortWindow*settings.refreshPeriod)
			);
		dataset.general.tweetRate.pop();

		dataset.general.matchedRate.unshift(
				60*(dataset.general.matched[bufferPointer] - dataset.general.matched[shortWindow+bufferPointer])/
				(shortWindow*settings.refreshPeriod)
			);
		dataset.general.matchedRate.pop();


		// calculate and show values
		var matchedPercent   = 100 * dataset.general.matched[bufferPointer] / dataset.general.total[bufferPointer];
		var totalProjected   = dataset.general.limited[bufferPointer] + dataset.general.total[bufferPointer];
		var limitedPercent   = 100 * dataset.general.limited[bufferPointer] / totalProjected;
		var matchedProjected = 100 * dataset.general.matched[bufferPointer] / limitedPercent;
		var timeElapsed	  = Math.floor(Date.now() / 1000) - dataset.general.startTime;

		showGeneralStatistics(
				dataset.general.total[bufferPointer],
				dataset.general.matched[bufferPointer],
				isNaN(matchedPercent) ? bufferPointer: matchedPercent,
				dataset.general.limited[bufferPointer],
				isNaN(limitedPercent) ? bufferPointer: limitedPercent,
				isNaN(totalProjected) ? bufferPointer: totalProjected,
				isNaN(matchedProjected) ? bufferPointer: matchedProjected,
				dataset.general.tweetRate[0],
				dataset.general.matchedRate[0],
				timeElapsed,
				dataset.newsItems.length,
				dataset.groups.length,
				dataset.feedsNumber
			);

		refreshChart(chartList.general, [dataset.general.tweetRate, dataset.general.matchedRate])
	}

	function updateData() {

		getAPI( "data", function( data ) {

			// check for issues
			if ( data.error !== undefined ) {
				getAPI( "status", function( status ) {
					clearTimeout(timer);
					showStatus( status );
				});
				return false;
			}

			// buffers are separated into blocks, corresponding to true values plus interpolations
			var bufferBlockSize = settings.updatePeriod / settings.refreshPeriod;

			// Produce intepolated values between new and old true ones
			for (var i = 1; i <= bufferBlockSize; i++) {
				
				// interpolation weights
				var wOld = 1 - i/bufferBlockSize;
				var wNew = i/bufferBlockSize;

				// Add interpolated general statistics to the dataset
				dataset.general.total.unshift(
						wNew*(data.statuses[data.statuses.length-1][1] + dataset.general.total[i-1])
						+ wOld*dataset.general.total[i-1]
					);
				dataset.general.total.pop();

				dataset.general.matched.unshift(
						wNew*(data.statuses[data.statuses.length-1][2] + dataset.general.matched[i-1])
						+ wOld*dataset.general.matched[i-1]
					);
				dataset.general.matched.pop();

				dataset.general.limited.unshift(
						wNew*(data.statuses[data.statuses.length-1][3] + dataset.general.limited[i])
						+ wOld*dataset.general.limited[i-1]
					);
				dataset.general.limited.pop();
			}
		} );
	}


	function showGeneralStatistics( 
		total, matched, matchedPercent, limited, limitedPercent, totalProjected, matchedProjected, 
		currentRate, matchedRate, timeElapsed, newsCount, groupsCount, feedsCount ) {

		$("#totalNumber").text(total.toFixed(0));
		$("#matchedNumber").text(matched.toFixed(0));
		$("#matchedPercent").text(matchedPercent.toFixed(2));
		$("#limitedNumber").text(limited.toFixed(0));
		$("#limitedPercent").text(limitedPercent.toFixed(2));
		$("#totalProjectedNumber").text(totalProjected.toFixed(0));
		$("#matchedProjectedNumber").text(matchedProjected.toFixed(0));

		$("#currentRate").text(currentRate.toFixed(2));
		$("#matchedRate").text(matchedRate.toFixed(2));

		var timeElapsedString = "";
		if(timeElapsed > 3600){
			timeElapsedString += Math.floor(timeElapsed/3600) + " h, ";
		}
		timeElapsedString += Math.floor((timeElapsed%3600)/60);

		$("#timeElapsed").text(timeElapsedString);
		$("#timeElapsedSeconds").text(timeElapsed%60);

		$("#newsItemsNumber").text(newsCount);
		$("#groupsNumber").text(groupsCount);
		$("#feedsNumber").text(feedsCount);

		$( ".spinner .circle .status" ).text( (currentRate/60).toFixed(2) + " t/s" );
	}


	function showGroups(groupsList) {
		
		$(".groupsList").empty();

		groupsList.forEach( function(groupItem){

			groupElement = $('<li class="groupItem box" id=groupItem_"' + groupItem.id + '"></li>');
			groupElement.append('<div class="name">' + groupItem.name + '</div>');
			groupElement.append('<div class="rate">' + "0" + '</div>');
			groupElement.append('<div class="rateLabel">' + "&nbsp;tw/min" + '</div>');


			// make text color white for dark background colors
			if( parseInt(groupItem.color.substring(1,3), 16) 
				+ parseInt(groupItem.color.substring(3,5), 16) 
				+ parseInt(groupItem.color.substring(5), 16) < 360) {

				var textColor = "white";
			} else {
				var textColor = "black";
			}
			groupElement.css( {"background-color": groupItem.color, "color": textColor } ); 


			$(".groupsList").append(groupElement);
		});
	}

	function showNewsItems(newsItemsList) {
		
		$(".newsItemsList").empty();

		newsItemsList.forEach( function(newsItem){

			newsElement = $('<li class="newsItem box" id=newsItem_"' + newsItem.id + '"></li>');
			newsElement.append('<label class="filter"><input type="checkbox" checked="checked"><span></span><label>');
			newsElement.append('<div class="headline">' + newsItem.headline.replace(/\|&\|/g, "<br>") + '</div>');
			newsElement.append('<div class="rate">' + "0" + '</div>');
			newsElement.append('<div class="rateLabel">' + "&nbsp;tw/min" + '</div>');


			// make text color white for dark background colors
			if( parseInt(newsItem.color.substring(1,3), 16) 
				+ parseInt(newsItem.color.substring(3,5), 16) 
				+ parseInt(newsItem.color.substring(5), 16) < 360) {

				var textColor = "white";
			} else {
				var textColor = "black";
			}
			newsElement.css( {"background-color": newsItem.color, "color": textColor } ); 


			$(".newsItemsList").append(newsElement);
		});
	}

	function refreshChart(chart, dataColumns){

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
				.curve(d3.curveCardinal)
		}

		var scale = 1/d3.zoomTransform(graph.node()).k;
		var offset1 = chart.xScale(chart.domainX + 24*scale*scale) * d3.zoomTransform(graph.node()).k;
		var offset2 = chart.xScale(chart.domainX + 1 + 24*scale*scale) * d3.zoomTransform(graph.node()).k;

		// Non continuous animated graph
		if(!smoothChartRefresh){

			graph.attr("transform", "translate(" + offset1 + ")") 	// move the whole svg left to bring out the line
			graph.selectAll("text, .statics").attr("x", -offset1 )	// put statics back where they were, relatively
			
			path.attr("d", shape); // update values directly
			return true;
		}

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

	// =============== Page Load ================

	getAPI( "status", function( status ) {

		showStatus( status );

		if ( status.state == "boot" ) {

			clearTimeout( timer );
			timer = setTimeout( checkBooted, waitPeriod * 1000 );

		} else if (status.state == "live") {
			showStatus(status);
			initializeData();
		}
	} );

} );