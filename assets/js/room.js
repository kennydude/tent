// Javascript used in-room

function updateR(){
	if($(".requests .request").size() == 0){
		$(".requestNumber").hide(); $(".noRequests").show();
	} else{
		$(".requestNumber").show().text($(".requests .request").size());
		$(".noRequests").hide();
	}
}
function viewport() {
	var e = window, a = 'inner';
	if ( !( 'innerWidth' in window ) ){
		a = 'client';
		e = document.documentElement || document.body;
	}
	return { width : e[ a+'Width' ] , height : e[ a+'Height' ] }
}

function safe_feed(f){
	return f.replaceAll(":", "_").replaceAll("/", "_");
}

var Stop = $('#navBar').offset().top - parseFloat($('#navBar').css('marginTop').replace(/auto/, 0));
$("#navBar").css("width", $("#navBar").width());
$(window).scroll(function(){
	var y = $(this).scrollTop();
	if (y >= Stop) {
		// if so, ad the fixed class
		$('#navBar').addClass('fixed');
	} else {
		// otherwise remove it
		$('#navBar').removeClass('fixed');
	}
});

include(["/assets/jquerypp.js", "/assets/hogan.js", "/assets/md5.js", "/assets/jquery.foundation.reveal.js"], function() {

	include("/assets/jquery.foundation.accordion.js", function() {
		$(document).foundationAccordion();
	});
	include("/assets/basechat.js");
	$("#kickModal .close").click(function() {
		$("#kickModal").trigger("reveal:close");
	});	
	var reqTemplate = Hogan.compile($(".reqTemplate").html());
	var feedTemplate = Hogan.compile($(".feedTemplate").html());

	$("#multiline").on("change", function() {
		mline = $("#multiline").attr("checked") != undefined;
		if(mline){
			$(".singleLine").hide();
			$(".multilineEd").show();
		} else{
			$(".singleLine").show();
			$(".multilineEd").hide();
		}
	});
	$("#multilineEd").on("keydown", function(e){
		if(e.keyName() == "\r"){
			$("#multilineEd").attr("rows", $("#multilineEd").val().split("\n").length+1);
		}
	});
	$("#send_multiline").click(function() {
		socket.emit("msg", {"message":$("#multilineEd").val()});
		$("#multilineEd").val("");
	});

	$("#nickname").on("keydown", function(e){
		if(e.keyName() == "\r"){
			socket.emit("nick", {"new": $("#nickname").val()});
			renameUser({"nickname" : $("#nickname").val(),"ticket" : myTicket});
			myNickName = $("#nickname").val();
		}
	});
	$("#composer").on("keydown", function(e){
		if(e.keyName() == "\r"){
			data = {"message":$("#composer").val()};
			socket.emit("msg", data);
			$("#composer").val("");
		}
	});
	$("#sub_feed").on("keydown", function(e){
		if(e.keyName() == "\r"){
			data = {"feed":$("#sub_feed").val()};
			socket.emit("sub_feed", data);
			$("#sub_feed").val("");
		}
	});
	$("#public_room").on("change",function() {
		socket.emit("public", {"public" : $("#public_room").attr("checked") != undefined});
		if( $("#public_room").attr("checked") != undefined ){
			$(".public").show();
		} else{
			$(".public").hide();
		}
	});
	
	$(".option").on("change", function() {
		val = $(this).val();
		if($(this).attr("type") == "checkbox"){
			val=$(this).attr("checked")!=undefined;
		}
		socket.emit("set_option", {"option":$(this).data("option"),"value":val})
	});
	socket.on("option", function(data) {
		if(typeof(data.value) == "boolean"){
			if(data.value == true){
				$("input[data-option=" + data.option + "]").attr("checked", "checked");
			} else{
				$("input[data-option=" + data.option + "]").removeAttr("checked");
			}
		}
	});

	socket.on("manager", function(){
		$("<style>").attr("id", "managerStyle").html(".manager{display:block !important;}").appendTo("head");
	});
	socket.on("kick", function(){
		document.location.href = "/?kicked&room=" + room;
	});
	socket.on("newfeed", function(data) {
		f = $("<div>").attr("id", "feed-" + safe_feed(data.feed)).html(feedTemplate.render({"name":data.feed})).appendTo("#feeds");
		$(".rm", f).click(function() {
			socket.emit("rmfeed", {"feed" : data.feed});
			$(this).closest(".row").addClass("grey");
		}).data("feed", data.feed);
	});
	socket.on("rmfeed", function(data) {
		$("#feed-" + safe_feed(data.feed)).remove();
	});

	socket.on("nock", function(data){
		d = $( reqTemplate.render(data) ).appendTo(".requests");

		$(".allow", d).click(function(){
			socket.emit("allow", {"ticket":$(this).data("ticket")});
			$(this).parent().remove();
			updateR();
		}).data("ticket", data.ticket);

		$(".deny", d).text("no").click(function(){
			socket.emit("deny", {"ticket":$(this).data("ticket")});
			$(this).parent().remove();
			updateR();
		}).data("ticket", data.ticket);

		updateR();
	});

	if (window.File && window.FileReader && window.FileList && window.Blob && window.Image) {
		include("/assets/chatfiles.js");
	}
	$(".wait").hide();
});
