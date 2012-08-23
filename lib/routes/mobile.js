// Mobile APIs

module.exports = function(app, rooms, view) {

	app.get("/mobile", function(req, res) {
		res.end("Mobile API coming soon from Tent <3");
	});

	app.post("/mobile/send", function(req, res) {
		ticket = rooms.getTicket(req.body['room'], req.body['ticket']);
		if(ticket == undefined){
			res.status(403).end("403. Ticket does not exist on this Tent");
		} else if(ticket.is_mobile == false){
			res.status(403).end("403. Ticket is not authorized for use via mobile API")
		}
		ticket.emitter.emit(req.body['event'], req.body['data']);
		res.end("ok");
	});

	app.post("/mobile/new", function(req, res) {
		res.status(404).end("Not implemented");
	});

};