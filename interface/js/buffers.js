// This file contains functions for processing data buffers (etc. buffer initialization, interpolation)

var shortWindowRatio = 0.05;

function initializeSumBuffer( data ) {

	// prepare data buffers according to window size
	var updatePeriod = parseInt(settings.updatePeriod);
	var bufferSize = Math.floor(settings.windowPeriod / settings.refreshPeriod);

	var sumBuffer = new Array(bufferSize).fill(0);

	// calculate final total
	for (var i = 0; i < data.length; i++) {
		sumBuffer[0] += data[i];
	}

	// populate the buffer,  most recent to oldest 
	for (var i = 1; i < bufferSize/updatePeriod; i++) {

		var bufferPointer = i*updatePeriod;

		if(data.length-i < 0){

			sumBuffer[bufferPointer] = 0;

		} else if(data.length-i == 0){ // we are at first status

			sumBuffer[bufferPointer] = data[0];

			// interpolate first values
			for (var j = 1; j < updatePeriod; j++) {

				// interpolation weights, old value is 0 anyway
				var wNew = 1 - j/updatePeriod;

				// produce interpolated value
				sumBuffer[bufferPointer - j] = Math.round(wNew * sumBuffer[bufferPointer])
			}

		} else if(data.length-i > 0){
			// store the true value at the appropriate position
			sumBuffer[bufferPointer] = sumBuffer[bufferPointer - updatePeriod] - data[data.length - i];

			// interpolate the rest of the values
			for (var j = 1; j < updatePeriod; j++) {

				// interpolation weights
				var wNew = 1 - j/updatePeriod;
				var wOld = j/updatePeriod;

				// produce interpolated value
				sumBuffer[bufferPointer -j] = Math.round(wNew* sumBuffer[bufferPointer] + wOld* sumBuffer[bufferPointer -updatePeriod])
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
	var updatePeriod = parseInt(settings.updatePeriod);
	var bufferSize = Math.floor(settings.windowPeriod / settings.refreshPeriod);
	var shortWindow = Math.floor(shortWindowRatio * bufferSize);

	var rateBuffer = new Array(bufferSize).fill(0);

	// this is the earliest rate value we can truly calculate, everything before this is outside our window
	var earliestValue = bufferSize - shortWindow - updatePeriod - 1

	// calculate the earliest value (needed to smooth forward)
	rateBuffer[earliestValue] = 60*(sumBuffer[earliestValue] - sumBuffer[shortWindow + earliestValue]) 
		/ (shortWindow*settings.refreshPeriod)

	// calculate the rates, starting at earliest value -1
	for (var i = earliestValue -1; i >= 0; i--) {

		var newRate = 60*(sumBuffer[i] - sumBuffer[shortWindow + i]) / (shortWindow*settings.refreshPeriod)
		var newRateSmoothed = ((dataSmoothFactor-1) * rateBuffer[i+1] + newRate) / dataSmoothFactor

		rateBuffer[i] = newRateSmoothed;
	}

	// fill the buffers at the start with just the earliest value
	for (var i = bufferSize - 1; i > earliestValue; i--) {

		rateBuffer[i] = rateBuffer[earliestValue];
	}

	return rateBuffer;
}


function initializeSentimentBuffer( sentimentData, sumData ){

	// prepare data buffers according to window size, "recent" data are in 1/20th of window
	var updatePeriod = parseInt(settings.updatePeriod);
	var bufferSize = Math.floor(settings.windowPeriod / settings.refreshPeriod);
	var lastValue = 2;

	var sentimentBuffer = new Array(bufferSize).fill(2);

	// populate the buffer, oldest to most recent
	for (var i = Math.floor( bufferSize/updatePeriod )-1 ; i >= 0 ; i--) {

		var bufferPointer = i*updatePeriod;
		var dataPointer = sentimentData.length - i - 1;

		if(dataPointer < 0){

			sentimentBuffer[bufferPointer] = 2;

		} else if(dataPointer == 0){ // we are at first status

			if(sumData[0] != 0 ){

				sentimentBuffer[bufferPointer] = sentimentData[0] / sumData[0];
				lastValue = sentimentBuffer[bufferPointer];
			
			} else {

				sentimentBuffer[bufferPointer] = 2;
				lastValue = 2;
			}

			// interpolate first values
			for (var j = 1; j < updatePeriod; j++) {

				// interpolation weights, old value is 0 anyway
				var wNew = 1 - j/updatePeriod;

				// produce interpolated value
				if(bufferPointer + j < bufferSize){
					sentimentBuffer[bufferPointer + j] = wNew * sentimentBuffer[bufferPointer]
				}				
			}

		} else if(dataPointer > 0){

			// store the true value at the appropriate position
			if(sumData[dataPointer] != 0){ // if tweets matched in period, calculate sentiment

				sentimentBuffer[bufferPointer] = sentimentData[dataPointer] / sumData[dataPointer];
				lastValue = sentimentBuffer[bufferPointer];

			} else { // no tweets, put last value

				sentimentBuffer[bufferPointer] = lastValue;
			}

			// interpolate the rest of the values
			for (var j = 1; j < updatePeriod; j++) {

				// interpolation weights
				var wNew = 1 - j/updatePeriod;
				var wOld = j/updatePeriod;

				// produce interpolated value
				sentimentBuffer[bufferPointer +j] = wNew*sentimentBuffer[bufferPointer] + wOld*sentimentBuffer[bufferPointer + updatePeriod]
			}

		}
	}

	return sentimentBuffer;
}


function updateSumBuffer(sumBuffer, value) {

	// buffers are separated into blocks, corresponding to true values plus interpolations
	var updatePeriod = parseInt(settings.updatePeriod);
	var bufferBlockSize = updatePeriod / settings.refreshPeriod;
	

	// Produce intepolated values between new and old true ones
	for (var i = 1; i <= bufferBlockSize; i++) {
		
		// interpolation weights
		var wOld = 1 - i/bufferBlockSize;
		var wNew = i/bufferBlockSize;

		// Add interpolated general statistics to the dataset
		sumBuffer.unshift(Math.round(wNew*(value + sumBuffer[i-1]) + wOld*sumBuffer[i-1]) );
		sumBuffer.pop();
	}
}


function updateSentimentBuffer(sentimentBuffer, sentimentValue, sumValue) {


	// buffers are separated into blocks, corresponding to true values plus interpolations
	var updatePeriod = parseInt(settings.updatePeriod);
	var bufferBlockSize = updatePeriod / settings.refreshPeriod;

	// Produce intepolated values between new and old true ones
	for (var i = 1; i <= bufferBlockSize; i++) {

		if(sumValue == 0){ // no new tweets in period

			sentimentBuffer.unshift( sentimentBuffer[i-1] );
			sentimentBuffer.pop();
		
		} else {

			// interpolation weights
			var wOld = 1 - i/bufferBlockSize;
			var wNew = i/bufferBlockSize;

			// Add interpolated general statistics to the dataset
			sentimentBuffer.unshift(wNew*(sentimentValue / sumValue) + wOld*sentimentBuffer[i-1] );
			sentimentBuffer.pop();
		}
	}
}


function refreshRateBuffer(rateBuffer, sumBuffer, bufferPointer){

	// buffers are separated into blocks, corresponding to true values plus interpolations
	var updatePeriod = parseInt(settings.updatePeriod);
	var bufferBlockSize = updatePeriod / settings.refreshPeriod;
	// this contains all "recent" data (1/20th of the window) minus one update
	var shortWindow = Math.floor(shortWindowRatio * settings.windowPeriod / settings.refreshPeriod);

	// calculate and store the tweet rates
	var newRate = 60*(sumBuffer[bufferPointer] - sumBuffer[shortWindow+bufferPointer])/	(shortWindow*settings.refreshPeriod)
	var newRateSmoothed = ((dataSmoothFactor-1) * rateBuffer[0] + newRate) / dataSmoothFactor

	rateBuffer.unshift( newRateSmoothed );
	rateBuffer.pop();


	if(rateBuffer == dataset.groups[1].rate){

		// console.log(sumBuffer[bufferPointer] - sumBuffer[shortWindow+bufferPointer])	
	}
	
}