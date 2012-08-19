<h1>{{ room }}</h1>
<div class="hide panel hide-on-connect"><p>You seem to have dropped out. Please wait while we connect you again</p><img src="/assets/wait.gif" /></div>
<div class="row">
	<div id="thechat" class="nine columns">
		
	</div>
	<div class="three columns">
		<div class="me">
			<input type="text" id="nickname" value="{{ name }}" class="nickname" /><br/>
			<a class="button" id="savenick">save</a>
		</div>
		<div class="requests">
			
		</div>
		<div class="peopleHere">
		</div>
	</div>
</div>
<div class="chatTemplate hide">
{{=<% %>=}}
<div class="row chatRow">
	<div class="theRow ten columns">
		<strong>{{ nickname }}:</strong> {{ message }}
	</div>
</div>
<%={{ }}=%>
</div>
<div id="composer_box">
	<input type="text" id="composer" placeholder="talk here" />
</div>
<script type="text/javascript" src="/assets/jquerypp.js"></script>
<script type="text/javascript" src="/assets/hogan.js"></script>
<script type="text/javascript" src="/assets/md5.js"></script>
<script>
String.prototype.replaceAll=function(s1, s2) {return this.split(s1).join(s2)}

moreRoom = "/room";
var myNickName = "{{ name }}";
var chatTemplate = Hogan.compile($(".chatTemplate").html());

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
	$(".theRow", d).css("border-left", "3px solid " + colorHash(data.nickname));
	document.body.scrollTop = d.offset().top;
}

function renameUser(data){
	$("." + data.from.replaceAll(" ", "_"), ".peopleHere").removeClass(data.from.replaceAll(" ", "_")).addClass(data.to.replaceAll(" ", "_")).css("border-left", "3px solid " + colorHash(data.to)).text(data.to);
}

$(document).ready(function(){
	$("#savenick").click(function(){
		socket.emit("nick", {"new": $("#nickname").val()});
		renameUser({"from":myNickName, "to" : $("#nickname").val()});
		myNickName = $("#nickname").val();
	});
	$("#composer").on("keydown", function(e){
		if(e.keyName() == "\r"){
			data = {"message":$("#composer").val(), "nickname":myNickName};
			socket.emit("msg", data);
			addMsg(data);
			$("#composer").val("");
		}
	});
	socket.on("rename", function(data){
		renameUser(data);
	});
	socket.on("hi", function(data){
		$("<div>").addClass(data.user.replaceAll(" ", "_")).css("border-left", "3px solid " + colorHash(data.user)).text(data.user).appendTo(".peopleHere");
	});
	socket.on("goodbye", function(data){
		$("." + data.from.replaceAll(" ", "_"), ".peopleHere").remove();
	});
	socket.on("msg", function(data){
		addMsg(data);
	});
	socket.on("nock", function(data){
		d = $("<div>").text("Can " + data.name + " join in?").appendTo(".requests");
		$("<div>").css("text-size","75%").text("Notes: "+ data.info).appendTo(d);
		$("<a>").text("ok").click(function(){
			socket.emit("allow", {"ticket":$(this).data("ticket")});
			$(this).parent().remove();
		}).addClass("button small").appendTo(d).data("ticket", data.ticket);
		$("<a>").text("no").click(function(){
			socket.emit("deny", {"ticket":$(this).data("ticket")});
			$(this).parent().remove();
		}).addClass("button small").appendTo(d).data("ticket", data.ticket);
	});
});
</script>
