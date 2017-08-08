// This file contains various helper functions


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