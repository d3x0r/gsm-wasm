
(Original source and documetnation)[https://github.com/d3x0r/gsm)


```
	var gsm = _gsm_create();

	var compress_partial_buffer_idx = 0;
	var compress_partial_buffer_heap = Module._malloc( 160*2 );
	var compress_partial_buffer = new Int16Array( Module.HEAP16.buffer, compress_partial_buffer_heap, 160 );

 	_gsm_encode( gsm
 			  , compress_partial_buffer_heap
 			  , compress_buffer_heaps[compress_segments] );



 	var decode_buffer_heap = Module._malloc( data.length );
 	var decode_buffer = new Uint8Array( Module.HEAPU8.buffer, decode_buffer_heap, data.length );
 	decode_buffer.set( data, 0 )```
 	for( n = 0; n < datalen; n ++ )
 	{
 		_gsm_decode( gsm, decode_buffer_heap + n*33, decompress_buffer + 2 * n * 160 );
 	}
 	var u16 = new Int16Array( Module.HEAP16.buffer, decompress_buffer, n*160 );

```