// Basic Chat. Shared betweet /view and /room

var chatTemplate = Hogan.compile('<div class="row chatRow">'+
'		<div class="theRow ten columns">' + 
'			{{#label}}<strong>{{ label }}</strong>: {{/label}}'+
'			{{#nickname}}<strong>{{ nickname }}:</strong>{{/nickname}} {{ message }}{{ html }}' +
'			{{^html}}{{ text }}{{/html}}' +
'			{{#image}}<img src="{{& image }}" />{{/image}}' +
'			{{#file}}<a href="{{file}}" target="_blank">attached a file {{filename}}</a>{{/file}}' +
'		</div>' +
'	</div>');

var userTemplate = Hogan.compile('<div class="row nickname">' +
'		<div class="ten columns">' + 
'			{{ nickname }}' +
'		</div>' +
'		<div class="manager hide">' +
'			<a class="kick" href="#">kick</a>' +
'			<a class="demote hide" href="#">demote</a>' +
'			<a class="promote hide" title="make a manager" href="#">promote</a>' +
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
	document.body.scrollTop = d.offset().top  +d.height();
}

function doUEvent(el, data){
	$(".kick", el).click(function(){
		$("#kickModal .kick").click(function() {
			socket.emit("kick", {"ticket":$(this).data("ticket")});
		}).data("ticket", $(this).data("ticket"));
		$("#kickModal .user").text($(this).data("nick"));
		$("#kickModal").reveal();
	}).data("ticket", data.ticket).data("nick", data.nickname);
	$(".promote", el).click(function(){
		socket.emit("promote", {"ticket":$(this).data("ticket")});
	}).data("ticket", data.ticket).data("nick", data.nickname);
	
	$(".demote", el).click(function(){
		socket.emit("demote", {"ticket":$(this).data("ticket")});
	}).data("ticket", data.ticket).data("nick", data.nickname);

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
			doUEvent( $("<div>").attr("id", "user-" + data.ticket).html( userTemplate.render( data ) ).appendTo(".peopleHere"), data );
		}
	});
	socket.on("goodbye", function(data){
		$("#user-" + data.ticket, ".peopleHere").remove();
	});

	socket.on("msg", function(data){
		addMsg(data);
	});
	socket.emit("ready", {});
});
