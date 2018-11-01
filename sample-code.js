
// THIS IS A SECITON OF THE CODE THAT USED THIS and is not a standalone sample 

//--------------------------------- AUDIO -----------------------------------

const DEFAULT_SAMPLE_RATE = (44100/4) |0

const DEFAULT_SAMPLE_TIME_LENGTH = 100
const DEFAULT_SAMPLE_SEGMENTS = ( ( ( ( DEFAULT_SAMPLE_TIME_LENGTH * DEFAULT_SAMPLE_RATE )  
                                    / 1000 )  
                                  + 159 )     
                                / 160 ) | 0 ;

function initAudio() {
	var gsm;
	var bufferSize = 4096;
	var myPCMProcessingNode = null;
	const output_data_buffer = new Float32Array( 4096 );
	
	// Check if Web Audio API is supported.
	var audioContext = null;
	var offlineContext_down = null;
	var offlineContext_up = null;
	var bufferSource_down = null;
	var bufferSource_up = null;
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
	} catch(e) {
		alert('Web Audio API is not supported in this browser');
		return;
	}

	gsm = _gsm_create();

	var outbuffers = [ new Float32Array( bufferSize ), new Float32Array( bufferSize ),new Float32Array( bufferSize ) ];
	var outbuffer_head_used = 0;
	var outready_head = 0;
	var outready_tail = 0;
	var output_played = false;

	var compress_partial_buffer_idx = 0;
	var compress_partial_buffer_heap = Module._malloc( 160*2 );
	var compress_partial_buffer = new Int16Array( Module.HEAP16.buffer, compress_partial_buffer_heap, 160 );
	var _max_sample_level = 0;
	var input_trigger_level = 2048;
	var last_compress_block_time;

	var compress_buffer_heap = Module._malloc( 33 * DEFAULT_SAMPLE_SEGMENTS );
	var compress_buffer = new Uint8Array( Module.HEAPU8.buffer, compress_buffer_heap, 33 * DEFAULT_SAMPLE_SEGMENTS );
	var compress_buffer_heaps = []; 
	var compress_buffers = []; for( let n = 0; n < DEFAULT_SAMPLE_SEGMENTS; n++ ){  compress_buffers[n] = new Uint8Array( Module.HEAPU8.buffer, compress_buffer_heaps[n] = compress_buffer_heap + n * 33, 33 ); }
	var compress_segments = 0;
	var callback = null;
	function processBlock( data ) {
		{
			var n;
			n = 0;
			if( compress_partial_buffer_idx )
			{
				for( n = n; n < data.length; n++ )
				{
					compress_partial_buffer[compress_partial_buffer_idx++] = ((data[n]) * 32767)|0;

					if( compress_partial_buffer_idx == compress_partial_buffer.length )
					{
						var sampleval;
						var sample = 0;
						var max_sample_level;
						//lprintf( "prior encode %d %d", n, p * 33 );
						for( max_sample_level = 0, sample = 0; sample < 160; sample++ )
						{
							sampleval = compress_partial_buffer[sample]; 
							if( sampleval < 0 ) sampleval = -sampleval;
							if( sampleval > max_sample_level )
								max_sample_level = sampleval;
						}
						//lprintf( "block max sample is %d", max_sample_level );
						if( max_sample_level > _max_sample_level )
							_max_sample_level = max_sample_level;
						if( max_sample_level > input_trigger_level
							|| last_compress_block_time > ( Date.now() - 1000 ) )
						{
							if( max_sample_level > input_trigger_level)
								last_compress_block_time = Date.now();
							// compress_buffer +  (compress_segments * 33)
							let this_compress_buffer = new Uint8Array( Module.HEAPU8.buffer, compress_buffer_heap + (compress_segments*33), 33 );

							_gsm_encode( gsm
									  , compress_partial_buffer_heap
									  , compress_buffer_heaps[compress_segments] );
							compress_segments++;
						}
						n++; // did use this sample
						compress_partial_buffer_idx = 0;
						break;
					}
				}
			}
			for( n = n; n < data.length; n += 160 )
			{
				if( ( data.length - n ) >= 160 )
				{
					//lprintf( "full block encode %d %d", n, p * 33 );
					for( max_sample_level = 0, sample = 0; sample < 160; sample++ )
					{
						sampleval = compress_partial_buffer[sample] = ((data[n+sample]) * 32767)|0;
						if( sampleval < 0 ) sampleval = -sampleval;
						if( sampleval > max_sample_level )
							max_sample_level = sampleval;
					}
					if( max_sample_level > _max_sample_level )
						_max_sample_level = max_sample_level;
					//lprintf( "block max sample is %d", max_sample_level );
					if( max_sample_level > input_trigger_level
						|| last_compress_block_time > ( Date.now() - 1000 ) )
					{
						if( max_sample_level > input_trigger_level)
							last_compress_block_time = Date.now();
						let this_compress_buffer = new Uint8Array( Module.HEAPU8.buffer, compress_buffer_heap + (compress_segments*33), 33 );
						_gsm_encode( gsm
								  , compress_partial_buffer_heap
								  , compress_buffer_heaps[compress_segments] );
						compress_segments++;
					}
					if( compress_segments == DEFAULT_SAMPLE_SEGMENTS )
					{
						if( callback )
							callback( _max_sample_level
										, compress_buffer
										, compress_segments * 33 );
						compress_segments = 0;
						_max_sample_level = 0;
					}
				}
				else 
				{
					//lprintf( "%d remain", datalen - n );
					break;
				}
			}
			for( n = n; n < data.length; n++ )
			{
				compress_partial_buffer[compress_partial_buffer_idx++] = ((data[n+sample]) * 32767)|0;
				if( compress_partial_buffer_idx == 160 )
				{
					// this should never actually happen?
					for( max_sample_level = 0, sample = 0; sample < 160; sample++ )
					{
						sampleval = compress_partial_buffer[sample];
						if( sampleval > max_sample_level )
							max_sample_level = sampleval;
					}
					//lprintf( "block max sample is %d", max_sample_level );
					//lprintf( "end block encode %d %d", n, p * 33 );
					if( max_sample_level > _max_sample_level )
						_max_sample_level = max_sample_level;
					if( max_sample_level > input_trigger_level
						|| last_compress_block_time > ( Date.now() - 1000 ) )
					{
						if( max_sample_level > input_trigger_level)
							last_compress_block_time = Date.now();
						let this_compress_buffer = new Uint8Array( Module.HEAPU8.buffer, compress_buffer_heap + (compress_segments*33), 33 );
						_gsm_encode( gsm
								  , compress_partial_buffer_heap
								  , compress_buffer_heaps[compress_segments] );
						compress_segments++;
					}
					compress_partial_buffer_idx = 0;
				}
			}
		}
		//console.log( "encode:", data );
		//console.log( "encode:", compress_segments * 160 )
		if( compress_segments > 0 )//(DEFAULT_SAMPLE_SEGMENTS * 2 ) )
		{
			if( callback )
				callback( _max_sample_level
							, compress_buffer
							, compress_segments * 33 );
			compress_segments = 0;
			_max_sample_level = 0;
		}
	}

	function processDecode( data ) {
		var n;
		var decompress_buffer;
		if( data.length % 33 )
		{
			throw new Error( `Invalid bufffer received ${data.length} (${data.length/33})` );
		}
		var datalen = data.length / 33;
		decompress_buffer = Module._malloc( 2 * data.length * 160 );

		var decode_buffer_heap = Module._malloc( data.length );
		var decode_buffer = new Uint8Array( Module.HEAPU8.buffer, decode_buffer_heap, data.length );
		decode_buffer.set( data, 0 )
		for( n = 0; n < datalen; n ++ )
		{
			_gsm_decode( gsm, decode_buffer_heap + n*33, decompress_buffer + 2 * n * 160 );
		}
		var u16 = new Int16Array( Module.HEAP16.buffer, decompress_buffer, n*160 );

		if( audioContext ) {
			offlineContext_up = new OfflineAudioContext(1, n*160/(DEFAULT_SAMPLE_RATE/audioContext.sampleRate), audioContext.sampleRate);
			var bufferSource_up = offlineContext_up.createBufferSource();
			bufferSource_up.buffer = offlineContext_down.createBuffer(1,n*160,DEFAULT_SAMPLE_RATE );
			bufferSource_up.connect( offlineContext_up.destination );
			offlineContext_up.oncomplete = function(event) {
				var buf = event.renderedBuffer;
				var raw = buf.getChannelData(0);
				//console.log('Done Rendering');
				var outbuf = outbuffers[outready_head];
				for( n = 0; n < raw.length; n++ ) {
					outbuf[outbuffer_head_used++] = raw[n];
					if( outbuffer_head_used == 4096 ) {
						outready_head++;
						outready_head %= outbuffers.length;
						outbuffer_head_used = 0;
					}
				}
				console.log( "output buffer length is n", n );
			}; 

			var upbuf = bufferSource_up.buffer.getChannelData(0);
			for( var m = 0; m < n*160; m++ )
				upbuf[m] = ( u16[m] / 32768 );
			bufferSource_up.start();
			offlineContext_up.startRendering();
		}


		Module._free( decompress_buffer );
		Module._free( decode_buffer_heap );
		//console.log( "have some data to push now...")
	}


	function disable() {
		if( audioContext )
			audioContext.close().then(function() {
				audioContext = null;
				// flush any outstanding buffers?
				//l.audioDevice 
			});
	}

	function enable( cb ) {
		audioContext = new AudioContext( { sampleRate:DEFAULT_SAMPLE_RATE});
		//audioContext.sampleRate = 48000;
		//audioContext.sampleRate = DEFAULT_SAMPLE_RATE;

/*
		var inputStream = audioContext.createMediaStreamSource(stream);
		source.connect(audioContext.destination);

		var outputStream = audioContext.createMediaStreamDestination(stream);
		outputStream.buffer = myArrayBuffer;
*/

		offlineContext_up = new OfflineAudioContext(1, bufferSize, audioContext.sampleRate);
		{
			offlineContext_up.oncomplete = function(event) {
				var resampeledBuffer = event.renderedBuffer;
				console.log('Done Rendering');
			}; 
			//bufferSource_.connect(offlineContext_down.destination);
		}

		callback = cb;
		// Create a pcm processing "node" for the filter graph.
		var myPCMProcessingNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
		//audioContext.createMediaStreamDestination();

		myPCMProcessingNode.onaudioprocess = function(e) {
			var input = e.inputBuffer.getChannelData(0);
			var output = e.outputBuffer.getChannelData(0);

			//console.log('Starting Offline Rendering');

			offlineContext_down = new OfflineAudioContext(1, bufferSize*(DEFAULT_SAMPLE_RATE/audioContext.sampleRate), DEFAULT_SAMPLE_RATE);
			var bufferSource_down = offlineContext_down.createBufferSource();
			bufferSource_down.buffer = e.inputBuffer;//offlineContext_down.createBuffer(1,4096,audioContext.sampleRate );
			bufferSource_down.connect( offlineContext_down.destination );
			offlineContext_down.oncomplete = function(event) {
				//console.log('Done Rendering');

				var encode = processBlock( event.renderedBuffer.getChannelData(0), null );

				if( encode ) {
					if( l.audioToUser ) {
						protocol.send( l.audioToUser.name, encode, true );
					}
					else if( l.audioToGroup ) {
						protocol.send( l.audioToGroup.group_id, encode, true );
					} else {
						processDecode( encode );
					}
				}
			}; 

			//var downbuf = bufferSource_down.buffer.getChannelData(0);
			//for( var n = 0; n < input.length; n++ )
			//	downbuf[n] = input[n];
			bufferSource_down.start();
			offlineContext_down.startRendering();

			if( outready_head != outready_tail || output_played ){
				//console.log( "Have a full otuput buffer to play... ", output_played, outbuffer_head_used, outready_head, outready_tail )
				var outbuf = outbuffers[outready_tail];
				var uselen = (outready_head == outready_tail)?outbuffer_head_used:bufferSize;
				var i;
				for ( i = 0; i < uselen; i++) {
					// Modify the input and send it to the output.
					output[i] = outbuf[i];
				}
				if( i < bufferSize ) {
					// wait until another full buffer is ready before filling more.
					output_played = false;
					outbuffer_head_used = 0;
				} else {
					output_played = true;
					outready_tail++;
					outready_tail %= outbuffers.length;	
				}
				if( i < bufferSize )
					console.log( "Fill in some of the buffer..." );
				for( i = i; i < bufferSize; i++ ) {
					output[i] = 0;
				}
			} else {
				console.log( "Fill no output" );
				for( i = 0; i < bufferSize; i++ ) {
					output[i] = 0;
				}
			}
		}


		var errorCallback = function(e) {
			alert("Error in getUserMedia: " + e);
		};  

		// Get access to the microphone and start pumping data through the  graph.
		navigator.mediaDevices.getUserMedia({audio: true} ).then( function(stream) {
			// microphone -> myPCMProcessingNode -> destination.
			var microphone;
			microphone = audioContext.createMediaStreamSource(stream);

			//var resampler = new Resampler(DEFAULT_SAMPLE_RATE, audioContext.sampleRate);		
			//microphone.connect(resampler);
			//resampler.connect(myPCMProcessingNode);

			microphone.connect(myPCMProcessingNode);
			//microphone.start(0);

			//var resampler2 = new Resampler(audioContext.sampleRate, DEFAULT_SAMPLE_RATE);		
			//myPCMProcessingNode.connect(resampler2 );
			//resampler2.connect(audioContext.destination);

			myPCMProcessingNode.connect(audioContext.destination);
			//offlineContext_down.start();
		} ).catch( errorCallback);


	}

	return {
		enable : enable,
		disable: disable,
		decode:processDecode,
		enabled() { return audioContext !== null },
	};
}

function startVoice( user, group ) {
	if( user && user.name == protocol.username ) {
		confirm( ["Don't call yourself."]);
		return;
	}
	captionButtons.voice.style.backgroundImage = voice_states.on;
	l.audioToUser = user;
	l.audioToGroup = group;
	l.audioDevice.enable( (level,buf,buflen)=>{
		var buf = buf.slice( 0, buflen );
		var sendData2 = fromByteArray( buf );
		var sendData = base64ArrayBuffer( buf );
		var buf = `\x9fdata:audio/gsm;base64,${sendData}\x9c`
		if( l.audioToUser ) {
			protocol.send( l.audioToUser.name, buf, true );
		}
		else if( l.audioToGroup ) {
			protocol.groupSend( l.audioToGroup.group_id, buf, true );
		} else {
			var raw = toByteArray(sendData2);
			l.audioDevice.decode( raw );
			//l.audioDevice.decode( encode );
		}

	})
}

function endVoice() {
	captionButtons.voice.style.backgroundImage = voice_states.off;
	l.audioToUser = null;
	l.audioToGroup = null;
	l.audioDevice.disable();
	//protocol.en
}

function Base64Encode(str, encoding = 'utf-8') {
    var bytes = new (TextEncoder || TextEncoderLite)(encoding).encode(str);        
    return base64js.fromByteArray(bytes);
}

function Base64Decode(str, encoding = 'utf-8') {
    var bytes = base64js.toByteArray(str);
    return new (TextDecoder || TextDecoderLite)(encoding).decode(bytes);
}


//----------------------------------------------------------------------------------------
// base 64 from mozilla page to github sources to convert binary to base64 etc.

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

