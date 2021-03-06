// Tent
appPort = process.env['app_port'] || 3000
appHost = (process.env['site'] || "localhost:3000");
// You should change this otherwise only me (Joe) can admin your tent!
admins = (process.env['tent_admins'] || "twitter:21428122").split(",");
// To scale beyond a tiny tiny instance you NEED to change this too!
var data_store = process.env['store'] || "file";
data_store = (function(s){
	if(s == "file"){
		return new require("./lib/stores/file.js")({"folder":__dirname+"/sessions"});
	} else if(s.indexOf("couchdb") == 0){
		return undefined; // TODO
	}
})(data_store);

var express = require('express');
var app = express();

// Auth
var passport = require('passport'),
	TwitterStrategy = require('passport-twitter').Strategy;
passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});
passport.use(new TwitterStrategy({
		consumerKey: "EquK2nDArHHTf3M5QpVAtQ",
		consumerSecret: "yKfvZY3kGzWcoAENtSvBeWZHHqm04QeeNojlHmudzuQ",
		callbackURL: "http://"+appHost+"/auth/twitter"
	},
	function(token, tokenSecret, profile, done) {
		return done(null,{ "id" : "twitter:" + profile.id, "name" : "@" + profile.username });
	}
));
app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.json());
	app.use(express.cookieParser('shhhh, very secret'));
	var cookiemiddle = [];

	// We do this to save resources + get around EU cookie law
	app.use(function(req, res, next) {
		if(req.signedCookies['connect.sid'] != undefined || req.path.indexOf("/auth/") == 0){
			function gnex(i){
				if(cookiemiddle[i] != undefined){
					cookiemiddle[i](req, res, function(){ gnex(i+1); });
				} else{
					next();
				}
			}
			gnex(0);
		} else{
			next();
		}
	});
	cookiemiddle.push(express.session({store: data_store }));
	cookiemiddle.push(passport.initialize());
	cookiemiddle.push(passport.session());
	cookiemiddle.push(function(req, res, next) {
		if(req.user != undefined){
			if(admins.indexOf(req.user.id) != -1){
				req.user.is_admin = true;
			}
			req.query.name = req.user.name;
		}
		next();
	});

	app.use(app.router);
});

app.get('/auth/twitter', passport.authenticate('twitter', { failureRedirect: '/login?failure' }), function(req,res) {
	res.redirect('/?hi');
});

// Sockets
var http = require('http');
server = http.createServer(app).listen(appPort);
var io = require('socket.io').listen(server);

// Tents
var tents = require("./lib/tents");
var rooms = new tents.Tents(io);

// Templates
var hogan = require("hogan.js");
var templates = {};
var fs = require("fs");
var url = require("url");
fs.readdir(__dirname + "/templates", function(e, files){
	for(file in files){
		fname = __dirname +"/templates/"+ files[file];
		file = files[file].split(".")[0];
		data = fs.readFileSync(fname);
		
		templates[file] = hogan.compile(data+"");
	}
});
console.log("Templates Caching");

// Minify
var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;
var assetcache = {};
function minify(file) {
	fs.readFile(__dirname + "/assets/js/" + file, function(er, data) {
		ast = jsp.parse(data.toString());
		ast = pro.ast_squeeze(ast);
		assetcache[file] = pro.gen_code(ast);
	});
}
fs.exists(__dirname + "/assets/live", function(exists) {
	if(!exists) fs.mkdir(__dirname + "/assets/live/", function(e) { console.log(e); });
	fs.readdir(__dirname + "/assets/js/", function(er, files) {
		for(file in files){
			var file = files[file];
			minify(file);
		}
	});
	fs.readdir(__dirname + "/assets/other/", function(er, files) {
		for(file in files){
			(function(path) {
				fs.readFile(__dirname + "/assets/other/" + path, function(err, data) {
					assetcache[ path ] = data;
				});
			})(files[file]);
		}
	});
});

function view(req, res, data, template){
	if(req.query.format == "json"){
		res.json(data);
	} else{
		data = {"content" : templates[template].render(data)};
		data['port'] = appPort;
		if(req.user != undefined){
			data['userid'] = req.user.id;
			data['username'] = req.user.name;
			data['is_admin'] = req.user.is_admin;
		}
		res.end(templates["template"].render(data));
	}
}

require("./admin.js")(app, view, rooms);
require("./hooks.js")(app, rooms, view);
require("./lib/routes/mobile")(app, rooms, view);

app.get("/", function(req,res){
	msg = undefined;
	msgClass = "alert"
	if(req.query.kicked != undefined){
		msg = "You were kicked";
	} else if(req.query.notickets != undefined){
		msg = "Sorry, we couldn't give you a ticket to that room";
	} else if(req.query.bye != undefined){
		msg = "You were logged out";
		msgClass = "success;"
	} else if(req.query.hi != undefined && req.user != undefined){
		msg = "Hi there " + req.user.name;
		msgClass = "success";
	}
	data = {"status":"ok","message":msg, "message_type" : msgClass,"join":req.query.room};
	if(req.user){
		data['userid'] = req.user.id;
		data['username'] = req.user.name;
	}
	view(req, res, data, "index");
});

app.get("/login", function(req, res) {
	view(req, res, {}, "login");
});
app.get("/logout", function(req, res) {
	 req.session.destroy(function(err){
	 	res.redirect("/?bye");
	 });
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

function stamp_and_enter(room, ticket, res, req){
	ticket.stampEntry();
	res.redirect("/room/" + room.room_name + "?ticket=" + ticket.getName() + "&name=" + req.query.name);
}

app.get("/bouncer", function(req,res){
	rooms.emptyRoom(req.query.room, function(empty, room){
		if(empty){
			// new room
			ticket = room.newTicket(req.user);
			if(ticket == null || ticket == undefined){ res.redirect("/?notickets"); return; }
			ticket.stampEntry();
			ticket.makeManager();
			ticket.nickname = req.query.name;
	
			stamp_and_enter(room, ticket, res, req);
			//res.redirect("/room/" + req.query.room + "?ticket=" + ticket.getName() + "&name=" + req.query.name);
		} else{
			if(req.query.sure != undefined){
				ticket = room.newTicket(req.user);
				ticket.nickname = req.query.name;
				//console.log(room.options);
				if(ticket == null || ticket == undefined){ res.redirect("/?notickets"); return; }
				if(req.user != undefined){if( req.user.is_admin == true){
					// Admin is required entry
					ticket.stampEntry();
					ticket.makeManager();
					stamp_and_enter(room, ticket, res, req);
				}} else if(room.options['doors_open'] == true){
					stamp_and_enter(room, ticket, res, req);
				} else{

					io.of('/room').in("manager-" + req.query.room).emit("nock", {
						"ticket":ticket.getName(),
						"nickname":req.query.name,
						"info":req.query.info
					});
					
					res.redirect("/outside/" + req.query.room + "?ticket=" + ticket.getName() + "&name=" + req.query.name);
				}
			} else{
				view(req, res, {"status" : "exists", "room" : req.query.room, "name": req.query.name,"info":req.query.info}, "exists");
			}
		}
	});
});

app.get("/outside/:room", function(req,res){
	if(rooms.canGainEntry(req.params.room, req.query.ticket, false)){
		res.redirect("/rooms/" + req.params.room + "?ticket=" + req.query.ticket + "&name=" + req.query.name);
	}
	if(!rooms.ticketExists(req.params.room, req.query.ticket)){ do_403(res); return; }

	view(req,res,{"status":"waiting-to-join","room":req.params.room,"ticket":req.query.ticket,"name":req.query.name},"waiting");
});

var mime = require("mime");
app.get("/assets/:file", function(req,res){
	path = req.params.file;
	if(assetcache[path] != undefined){
		res.type(mime.lookup(path));
		res.end(assetcache[path]);
	} else{
		res.status(404).end("404");
	}
});

app.get("/view/:room", function(req,res){
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
	rooms.getTicket(socket.handshake.join_room, socket.handshake.ticket).setupEvents(socket);

	socket.set("nickname", socket.handshake.nick);

	socket.on("ready", function() {
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
		here = io.of("/room").clients(socket.handshake.join_room);
		for(p in here){
			p = here[p];
			p.get("nickname", function(e, nick){
				socket.emit("hi", {"nickname":nick,"ticket":p.handshake.ticket});
			});
		}

		rooms.getRoom(socket.handshake.join_room, function(room) {
			room.broadcastMessage("hi", {"nickname":socket.handshake.nick,"ticket":socket.handshake.ticket})
			history = room.getHistory();
			for(h in history){
				h = history[h];
				h['history'] = true;
				socket.emit("msg", h);
			}
		});
	});

	socket.on('disconnect', function() {
		var ticket = socket.handshake.ticket;
		rooms.getRoom(socket.handshake.join_room, function(room) {
			room.broadcastMessage( "goodbye", {"ticket":ticket});
			try{ rooms.removeTicket(d,ticket); } catch(e){console.log(e);}
		});
	});
});

console.log("Tent is picted. http://localhost:" + appPort);
