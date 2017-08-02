$( document ).ready( function() {

	var waitPeriod = 2; // s, time to wait for state changes
	var refreshPeriod = 1; // s, time to wait between data retrieval (1Hz)
	var rateThreshold = 1000; // The tweet rate where we hit the twitter cap and results may not be accurate

	var lastUpdateTime = 0;

	var timer;
	var settings = [];
	var dataset = {
		'general':{'total':[], 'matched':[], 'limited':[], 'startTime':0, 'tweetRate':0},
		'groups':[],
		'newsItems':[]
	};

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
				$( ".spinner .circle" ).css( { "background-color": "#B7F", "width": "50px", "height": "50px", "border-radius": "25px" } );
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
				$( ".data" ).show();
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

		var newSettings = { "date": "", "updatePeriod": 0, "newsThreshold": 0, "tweetThreshold": 0 };


		newSettings.date = $( ".date :selected" ).val();

		var updatePeriod = $( "#updatePeriod" ).val();
		if ( updatePeriod != "" && typeof parseInt( updatePeriod ) == "number" ) {

			newSettings.updatePeriod = updatePeriod;

		} else {
			flashError( $( "#updatePeriod" ) );
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
		$( "#windowPeriod" ).val( "10" );
		$( "#newsThreshold" ).val( "0.3" );
		$( "#tweetThreshold" ).val( "0.1" );
	}

	// ------------ Data Management -------------

	function showNewsItems(newsItemsList) {
		
		$(".news").empty();

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


			$(".news").append(newsElement);
		});
	}


	// ============ Action Handlers =============

	$( ".boot.button" ).click( boot );
	$( ".start.button" ).click( start );

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


			// prepare the general statistics data buffers for "recent" data (1/20th the window)
			bufferSize = Math.floor(0.05 * settings.windowPeriod / refreshPeriod);
			dataset.general.total = new Array(bufferSize).fill(0);
			dataset.general.matched = new Array(bufferSize).fill(0);
			dataset.general.limited = new Array(bufferSize).fill(0);

			// calculate general statistics totals
			for (var i = 0; i < data.statuses.length; i++) {
				dataset.general.total[0] += data.statuses[i][1];
				dataset.general.matched[0] += data.statuses[i][2];
				dataset.general.limited[0] += data.statuses[i][3];
			}

			// fill the buffers with the last value
			for (var i = 1; i < bufferSize; i++) {
				dataset.general.total[i] = dataset.general.total[0];
				dataset.general.matched[i] = dataset.general.matched[0];
				dataset.general.limited[i] = dataset.general.limited[0];
			}


			// store starting time
			dataset.general.startTime = data.statuses[0][4];


			// calculate average rate
			// var timeElapsed	  = Math.floor(Date.now() / 1000) - dataset.general.startTime;
			// var averageRate	  = (dataset.general.total / timeElapsed).toFixed(2);

			refreshData();
		});
	}

	function refreshData(){

		var timeNow = Math.floor(Date.now() / 1000);

		// calculate what part of the refresh cycle we are in
		var refreshIndex = ((timeNow - lastUpdateTime - 1) % settings.updatePeriod);

		// buffers are separated into blocks, corresponding to true values plus interpolations
		var bufferBlockSize = settings.updatePeriod / refreshPeriod;
		// "first" place in latest buffer for this refresh
		var bufferPointer = settings.updatePeriod / refreshPeriod - refreshIndex -1;
		// this contains all "recent" data (1/20th of the window) minus one update
		var shortWindow = Math.floor((0.05 * settings.windowPeriod  - settings.updatePeriod ) / refreshPeriod);



		// create a new dataset to hold linear interpolation values
		var linearSet = {
			'general':{
				'total':[dataset.general.total[bufferPointer]],
				'matched':[dataset.general.matched[bufferPointer]],
				'limited':[dataset.general.limited[bufferPointer]],
				'startTime':dataset.general.startTime,
				'tweetRate':(dataset.general.total[bufferPointer] - dataset.general.total[shortWindow+bufferPointer])/
					(shortWindow*refreshPeriod)
			},
			'groups':dataset.groups,
			'newsItems':dataset.newsItems
		};

		// create a new dataset to hold smoothed values
		var smoothedSet = {
			'general':{
				'total':[0],
				'matched':[0],
				'limited':[0],
				'startTime':dataset.general.startTime,
				'tweetRate':0
			},
			'groups':dataset.groups,
			'newsItems':dataset.newsItems
		};

		// For data smoothing, we use a weighted moving average algorithm, looping through data from recent to old
		for (var i = 0; i < shortWindow; i++) {

			// WMA multiplacation factor:
			//  - inversly proportionate to the age of a data point
			//  - normalized so that the sum of factors is 1
			var wmaFactor = 2 * (1 - i/shortWindow) / (shortWindow + 1);

			smoothedSet.general.total[0] += dataset.general.total[bufferPointer+i] * wmaFactor;
			smoothedSet.general.matched[0] += dataset.general.matched[bufferPointer+i] * wmaFactor;
			smoothedSet.general.limited[0] += dataset.general.limited[bufferPointer+i] * wmaFactor;
		}

		// Print deviation of smoothing (usually within 0.5%-1.5%)
		// console.log(100*(dataset.general.total[0] - smoothedSet.general.total[0]) / dataset.general.total[0]);


		showUpdatedData(linearSet, smoothedSet);


		// check if it's time to update
		if( timeNow - lastUpdateTime >= settings.updatePeriod ){

			lastUpdateTime = timeNow;
			updateData();
		}

		timer = setTimeout( refreshData, refreshPeriod * 1000 );
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
			var bufferBlockSize = settings.updatePeriod / refreshPeriod;

			// Produce intepolated values between new and old true ones
			for (var i = 1; i <= bufferBlockSize; i++) {
				
				// interpolation weights
				var wOld = 1 - i/bufferBlockSize;
				var wNew = i/bufferBlockSize;

				// Add interpolated general statistics to the dataset
				dataset.general.total.unshift(
						wNew*(data.statuses[data.statuses.length-1][1] + dataset.general.total[i])
						+ wOld*dataset.general.total[i]
					);
				dataset.general.total.pop();

				dataset.general.matched.unshift(
						wNew*(data.statuses[data.statuses.length-1][2] + dataset.general.matched[i])
						+ wOld*dataset.general.matched[i]
					);
				dataset.general.matched.pop();

				dataset.general.limited.unshift(
						wNew*(data.statuses[data.statuses.length-1][3] + dataset.general.limited[i])
						+ wOld*dataset.general.limited[i]
					);
				dataset.general.limited.pop();
			}
		} );
	}

	function showUpdatedData(linearSet, smoothedSet) {

		var matchedPercent   = 100 * linearSet.general.matched[0] / linearSet.general.total[0];
		var totalProjected   = linearSet.general.limited[0] + linearSet.general.total[0];
		var limitedPercent   = 100 * linearSet.general.limited[0] / totalProjected;
		var matchedProjected = 100 * linearSet.general.matched[0] / limitedPercent;
		var timeElapsed	  = Math.floor(Date.now() / 1000) - linearSet.general.startTime;
		var matchedRate	  = linearSet.general.tweetRate * matchedPercent / 100;
		var averageRate	  = linearSet.general.total[0] / timeElapsed;

		showGeneralStatistics(
				linearSet.general.total[0],
				linearSet.general.matched[0],
				isNaN(matchedPercent) ? 0: matchedPercent,
				linearSet.general.limited[0],
				isNaN(limitedPercent) ? 0: limitedPercent,
				isNaN(totalProjected) ? 0: totalProjected,
				isNaN(matchedProjected) ? 0: matchedProjected,
				linearSet.newsItems.length,
				linearSet.general.tweetRate,
				matchedRate,
				averageRate,
				timeElapsed
			);

		drawGeneralStatisticsChart();
	}


	function showGeneralStatistics( 
		total, matched, matchedPercent, limited, limitedPercent, totalProjected, matchedProjected, 
		newsCount, currentRate, matchedRate, averageRate, timeElapsed ) {

		$("#totalNumber").text(total.toFixed(0));
		$("#matchedNumber").text(matched.toFixed(0));
		$("#matchedPercent").text(matchedPercent.toFixed(2));
		$("#limitedNumber").text(limited.toFixed(0));
		$("#limitedPercent").text(limitedPercent.toFixed(2));
		$("#totalProjectedNumber").text(totalProjected.toFixed(0));
		$("#matchedProjectedNumber").text(matchedProjected.toFixed(0));

		$("#currentRate").text((60 * currentRate).toFixed(2));
		$("#matchedRate").text((60 * matchedRate).toFixed(2));
		$("#averageRate").text((60 * averageRate).toFixed(2));

		var timeElapsedString = "";
		if(timeElapsed > 3600){
			timeElapsedString += Math.floor(timeElapsed/3600) + " h, ";
		}
		timeElapsedString += Math.floor((timeElapsed%3600)/60);

		$("#timeElapsed").text(timeElapsedString);
		$("#timeElapsedSeconds").text(timeElapsed%60);

		$("#newsItemsNumber").text(newsCount);

		$( ".spinner .circle .status" ).text( currentRate.toFixed(2) + " t/s" );
	}

	function drawGeneralStatisticsChart(){

		// var svg = d3.select("#generalStatisticsChart"),
		// 	margin = {top: 20, right: 80, bottom: 30, left: 50},
		// 	width = svg.attr("width") - margin.left - margin.right,
		// 	height = svg.attr("height") - margin.top - margin.bottom,
		// 	g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		// var x = d3.scaleTime().range([0, width]),
		// 	y = d3.scaleLinear().range([height, 0]),
		// 	z = d3.scaleOrdinal(d3.schemeCategory10);
	
		

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