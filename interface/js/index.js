$( document ).ready( function() {

	var waitTime = 1000; // ms, time to wait for state changes
	var refreshTime = 1000; // ms, time to wait between data retrieval (1Hz)
	var rateThreshold = 1000; // The tweet rate where we hit the twitter cap and results may not be accurate

	var timer;
	var groups = [];
	var settings = [];

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
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle .status" ).text( "Offline" );
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".data, .control" ).hide();
				$( ".help" ).show();
				break;

			case "boot":

				$( ".button" ).hide();
				$( ".action.message" ).text( "Initializing..." );
				$( ".action.message" ).css( { "color": "#F44" } );
				$( ".action.message" ).fadeIn();

				$( ".spinner .ring" ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "background-color": "#F44", "width": "50px", "height": "50px", "border-radius": "25px" } );
				$( ".spinner .circle .status" ).stop().hide();

				$( ".data, .control" ).hide();
				$( ".help" ).fadeOut();
				break;

			case "idle":

				$( ".action.message" ).hide();
				$( ".init.button, .stop.button, .reset.button" ).hide();
				$( ".start.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 1000 );
				$( ".spinner .circle" ).css( { "background-color": "#28F", "width": "110px", "height": "110px", "border-radius": "55px" } );
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle .status" ).text( "Ready" );
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				$( ".help, .data" ).hide();
				$( ".control" ).show();
				break;

			case "batch":

				$( ".button" ).hide();
				$( ".action.message" ).text( "Processing..." );
				$( ".action.message" ).css( { "color": "#B7F" } );
				$( ".action.message" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "background-color": "#B7F", "width": "50px", "height": "50px", "border-radius": "25px" } );
				$( ".spinner .circle .status" ).stop().hide();

				$( ".help, .data" ).hide();
				$( ".control" ).fadeOut();
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

				$( ".help, .control" ).hide();
				$( ".data" ).show();
				break;

			case "live":

				$( ".action.message" ).hide();
				$( ".init.button, .start.button, .reset.button" ).hide();
				$( ".stop.button" ).fadeIn();

				$( ".spinner .ring" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle" ).css( { "width": "110px", "height": "110px", "border-radius": "55px" } );
				$( ".spinner .circle .status" ).fadeOut( 0 ).delay( 2000 ).fadeIn();
				$( ".spinner .circle .status" ).css( { "color": "white" } );

				updateRate( data.rate );

				$( ".help, .control" ).hide();
				$( ".data" ).show();
				break;
		}
	}

	function updateRate( rate ) {

		$( ".spinner .circle .status" ).text( status.rate + "/s" );

		if ( rate < rateThreshold * 0.75 ) {

			$( ".spinner .circle" ).css( { "background-color": "#1A0" } ); // green

		} else if ( rate > rateThreshold * 0.75 && status.rate < rateThreshold ) {

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

				var group = $( event.target ).parents( ".group" );
				var url = $( event.target ).siblings( "input" ).val();
				addFeed( group, url );
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
			var group = { "name": name, "feeds": [] };
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

				group.feeds = feeds;
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

		var rssRate = $( "#rssRate" ).val();

		if ( rssRate != "" && typeof parseInt( rssRate ) == "number" ) {

			newSettings.rssRate = rssRate;

		} else {

			flashError( $( "#rssRate" ) );
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

		$( "#dataRate" ).val( "1" );
		$( "#rssRate" ).val( "600" );
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

	function getStatus( callback ) {

		$.get( {
			url: "status",
			dataType: "json",
			error: function( error ) {

				showError( error.responseText );
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

				showError( error.responseText );
			},
			success: function( data ) {

				if ( data.state == "off" ) {

					data[ 'error' ] = "Nothing Happened";

				} else if ( data.state != "idle" ) {

					timer = setTimeout( checkBooted, waitTime );
				}

				showStatus( data );
			}
		} );
	}

	function checkBooted() {

		getStatus( function( status ) {

			if ( status.state != "idle" ) { // wait some more

				timer = setTimeout( checkBooted, waitTime );

			} else { // system booted

				showStatus( status );
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

		console.log(JSON.stringify( { "groups": groups, "settings": settings } ));

		$.post( {
			url: "start",
			data: JSON.stringify( { "groups": groups, "settings": settings } ),
			dataType: "json",
			error: function( error ) {

				showError( error.responseText );
			},
			success: function( data ) {

				if ( data.state == "idle" ) {

					data[ 'error' ] = "Nothing Happened";

				} else {

					timer = setTimeout( checkBooted, refreshTime );
				}

				showStatus( data );
			}
		} );
	}

	// =============== Page Load ================

	getStatus( function( status ) {

		showStatus( status );

		if ( status.state == "boot" ) {

			clearTimeout( timer );
			timer = setTimeout( checkBooted, waitTime );
		}
	} );

} );