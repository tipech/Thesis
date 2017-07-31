$( document ).ready( function() {

	var waitTime = 2000; // ms, time to wait for state changes
	var updateTime = 1000; // ms, time to wait between data retrieval (1Hz)
	var rateThreshold = 1000; // The tweet rate where we hit the twitter cap and results may not be accurate

	var timer;
	var groups = [];
	var settings = [];

	// ============ Helper Functions ============

	function rgb2hex(rgb) {
		rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

		function hex(x) {
			return ("0" + parseInt(x).toString(16)).slice(-2);
		}
		return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
	}

	// ============ Visual Functions ============

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
				$( ".init.button" ).fadeIn();

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
				$( ".init.button, .stop.button, .reset.button" ).hide();
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
				$( ".action.message" ).css( { "color": "#B7F" } );
				$( ".action.message" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "background-color": "#B7F", "width": "50px", "height": "50px", "border-radius": "25px" } );
				$( ".spinner .circle .status" ).stop().hide();

				$( ".help, .data, .error, .info" ).hide();
				$( ".control" ).fadeOut();
				break;

			case "live":

				$( ".action.message" ).hide();
				$( ".init.button, .start.button, .reset.button" ).hide();
				$( ".stop.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "width": "110px", "height": "110px", "border-radius": "55px" } );
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".help, .control, .error, .info" ).hide();
				$( ".data" ).show();
				break;

			case "done":

				$( ".action.message" ).hide();
				$( ".start.button, .stop.button, .init.button" ).hide();
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

	function showRate( rate ) {

		$( ".spinner .circle .status" ).text( rate + "/s" );

		if ( rate < rateThreshold * 0.75 ) {

			$( ".spinner .circle" ).css( { "background-color": "#1A0" } ); // green

		} else if ( rate > rateThreshold * 0.75 && rate < rateThreshold ) {

			$( ".spinner .circle" ).css( { "background-color": "#F94" } ); // orange

		} else if ( rate > rateThreshold ) {

			$( ".spinner .circle" ).css( { "background-color": "#E33" } ); // red
		}
	}

	function showError( errorText ) {

		errorWrapper = $( "<div></div>" ).html( errorText );
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

			group = $(
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

			feed = $(
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

		var newSettings = { "date": "", "dataRate": 0, "rssRate": 0 };


		newSettings.date = $( ".date :selected" ).val();

		var dataRate = $( "#dataRate" ).val();

		if ( dataRate != "" && typeof parseInt( dataRate ) == "number" ) {

			newSettings.dataRate = dataRate;

		} else {

			flashError( $( "#dataRate" ) );
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

		$( "#dataRate" ).val( "5" );
		$( "#newsThreshold" ).val( "0.3" );
		$( "#tweetThreshold" ).val( "0.1" );
	}


	// ============ Action Handlers =============

	$( ".init.button" ).click( boot );
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
			url: "init",
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

		groups = groupsResult;
		settings = settingsResult;

		$.post( {
			url: "start",
			data: JSON.stringify( { "groups": groups, "settings": settings } ),
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
						loadNewsItems();
						updateData();
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
				}, waitTime );

			} else { // state reached

				callback( status );
			}
		} ); // TODO error handling
	}

	function loadNewsItems() {

		getAPI( "news", function( data ) {

			$(".news").empty();

			data.forEach( function(newsItem){

				newsElement = $('<li class="newsItem"></li>');
				newsElement.append('<span>' + newsItem[1].replace("|&|", "<br>") + '</span>');
				$(".news").append(newsElement);
			});

			
			console.log(data);
		});

	}

	function updateData() {

		getAPI( "data", function( data ) {

			// process the data

			console.log(data);

			showRate(100);












			if ( data.error === undefined ) { // if everything's ok, set timeout for next update
				timer = setTimeout( updateData, updateTime );

			} else { // else check what the issue is
				getAPI( "status", function( status ) { 
					showStatus( status );
				});
			}
		} );
	}




	// =============== Page Load ================

	getAPI( "status", function( status ) {

		showStatus( status );

		if ( status.state == "boot" ) {

			clearTimeout( timer );
			timer = setTimeout( checkBooted, waitTime );

		} else if (status.state == "live") {
			showStatus(status);
			loadNewsItems();
			updateData();
		}
	} );

} );