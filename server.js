// Tent
appPort = process.env['app_port'] || 3000

var express = require('express');
var app = express();

var hogan = require("hogan.js");
var templates = {};
var fs = require("fs");
var url = require("url");

var http = require('http');

server = http.createServer(app).listen(appPort);
var io = require('socket.io').listen(server);

var tents = require("./tents");
var rooms = new tents.Tents(io);

fs.readdir(__dirname + "/templates", function(e, files){
	for(file in files){
		fname = __dirname +"/templates/"+ files[file];
		file = files[file].split(".")[0];
		data = fs.readFileSync(fname);
		
		templates[file] = hogan.compile(data+"");
	}
});

console.log("Templates Caching");

function view(req, res, data, template){
	if(req.query.format == "json"){
		res.json(data);
	} else{
		data = {"content" : templates[template].render(data)};
		data['port'] = appPort;
		res.end(templates["template"].render(data));
	}
}

app.get("/", function(req,res){
	msg = undefined;
	if(req.query.kicked != undefined){
		msg = "You were kicked";
	}
	view(req, res, {"status":"ok","message":msg}, "index");
});

function maketicket(){ return Math.floor(Math.random()*1001) + ""; }
function do_403(res){
	res.status(403).end("403. Access Denied");
}

app.get("/room/:id", function(req,res){
	// Are we allowed in?
	if(!rooms.canGainEntry(req.params.id, req.query.ticket, true)){
		do_403(res); return;
	}

	// Void the ticket
	rooms.getTicket(req.params.id, req.query.ticket).soil();
	
	view(req,res,{"status":"ok","now":"connect to websocket","ticket":req.query.ticket,"room":req.params.id,"port":appPort,"name":req.query.name},"room");
});

app.get("/bouncer", function(req,res){
	if(!rooms.roomExists(req.query.room)){
		// new room
		ticket = rooms.newRoom(req.query.room).newTicket().stampEntry();
		ticket.makeManager();

		res.redirect("/room/" + req.query.room + "?ticket=" + ticket.getName() + "&name=" + req.query.name);
	} else{
		if(req.query.sure != undefined){
			rooms.getRoom(req.query.room, function(room) {
				ticket = room.newTicket();

				io.of('/room').in("manager-" + req.query.room).emit("nock", {
					"ticket":ticket.getName(),
					"nickname":req.query.name,
					"info":req.query.info
				});
				
				res.redirect("/outside/" + req.query.room + "?ticket=" + ticket.getName() + "&name=" + req.query.name);
			});
		} else{
			view(req, res, {"status" : "exists", "room" : req.query.room, "name": req.query.name,"info":req.query.info}, "exists");
		}
	}
});

app.get("/outside/:room", function(req,res){
	if(rooms.canGainEntry(req.params.room, req.query.ticket, false)){
		res.redirect("/rooms/" + req.params.room + "?ticket=" + req.query.ticket + "&name=" + req.query.name);
	}
	if(!rooms.ticketExists(req.params.room, req.query.ticket)){ do_403(); return; }

	view(req,res,{"status":"waiting-to-join","room":req.params.room,"ticket":req.query.ticket,"name":req.query.name},"waiting");
});

app.get("/assets/:file", function(req,res){
	res.download(__dirname+"/assets/" + req.params.file, req.params.file);
});

app.get("/view/:room", function(req,res){
	//if(!rooms.roomExists(req.params.room)){ do_403(res); return; }
	//if(!rooms.getRoom(req.params.room).isPublic()){ do_403(res); return; }

	view(req,res,{"status":"ok", "room" : req.params.room},"view");
});

io.sockets.on('connection', function (socket) {
	
});

io.of("/view").authorization(function (handshakeData, callback) {
	try{
		u = url.parse( handshakeData.headers.referer, true );
		p = u.pathname.split("/");
		p = p[p.length-1];

		handshakeData.room = p;
		callback(null, true);
	} catch(e){ console.log(e); callback(null, false); }
}).on('connection', function (socket) {
	socket.join(socket.handshake.room);

	socket.on("ready", function() {
		if(!rooms.roomExists(socket.handshake.room)){
			socket.emit("public", {"public":false});
		} else{
			rooms.getRoom(socket.handshake.room, function(room) {
				history = room.getHistory();
				for(h in history){
					h = history[h];
					h['history'] = true;
					socket.emit("msg", h);
				};
			});
		}

		here = io.of("/room").clients(socket.handshake.room);
		for(p in here){
			p = here[p];
			p.get("nickname", function(e, nick){
				socket.emit("hi", {"nickname":nick,"ticket":p.handshake.ticket});
			});
		}
	});
});

// Waiting to get in
io.of("/outside").authorization(function (handshakeData, callback) {
	try{
		u = url.parse( handshakeData.headers.referer, true );

		handshakeData.my_ticket = u.query.ticket;
		callback(null, true);
	} catch(e){ callback(null, false); }
}).on('connection', function (socket) {
	socket.join("outside-" + socket.handshake.my_ticket);
});

function inRoomBroadcast(room, event, data){
	rooms.getRoom(room, function(r){
		if (r.isPublic()) {
			io.of("/view").in(room).emit(event, data);
		};
	});
	io.of("/room").in(room).emit(event, data);
}


io.of('/room').authorization(function (handshakeData, callback) {
	try{
		u = url.parse( handshakeData.headers.referer, true );
		p = u.pathname.split("/");
		p = p[p.length-1];
		ticket = u.query.ticket;

		if(!rooms.canGainEntry(p, ticket, false)){ callback(null, false); return; }
	
		handshakeData.join_room = p;
		handshakeData.nick = u.query.name;
		handshakeData.ticket = ticket;
		handshakeData.is_boss = rooms.getTicket(p, ticket).isManager();

		callback(null, true);
	} catch(e){ console.log(e); callback(null, false); }
}).on('connection', function (socket) {
	socket.set("room", socket.handshake.join_room);
	socket.join(socket.handshake.join_room);
	socket.join("ticket-" + socket.handshake.join_room + '-' + socket.handshake.ticket);

	io.on("ticket-" + socket.handshake.join_room + '-' + socket.handshake.ticket + "-rm", function(){
		socket.disconnect();
	});

	if(socket.handshake.is_boss){
		socket.join("manager-" + socket.handshake.join_room);
		socket.emit("manager",{});

		socket.on("allow", function(data){
			socket.get("room", function(e, d){
				rooms.getRoom(d, function(room) {
					room.getTicket(data.ticket).stampEntry();
					io.of("/outside").in("outside-" + data.ticket).emit("allow", {"room":d,"ticket":data.ticket});
				});
			});
		});
		socket.on("deny", function(data){
			socket.get("room", function(e, d){
				io.of("/outside").in("outside-" + data.ticket).emit("reject", {"room":d,"ticket":data.ticket});
			});
		});

		socket.on("kick", function(data){
			socket.get("room", function(e, d){
				rooms.getRoom(d, function(room) {
					room.removeTicket(data.ticket);
					inRoomBroadcast(d, "goodbye", {"ticket":data.ticket});
				});
			});
		});

		socket.on("public", function(data) {
			socket.get("room", function(e, d){
				rooms.getRoom(d,function(room) {
					room.makePublic(data.public);

					if(data.public){
						here = io.of("/room").in(socket.handshake.join_room).clients();
						io.of("/view").in(d).emit("clearusers", {});
						for(p in here){
							p = here[p];
							p.get("nickname", function(e, nick){
								io.of("/view").in(d).emit("hi", {"nickname":nick,"ticket":p.handshake.ticket});
							});
						}
						room.removeHistory();
					}

					// ONLY rule break
					io.of("/view").in(d).emit("public",{"public" : data.public});
					io.of("/room").in(d).emit("public",{"public" : data.public});
				});
			});
		});
	}
	socket.set("nickname", socket.handshake.nick);

	socket.on("ready", function() {
		inRoomBroadcast(socket.handshake.join_room,"hi", {"nickname":socket.handshake.nick,"ticket":socket.handshake.ticket});

		here = io.of("/room").clients(socket.handshake.join_room);
		for(p in here){
			p = here[p];
			p.get("nickname", function(e, nick){
				socket.emit("hi", {"nickname":nick,"ticket":p.handshake.ticket});
			});
		}

		history = rooms.getRoom(socket.handshake.join_room, function(room) {
			history = room.getHistory();
			for(h in history){
				h = history[h];
				h['history'] = true;
				socket.emit("msg", h);
			}
		});
	});
	
	socket.on("msg", function(data){
		socket.get("room", function(e, d){
			socket.get("nickname", function(e, nick){
				data['nickname'] = nick;
				rooms.getRoom(d, function(room) {
					room.pushHistory(data);
				})
				inRoomBroadcast(d, "msg", data);
			});
		});
	});
	socket.on("nick", function(data){
		socket.get("room", function(e, d){
			socket.set("nickname", data.new);
			inRoomBroadcast(d, "rename", {"ticket": socket.handshake.ticket, "nickname":data.new});
		});
	});

	socket.on('disconnect', function() {
		socket.get("room", function(e, d){
			inRoomBroadcast(d, "goodbye", {"ticket":socket.handshake.ticket});
			try{ rooms.removeTicket(d, socket.handshake.ticket); } catch(e){}
		});
	});
});

console.log("Tent is picted. http://localhost:" + appPort);
