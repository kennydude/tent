// Basic Chat. Shared betweet /view and /room

var chatTemplate = Hogan.compile('<div class="row chatRow">'+
'		<div class="theRow ten columns">' + 
'			<strong>{{ nickname }}:</strong> {{ message }}' +
'		</div>' +
'	</div>');

var userTemplate = Hogan.compile('<div class="row" id="user-{{ ticket }}">' +
'		<div class="ten columns">' + 
'			{{ nickname }}' +
'		</div>' +
'		<div class="manager hide">' +
'			<a class="kick" href="#">kick</a>' +
'		</div>' +
'	</div>');

function colorHash(str){
	md5 = hex_md5(str);
	colors = md5.match(/([\dABCDEF]{6})/ig);
	var color = parseInt(colors[0], 16);
	var red   = (color >> 16) & 255;
	var green = (color >> 8) & 255;
	var blue  = color & 255;
	var hex   = $.map([red, green, blue], function(c, i) {
		return ((c >> 4) * 0x10).toString(16);
	}).join('');

	return "#" + hex;
}

function addMsg(data){
	d = $("<div>").html(chatTemplate.render(data)).appendTo("#thechat");
	if(data.history != undefined){
		d.addClass("old");
	}
	$(".theRow", d).css("border-left", "3px solid " + colorHash(data.nickname));
	document.body.scrollTop = d.offset().top;
}

function doUEvent(el, data){
	$(".kick", el).click(function(){
		socket.emit("kick", {"ticket":$(this).data("ticket")});
	}).data("ticket", data.ticket);

	el.css("border-left", "3px solid " + colorHash(data.nickname));
}

function renameUser(data){
	u = $("#user-" + data.ticket).html( userTemplate.render(data) );
	doUEvent(u, data);
}

$(document).ready(function(){
	socket.on("public", function(d) {
		if(d.public){
			$(".public").show();
			$(".non-public").hide();
		} else{
			$(".public").hide();
			$(".non-public").show();
		}
	});

	socket.on("clearusers", function() {
		$(".peopleHere").html('');
	});

	socket.on("rename", function(data){
		renameUser(data);
	});
	socket.on("hi", function(data){
		if($("#user-" + data.ticket).size() == 0){
			doUEvent( $( userTemplate.render( data ) ).appendTo(".peopleHere"), data );
		}
	});
	socket.on("goodbye", function(data){
		$("#user-" + data.ticket, ".peopleHere").remove();
	});

	socket.on("msg", function(data){
		addMsg(data);
	});
});