// This file contains various helper functions


// returns a pretty color, holds on to a global to make sure next will be different
var lastHue;
function randomColor() {

	var goldenRatioConjugate = 0.618033988749895;

	if(lastHue === undefined){

		lastHue = Math.random();
	}

	lastHue +=  goldenRatioConjugate;
	lastHue %= 1;

	var v = Math.random()/5 + 0.75; // random value from 0.85 to 0.95
	var result = hsv2rgb(lastHue, 0.9, v)

	return rgb2hex('rgb(' + result.r + ', ' + result.g + ', ' + result.b + ')');
}

// Converts an HSV color value to RGB. 
function hsv2rgb(h, s, v) {
	var r, g, b, i, f, p, q, t;
	if (arguments.length === 1) {
		s = h.s, v = h.v, h = h.h;
	}
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}

function rgb2hex(rgb) {
	var rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

	function hex(x) {
		return ("0" + parseInt(x).toString(16)).slice(-2);
	}
	return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
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