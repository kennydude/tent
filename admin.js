// Admin functions
var fs = require("fs");

/**
 * Middleware
 */
function require_admin(req, res, next){
	if(req.user != undefined && req.user.is_admin == true){
		next();
	} else{
		res.status(403).end("You must be an admin to view this page");
	}
}

function trimarray(a){
	r = [];
	for(k in a){
		r[k] = a[k].trim();
	}
	return r;
}

module.exports = function (app, view, rooms) {
	app.all("/admin", require_admin, function(req, res){
		fs.readdir(__dirname + "/reserved", function(err, files) {
			r = [];
			for(file in files){ r.push({"name":files[file].split(".")[0]}); }
			view(req, res, {"reserved" : r,"unreserved" : req.query.unreserved}, "admin");
		});
	});

	app.get("/admin/unreserve/:id", require_admin, function(req, res) {
		fs.unlink(__dirname + "/reserved/" + req.params.id + ".txt", function() {
			rooms.getRoom(req.params.id, function(room) {
				room.reserved = false;
			});
			res.redirect("/admin?unreserved")
		});
	});

	app.all("/admin/reserved/:id", require_admin, function(req, res) {
		function finish(room){
			if(room == null){ res.status(404).end("reserved room does not exists"); }

			if(req.body && req.method == "POST"){
				room.reserved = true;
				room.forever_reserved = req.body.forever == "on";
				room.date_reserved = req.body.date;
				room.reserved_for = trimarray(req.body.for.split(","));
				room.saveReserved();

				res.redirect("/admin/reserved/" + room.room_name + "?updated");
			} else{
				view(req, res, {"room":room,"updated":req.query.updated}, "admin_reserved");
			}
		}
		if(req.method == "POST" && req.params.id != "new" && req.params.id != req.body.room_name){
			fs.unlinkSync(__dirname + "/reserved/" + req.params.id + ".txt");
		}
		
		if(req.params.id == "new" && req.method == "GET"){ room = {}; finish(room); }
		else if(req.body.room_name) rooms.getReservedRoom(req.body.room_name, finish);
		else room = rooms.getReservedRoom(req.params.id, finish);
	});
};