function loadImage(file){
	var img = new Image();
	img.src = file;
	img.onload = function() {
		imagetocanvas( this, 200, 200, true, "#FFF" );
	};
}
function resize( imagewidth, imageheight, thumbwidth, thumbheight ) {
	var w = 0, h = 0, x = 0, y = 0,
		widthratio  = imagewidth / thumbwidth,
		heightratio = imageheight / thumbheight,
		maxratio    = Math.max( widthratio, heightratio );
	if ( maxratio > 1 ) {
		w = imagewidth / maxratio;
		h = imageheight / maxratio;
	} else {
		w = imagewidth;
		h = imageheight;
	}
	x = ( thumbwidth - w ) / 2;
	y = ( thumbheight - h ) / 2;
	return { w:w, h:h, x:x, y:y };
}

function imagetocanvas( img, thumbwidth, thumbheight, crop, background ) {
	c  = document.createElement( 'canvas' );
	cx = c.getContext( '2d' );

	c.width = thumbwidth;
	c.height = thumbheight;
	var dimensions = resize( img.width, img.height, thumbwidth, thumbheight );
	if ( crop ) {
		c.width = dimensions.w;
		c.height = dimensions.h;
		dimensions.x = 0;
		dimensions.y = 0;
	}
	if ( background !== 'transparent' ) {
	 	cx.fillStyle = background;
		cx.fillRect ( 0, 0, thumbwidth, thumbheight );
	}
	cx.drawImage( 
		img, dimensions.x, dimensions.y, dimensions.w, dimensions.h 
	);

	socket.emit("msg", {"image":c.toDataURL( 'image/png' )});
}

function getFiles(evt) {
	evt = evt.originalEvent;

	evt.stopPropagation();
	evt.preventDefault();

	if(evt.dataTransfer == undefined) evt.dataTransfer = evt.target;
	var files = evt.dataTransfer.files;
	for (var i = 0, f; f = files[i]; i++) {
		if(f.size < 1024 * 1024){
			var reader = new FileReader();
			reader.readAsDataURL( f );
			if( f.type.indexOf("image") != -1){
				reader.onload = function ( ev ) {
					loadImage(ev.target.result);
				};
			} else{
				var fname = f.name;
				reader.onload = function ( ev ) {
					socket.emit("msg", {"file":ev.target.result,"filename":fname});
				};
			}
		} else{
			globalnotice("You tried to upload too big files! Go do it somewhere else!");
		}
	}
	$(".dragModal").hide("medium").data("m", "n");
	$("#upload").val("");
	return false;
}

$(".fileupload").show();
$("#upload").on("change", getFiles);
$("body").on("dragover", function(evt){
	evt = evt.originalEvent;
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
	return false;
}).on("dragleave", function(){
	console.log("leaving?");
	var tout = setTimeout(function(){
		$(".dragModal").fadeOut("medium");
	}, 500);
	return false;
}).on("drop", getFiles).on("dragenter", function(){
	if($(".dragModal").data("m") != "y"){
		if(window.tout != undefined){ clearTimeout(tout); }
		$(".dragModal").fadeIn("medium").data("m", "y");
	}
	return false;
});
