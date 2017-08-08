// This file contains functions for processing data buffers (etc. buffer initialization, interpolation)


function initializeSumBuffer( data ) {

	// prepare data buffers according to window size
	var bufferSize = Math.floor(settings.windowPeriod / settings.refreshPeriod);


	var sumBuffer = new Array(bufferSize).fill(0);

	// calculate final total
	for (var i = 0; i < data.length; i++) {
		sumBuffer[0] += data[i];
	}

	// populate the buffer
	for (var i = 1; i < bufferSize/settings.updatePeriod; i++) {

		var bufferStep = i*settings.updatePeriod;
		if(data.length-i < 0){

			sumBuffer[bufferStep] = 0;

		} else if(data.length-i > 0){
			// store the true value at the appropriate position
			sumBuffer[bufferStep] = sumBuffer[bufferStep - settings.updatePeriod] - data[data.length - i];

			// interpolate the rest of the values
			for (var j = 1; j < settings.updatePeriod; j++) {

				// interpolation weights
				var wNew = 1 - j/settings.updatePeriod;
				var wOld = j/settings.updatePeriod;

				// produce interpolated value
				sumBuffer[bufferStep -j] = Math.floor(wNew* sumBuffer[bufferStep] + wOld* sumBuffer[bufferStep -settings.updatePeriod])
			}

		} else { // we are at first status

			sumBuffer[bufferStep] = data[0];

			// interpolate first values
			for (var j = 1; j < settings.updatePeriod; j++) {

				// interpolation weights, old value is 0 anyway
				var wNew = 1 - j/settings.updatePeriod;

				// produce interpolated value
				sumBuffer[bufferStep - j] = Math.floor(wNew * sumBuffer[bufferStep])
			}
		}
	}

	// make sure last positions of buffer are populated
	for (var i = 1; i < settings.updatePeriod; i++) {

		sumBuffer[bufferSize - i] = sumBuffer[bufferSize - settings.updatePeriod];
	}

	return sumBuffer;
}


function initializeRateBuffer( sumBuffer ){

	// prepare data buffers according to window size, "recent" data are in 1/20th of window
	var bufferSize = Math.floor(settings.windowPeriod / settings.refreshPeriod);
	var shortWindow = Math.floor(0.05 * bufferSize);

	var rateBuffer = new Array(bufferSize).fill(0);

	// put the first value in
	rateBuffer[0] = 60*(sumBuffer[0] - sumBuffer[shortWindow]) / (shortWindow*settings.refreshPeriod)

	// prepare the rate buffer, sized for the entire window
	for (var i = 1; i < bufferSize; i++) {

		// too early to calculate rate, just copy the later values
		if(shortWindow + parseInt(settings.updatePeriod) + i >= bufferSize){

			rateBuffer[i] = rateBuffer[bufferSize - shortWindow - parseInt(settings.updatePeriod) -1];
		
		} else {

			var newRate = 60*(sumBuffer[i] - sumBuffer[shortWindow + i]) / (shortWindow*settings.refreshPeriod)
			rateBuffer[i] = ((dataSmoothFactor-1) * rateBuffer[i-1] + newRate) / dataSmoothFactor;
		}
	}


	return rateBuffer;
}


function updateSumBuffer(sumBuffer, value) {

	// buffers are separated into blocks, corresponding to true values plus interpolations
	var bufferBlockSize = settings.updatePeriod / settings.refreshPeriod;


	

	// Produce intepolated values between new and old true ones
	for (var i = 1; i <= bufferBlockSize; i++) {
		
		// interpolation weights
		var wOld = 1 - i/bufferBlockSize;
		var wNew = i/bufferBlockSize;

		// Add interpolated general statistics to the dataset
		sumBuffer.unshift(wNew*(value + sumBuffer[i-1])	+ wOld*sumBuffer[i-1] );
		sumBuffer.pop();
	}
}


function refreshRateBuffer(rateBuffer, sumBuffer, bufferPointer){

	// buffers are separated into blocks, corresponding to true values plus interpolations
	var bufferBlockSize = settings.updatePeriod / settings.refreshPeriod;
	// this contains all "recent" data (1/20th of the window) minus one update
	var shortWindow = Math.floor(0.05 * settings.windowPeriod / settings.refreshPeriod);

	// calculate and store the tweet rates
	var newRate = 60*(sumBuffer[bufferPointer] - sumBuffer[shortWindow+bufferPointer])/	(shortWindow*settings.refreshPeriod)
	var newRateSmoothed = ((dataSmoothFactor-1) * rateBuffer[1] + newRate) / dataSmoothFactor

	rateBuffer.unshift( newRateSmoothed );
	rateBuffer.pop();
}