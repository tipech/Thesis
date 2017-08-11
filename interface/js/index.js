var waitPeriod = 2; // s, time to wait for state changes
var refreshPeriod = 1; // s, time to wait between data retrieval (1Hz)

var dataSmoothFactor = 10;
var animatedChartRefresh = false;
var logScaleCharts = true;

var timer;
var errorCounter = 0;
var lastUpdateTime = 0;
var settings = [];
var dataset = {
	'general':{'total':[], 'matched':[], 'limited':[], 'tweetRate':[], 'matchedRate':[], 'startTime':0, 'lastTime':0},
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
	},
	'newsItems':{
		'wrapperId':"#newsItemStatisticsChart",
		'domainX':0,
		'domainY':50,
		'xScale':{},
		'yScale':{},
		'type': "line"
	},
	'groups':{
		'wrapperId':"#groupStatisticsChart",
		'domainX':0,
		'domainY':2000,
		'xScale':{},
		'yScale':{},
		'type': "area"
	}
}



// ============== Visual Functions ==============

// ------------------- Common -------------------

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

			$( ".tabControls .newsItemData" ).click(); 
			break;

		case "done":

			$( ".action.message" ).hide();
			$( ".start.button, .stop.button, .boot.button" ).hide();
			$( ".reset.button" ).fadeIn();

			$( ".spinner .ring" ).fadeOut( 1000 );
			$( ".spinner .circle" ).css( { "background-color": "#E33", "width": "110px", "height": "110px", "border-radius": "55px" } );
			$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
			$( ".spinner .circle .status" ).text( "Done" );
			$( ".spinner .circle .status" ).css( { "color": "white" } );

			$( ".help, .control, .error, .info" ).hide();
			$( ".data" ).show();
			break;
	}

	if ( status.error !== undefined ) {

		showError( status.error );
	} else {

		$( ".error.box" ).hide();
	}
}

function showError( errorText ) {

	var errorWrapper = $( "<div></div>" ).html( errorText );
	errorWrapper.find( "style, title" ).remove();

	$( ".error.box" ).append( errorWrapper);
	$( ".error.box" ).show();
}

function showInfo( infoText ) {

	$( ".info.box" ).append( infoText + "<br>" );
	$( ".info.box" ).show();
}

// -------------- Group Management --------------

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

// -------------- Data Management --------------


function refreshGeneralStatistics( 
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

function showNewsItems(newsItemsList) {

	
	$(".newsItemsList").empty();

	newsItemsList.forEach( function(newsItem){

		newsElement = $('<li class="newsItem box" id=newsItem_' + newsItem.id + '></li>');
		newsElement.append('<label class="filter"><input type="checkbox" checked="checked"><span></span><label>');
		newsElement.append('<span>#' + (newsItem.id+1) + '</span>');
		newsElement.append('<div class="headline">' + newsItem.headline.replace(/\|&\|/g, "<br>") + '</div>');
		newsElement.append('<div class="data"><span class="total"></span><span class="rate"></span></div>');

		newsElement.find("[type=checkbox]:checked + span").css({"background-color":newsItem.graphColor})
		newsElement.find("label").click(function(){ updateCheckedNewsItems() })

		// make text color white for dark background colors
		if( parseInt(newsItem.groupColor.substring(1,3), 16) 
			+ parseInt(newsItem.groupColor.substring(3,5), 16) 
			+ parseInt(newsItem.groupColor.substring(5), 16) < 360) {

			var textColor = "white";
		} else {
			var textColor = "black";
		}
		newsElement.css( {"background-color": newsItem.groupColor, "color": textColor } ); 

		if(!newsItem.checked){
			
			newsElement.find("[type=checkbox]").prop('checked', false);
		}

		$(".newsItemsList").append(newsElement);
	});
}

function refreshNewsItems(newsItemsList, bufferPointer) {

	newsItemsList.forEach( function(newsItem){

		$('#newsItem_' + newsItem.id + ' .total').text(newsItem.total[bufferPointer] + " tweets")
		$('#newsItem_' + newsItem.id + ' .rate').text( (newsItem.rate[0]).toFixed(2) + " tw/min")

	});
}

function updateCheckedNewsItems(){

	for (var i = 0; i < dataset.newsItems.length; i++) {

		dataset.newsItems[i].checked = $("#newsItem_" + dataset.newsItems[i].id + " [type=checkbox]").prop('checked')
	}
}

function sortNewsItems(){

	if($("#newsSortSelect").val() == 0){ // sort by id

		var sortedItems = dataset.newsItems.slice(0).sort(function(a, b){ return a.id - b.id })
	
	} else if($("#newsSortSelect").val() == 1){ // sort by tweet totals

		var sortedItems = dataset.newsItems.slice(0).sort(function(a, b){ return b.total[0] - a.total[0] })

	} else if($("#newsSortSelect").val() == 2){ // sort by tweet rates

		var sortedItems = dataset.newsItems.slice(0).sort(function(a, b){ return b.rate[0] - a.rate[0] })
	}

	return sortedItems;
}

function showGroups(groupsList) {
	
	$(".groupsList").empty();

	groupsList.forEach( function(groupItem){

		groupElement = $('<li class="groupItem box" id=groupItem_' + groupItem.id + '></li>');
		groupElement.append('<div class="name">' + groupItem.name + '</div>');
		groupElement.append('<div class="data"><span class="total"></span><span class="rate"></span></div>');

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

function refreshGroups(groupsList, bufferPointer) {

	groupsList.forEach( function(group){

		$('#groupItem_' + group.id + ' .total').text(group.total[bufferPointer] + " tweets")
		$('#groupItem_' + group.id + ' .rate').text( (group.rate[0]).toFixed(2) + " tw/min")

	});
}

// ============= Control Functions ==============

function getAPI( url, callback ) {

	$.get( {
		url: url,
		dataType: "json",
		error: function( error ) {

			if( errorCounter > 3){

				clearTimeout(timer);
				showStatus({'state':'off', 'error':"Server process unreachable, shut down."})
			
			} else {

				showError( error.responseText ? error.responseText : "Server process unreachable!" );
				errorCounter++;
			}
		},
		success: function( data ) {

			callback( data );
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

function loadPage() {

	getAPI( "status", function( status ) {

		if ( status.state == "boot" ) {

			clearTimeout( timer );
			timer = setTimeout( checkBooted, waitPeriod * 1000 );

		} else if (status.state == "done") {
			showStatus(status);
			initializeData();

		} else if (status.state == "live") {
			showStatus(status);
			initializeData(function(){refreshData()});
		} else {
			showStatus( status );
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
				showInfo("Extracting news items and keywords from provided feeds...");

				// wait until keyword extraction is done
				waitUntilState( "setup", function( status ){

					// when keyword extraction is done, show a message
					showInfo("Extraction done, setting up database and Twitter stream...");
				});	

				// wait until live processing starts
				waitUntilState( "live", function( status ){

					// when news items are ready, load them and start live processing
					showStatus(status);
					initializeData(function(){refreshData()});
				});	
			}

		}
	} );
}

function initializeData(callback) {

	getAPI( "init", function( data ) {

		settings = data.settings;

		// ---------------- General Statistics ----------------

		// store times and other info
		dataset.general.startTime = data.statuses[0][4];
		dataset.general.lastTime = data.statuses[data.statuses.length-1][4];

		dataset.feedsNumber = data.feedsCount;

		var totalStatuses = [];
		var matchedStatuses = [];
		var limitedStatuses = [];

		for (var i = 0; i < data.statuses.length; i++) {

			totalStatuses[i] = data.statuses[i][1]
			matchedStatuses[i] = data.statuses[i][2]
			limitedStatuses[i] = data.statuses[i][3]
		}

		dataset.general.total = initializeSumBuffer(totalStatuses);
		dataset.general.matched = initializeSumBuffer(matchedStatuses);
		dataset.general.limited = initializeSumBuffer(limitedStatuses);

		dataset.general.tweetRate = initializeRateBuffer(dataset.general.total);
		dataset.general.matchedRate = initializeRateBuffer(dataset.general.matched);
		


		// show the general statistics chart
		chartList.general.domainX = settings.windowPeriod/settings.refreshPeriod;
		initializeChart( chartList.general, "Time", "Rate (tweets/minute)", ["Total", "Matched"], ["#EEDF4F", "#60BD68"]);

		// ---------------- News Items Statistics ----------------

		// process news items into dataset
		for (var i = 0; i < data.newsItems.length; i++) {
			var item = data.newsItems[i];
			dataset.newsItems[i] = {
					'id':item[0],
					'headline':item[1],
					'groupColor':mergeColors(item[2]),
					'graphColor':randomColor(),
					'checked':false
				}
			dataset.newsItems[i].total = initializeSumBuffer(item[3].split(",").map(function(value){ return parseInt(value); }));
			dataset.newsItems[i].rate = initializeRateBuffer(dataset.newsItems[i].total, dataset.newsItems[i].rate);
			dataset.newsItems[i].sentiment = initializeSentimentBuffer(
					item[4].split(",").map(function(value){ return parseInt(value); }),
					item[3].split(",").map(function(value){ return parseInt(value); })
				);
		}

		console.log(dataset.newsItems)
		// console.log(dataset.newsItems.map(function(item){item.sentiment.join(",")}).join("\n"))

		// show the news items chart
		chartList.newsItems.domainX = settings.windowPeriod/settings.refreshPeriod;
		var maxNewsRate = d3.max(dataset.newsItems.map(function(item){ return d3.max(item.rate) }))
		chartList.newsItems.domainY = maxNewsRate * 1.2;
		initializeChart( chartList.newsItems, "Time", "Rate (tweets/minute)",
				dataset.newsItems.map(function(item){return "Item: " + (item.id + 1)}),			// item names
				dataset.newsItems.map(function(item){return item.graphColor})		// item colors
			);

		// sort them
		var sortedNewsItems = sortNewsItems()
		// check the first 5, by whatever they are sorted
		sortedNewsItems.slice(0,5).forEach(function(item){
			item.checked = true;
			dataset.newsItems[item.id].checked = true;
		})
		// and show them
		showNewsItems(sortedNewsItems)

		// ---------------- Group Statistics ----------------

		// process groups into dataset
		for (var i = 0; i < data.groups.length; i++) {
			var item = data.groups[i];
			dataset.groups[i] = {
					'id':item[0],
					'name':item[1],
					'color':item[2]
				}

			dataset.groups[i].total = initializeSumBuffer(item[3].split(",").map(function(value){ return parseInt(value); }));
			dataset.groups[i].rate = initializeRateBuffer(dataset.groups[i].total, dataset.groups[i].rate);
		}

		// show the groups chart
		chartList.groups.domainX = settings.windowPeriod/settings.refreshPeriod;
		var maxGroupsRate = d3.max(dataset.groups.map(function(item){ return d3.max(item.rate) }))
		chartList.groups.domainY = maxGroupsRate * 1.2;
		initializeChart( chartList.groups, "Time", "Rate (tweets/minute)",
				dataset.groups.map(function(item){return item.name}),			// item names
				dataset.groups.map(function(item){return item.color})		// item colors
			);

		// and show them
		showGroups(dataset.groups);


		if(callback !== undefined){

			callback();
		}
	});
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

		dataset.general.lastTime = data.status[4];

		updateSumBuffer(dataset.general.total, data.status[1]);
		updateSumBuffer(dataset.general.matched, data.status[2]);
		updateSumBuffer(dataset.general.limited, data.status[3]);


		for (var i = 0; i < dataset.newsItems.length; i++) {

			updateSumBuffer(dataset.newsItems[i].total, data.newsItems[i][1]);
		}

		for (var i = 0; i < dataset.groups.length; i++) {

			updateSumBuffer(dataset.groups[i].total, data.groups[i][1]);
		}
	} );
}

function refreshData(){

	var timeNow = Math.floor(Date.now() / 1000);

	// check if it's time to update
	if( timeNow - lastUpdateTime >= settings.updatePeriod ){

		lastUpdateTime = timeNow;
		updateData();

		// every 4 periods, refresh the list sorting too
		if( timeNow % 4*settings.updatePeriod < 1 ){

			showNewsItems(sortNewsItems())
		}

		var maxNewsRate = d3.max(dataset.newsItems.map(function(item){ return d3.max(item.rate) }))
		chartList.newsItems.domainY = maxNewsRate * 1.2;
		chartList.newsItems.yScale.domain([chartList.newsItems.domainY, 0])
	}

	// continue loop
	timer = setTimeout( refreshData, settings.refreshPeriod * 1000 );


	// calculate what part of the refresh cycle we are in
	var refreshIndex = ((timeNow - lastUpdateTime + parseInt(settings.updatePeriod) -1) % settings.updatePeriod);
	// "first" place in latest buffer for this refresh
	var bufferPointer = settings.updatePeriod / settings.refreshPeriod - refreshIndex -1;

	refreshRateBuffer(dataset.general.tweetRate, dataset.general.total, bufferPointer);
	refreshRateBuffer(dataset.general.matchedRate, dataset.general.matched, bufferPointer);

	for (var i = 0; i < dataset.newsItems.length; i++) {

		refreshRateBuffer(dataset.newsItems[i].rate, dataset.newsItems[i].total, bufferPointer);
	}

	for (var i = 0; i < dataset.groups.length; i++) {

		refreshRateBuffer(dataset.groups[i].rate, dataset.groups[i].total, bufferPointer);
	}


	// ---------------- General Statistics ----------------

	// calculate and show values
	var matchedPercent   = 100 * dataset.general.matched[bufferPointer] / dataset.general.total[bufferPointer];
	var totalProjected   = dataset.general.limited[bufferPointer] + dataset.general.total[bufferPointer];
	var limitedPercent   = 100 * dataset.general.limited[bufferPointer] / totalProjected;
	var matchedProjected = 100 * dataset.general.matched[bufferPointer] / limitedPercent;
	var timeElapsed	  = refreshIndex + dataset.general.lastTime - dataset.general.startTime;

	refreshGeneralStatistics(
			dataset.general.total[bufferPointer],
			dataset.general.matched[bufferPointer],
			isNaN(matchedPercent) ? 0: matchedPercent,
			dataset.general.limited[bufferPointer],
			isNaN(limitedPercent) ? 0: limitedPercent,
			isNaN(totalProjected) ? 0: totalProjected,
			isNaN(matchedProjected) ? 0: matchedProjected,
			dataset.general.tweetRate[0],
			dataset.general.matchedRate[0],
			timeElapsed,
			dataset.newsItems.length,
			dataset.groups.length,
			dataset.feedsNumber
		);

	refreshChart(chartList.general, [dataset.general.tweetRate, dataset.general.matchedRate])


	// ---------------- News Items Statistics ----------------

	refreshNewsItems(dataset.newsItems, bufferPointer);

	refreshChart(
			chartList.newsItems,
			dataset.newsItems.map(function(item){return item.rate}),
			dataset.newsItems.filter(function(item){ return !item.checked}).map(function(item){return item.id})
		)

	// ---------------- Groups Statistics ----------------

	refreshGroups(dataset.groups, bufferPointer);


	refreshChart(
			chartList.groups,
			dataset.groups.map(function(item){return item.rate})
		)
}

function stop() {

	clearTimeout(timer);

	$.post( {
		url: "stop",
		dataType: "json",
		error: function( error ) {

			showError( error.responseText ? error.responseText : "Server process unreachable!" );
		},
		success: function( status ) {

			if ( status.state == "live" ) {

				status[ 'error' ] = "Nothing Happened";
				showStatus( status );

			} else {

				// Show loading...
				showStatus( status );
			}

		}
	} );
}


$( document ).ready( function() {

	// ============ Action Handlers =============

	// ----------------- Common -----------------

	$( ".boot.button" ).click( boot );
	$( ".start.button" ).click( start );
	$( ".stop.button" ).click( stop );
	$( ".reset.button" ).click( boot );


	$(window).on("keyup", function(e){ 

		if(e.which == 112){ // toggle log - linear chart scale on "1"

			logScaleCharts = !logScaleCharts;
			toggleChartZoom(chartList.general);
			toggleChartZoom(chartList.newsItems);
			toggleChartZoom(chartList.groups);

		} else if(e.which == 113){ // toggle animated - chunky charts
			
			animatedChartRefresh = !animatedChartRefresh;

		} else if(e.which == 115){ // change data smoothing factor

			clearTimeout(timer);
			
			//hold on to news item colors
			var newsItemColors = dataset.newsItems.map(function(item){ return item.graphColor; })
			var newsItemChecks = dataset.newsItems.map(function(item){ return item.checked; })
			dataSmoothFactor = (dataSmoothFactor + 2) % 12 + 1; // factor goes from 1 to 10, step 3

			initializeData(function(){

				for (var i = 0; i < dataset.newsItems.length; i++) {
					
					dataset.newsItems[i].graphColor = newsItemColors[i];
					dataset.newsItems[i].checked = newsItemChecks[i];
				}

				showNewsItems(sortNewsItems());
				refreshData();
			});
		}
	})

	// ------------ Group Management ------------

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

		// DEBUG
	} );


	// -------------- Data Management ------------

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

	$( "#newsSortSelect" ).change( function(){ 

		showNewsItems(sortNewsItems());
	})

	$( "#checkAll" ).click(function(){
		dataset.newsItems.forEach(function(item){ item.checked = true })
		showNewsItems(sortNewsItems());
	});
	$( "#checkTop" ).click(function(){
		var sortedItems = sortNewsItems()
		sortedItems.forEach(function(item, index){
			item.checked = index < 5
			dataset.newsItems[item.id].checked = index < 5
		})
		showNewsItems(sortedItems);
	});
	$( "#checkNone" ).click(function(){
		dataset.newsItems.forEach(function(item){ item.checked = false })
		showNewsItems(sortNewsItems());
	});

	// =============== Page Load ================

	// configure settings according to browser compatibility
	if(typeof InstallTrigger !== 'undefined'){ // Firefox

		animatedChartRefresh = true;
	}


	loadPage();

} );