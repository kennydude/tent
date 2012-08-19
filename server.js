// Tent
appPort = process.env['app_port'] || 3000

var express = require('express');
var app = express();

var hogan = require("hogan.js");
var templates = {};
var fs = require("fs");

var rooms = {};

fs.readdir(__dirname + "/templates", function(e, files){
	for(file in files){
		fname = __dirname +"/templates/"+ files[file];
		file = files[file].split(".")[0];
		data = fs.readFileSync(fname);
		
		templates[file] = hogan.compile(data+"");
	}
});

console.log("Templates Caching");

var http = require('http');

server = http.createServer(app).listen(appPort);
var io = require('socket.io').listen(server);

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
	view(req, res, {"status":"ok"}, "index");
});

function maketicket(){ return Math.floor(Math.random()*1001) + ""; }
function do_403(res){
	res.status(403).end("403. Access Denied");
}

app.get("/room/:id", function(req,res){
	// Are we allowed in?
	if(rooms[req.params.id] == undefined){ do_403(res); return; }
	if(rooms[req.params.id]['tickets'].indexOf(req.query.ticket) == -1){ do_403(res); return; }
	
	view(req,res,{"status":"ok","now":"connect to websocket","room":req.params.id,"port":appPort,"name":req.query.name},"room");
});

app.get("/bouncer", function(req,res){
	if(rooms[req.query.room] == undefined){
		// new room
		you = maketicket();
		rooms[req.query.room] = {
			"tickets" : [you],
			"manager" : you,
			"req_tickets" : []
		};
		res.redirect("/room/" + req.query.room + "?ticket=" + you + "&name=" + req.query.name);
	} else{
		you = maketicket();
		rooms[req.query.room]['req_tickets'].push( you );
		io.of('/room').in("manager-" + req.query.room).emit("nock", {"ticket":you,"name":req.query.name,"info":req.query.info});
		
		res.redirect("/outside/" + req.query.room + "?ticket=" + you + "&name=" + req.query.name);
	}
});

app.get("/outside/:room", function(req,res){
	view(req,res,{"status":"waiting-to-join","room":req.params.room,"ticket":req.query.ticket,"name":req.query.name},"waiting");
});

app.get("/assets/:file", function(req,res){
	res.download(__dirname+"/assets/" + req.params.file, req.params.file);
});

io.sockets.on('connection', function (socket) {
	
});

io.of("/outside").authorization(function (handshakeData, callback) {
	try{
		u = url.parse( handshakeData.headers.referer, true );

		handshakeData.my_ticket = u.query.ticket;
		callback(null, true);
	} catch(e){ callback(null, false); }
}).on('connection', function (socket) {
	socket.join("outside-" + socket.handshake.my_ticket);
});

var url = require("url");

io.of('/room').authorization(function (handshakeData, callback) {
	try{
		u = url.parse( handshakeData.headers.referer, true );
		p = u.pathname.split("/");
		p = p[p.length-1];
		ticket = u.query.ticket;

		if(rooms[p] == undefined){ callback(null, false); return; }
		if(rooms[p]['tickets'].indexOf(ticket) == -1){ callback(null, false); return; }
	
		handshakeData.join_room = p;
		handshakeData.nick = u.query.name;
		handshakeData.is_boss = rooms[p]['manager'] == ticket;
		callback(null, true);
	} catch(e){ console.log(e); callback(null, false); }
}).on('connection', function (socket) {
	socket.set("room", socket.handshake.join_room);
	socket.join(socket.handshake.join_room);
	if(socket.handshake.is_boss){
		socket.join("manager-" + socket.handshake.join_room);

		socket.on("allow", function(data){
			socket.get("room", function(e, d){
				rooms[d]['tickets'].push(data.ticket);
				console.log({"room":d,"ticket":data.ticket});
				io.of("/outside").in("outside-" + data.ticket).emit("allow", {"room":d,"ticket":data.ticket});
			});
		});
		socket.on("deny", function(data){
			socket.get("room", function(e, d){
				io.of("/outside").in("outside-" + data.ticket).emit("reject", {"room":d,"ticket":data.ticket});
			});
		});
	}
	socket.set("nickname", socket.handshake.nick);

	socket.broadcast.to(socket.handshake.join_room).emit("hi", {"user":socket.handshake.nick});

	here = io.sockets.clients('room');
	for(p in here){
		p = here[p];
		p.get("nickname", function(e, nick){
			socket.emit("hi", {"user":nick});
		});
	}
	
	socket.on("msg", function(data){
		socket.get("room", function(e, d){
			socket.get("nickname", function(e, nick){
				data['nickname'] = nick;
				socket.broadcast.to(d).emit('msg', data);	
			});
		});
	});
	socket.on("nick", function(data){
		socket.get("room", function(e, d){
			socket.get("nickname", function(e, nick){
				socket.set("nickname", data.new);
				socket.broadcast.to(d).emit("rename", {"from":nick, "to":data.new});
			});
		});
	});

	socket.on('disconnect', function() {
		socket.get("room", function(e, d){
			socket.get("nickname", function(e, nick){
				socket.broadcast.to(d).emit("goodbye", {"nick":nick});
			});
		});
	});
});

console.log("Tent is picted. http://localhost:" + appPort);
