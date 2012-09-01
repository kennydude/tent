if(window.moreRoom == undefined){ moreRoom = ''; }
url = 'http://' + document.location.host + moreRoom;
console.log(url);
var socket = io.connect(url);

socket.on('connect', function () {
	$(".hide-on-connect").hide();
	$(".show-on-connect").show();
});
socket.on('disconnect', function () {
	$(".hide-on-connect").show();
	$(".show-on-connect").hide();
});
socket.on('connect_failed', function () {
	$(".hide-on-connect").show();
	$(".show-on-connect").hide();
});
socket.on('reconnect', function () {
	$(".hide-on-connect").hide();
	$(".show-on-connect").show();
});

socket.on("reject", function(){
	$(".rejected").show();
});

socket.on('servermsg', function (data) {
	if(data.event == "closedown"){
		$("#closedown").show();
	}
});

if(window.socketReady != undefined){ window.socketReady(); }

function globalnotice(msg){
	if(window.gtout != undefined){ clearTimeout(gtout); }
	$("#globalnotice").html(msg).show();
	var gtout = setTimeout(function(){
		$("#globalnotice").fadeOut();
	}, 3000);
}
