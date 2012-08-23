// Tents
// Tents are rooms

function Tents(io){
	this.rooms = {};
	this.io = io;
	this.subscribed = {};
}

Tents.prototype.subscribeToFeed = function(label, room) {
	if(this.subscribed[label] == undefined) this.subscribed[label] = [];
	if(this.subscribed[label].indexOf(room) != -1) return;
	this.subscribed[label].push(room);
	this.getRoom(room, function(r) {
		r.broadcastMessage("newfeed", {"feed" : label});
	});
};
Tents.prototype.unsubscribeToFeed = function(label, room) {
	if(this.subscribed[label] == undefined) return;
	f = this.subscribed[label].indexOf(room);
	delete this.subscribed[label][f];
	this.getRoom(room, function() {
		r.broadcastMessage("rmfeed", {"feed":label});
	});
};

Tents.prototype.pingMessage = function(label, data) {
	if(this.subscribed[label] != undefined){
		for(room in this.subscribed[label]){
			room = this.subscribed[label][room];
			this.getRoom(room, function(r) {
				r.broadcastMessage("msg", {
					"type" : "hook",
					"label" : label,
					"data" : data,
					"is_hook" : true
				});
			});
		}
	}
};

/**
 * Are we allowed entry? True/False
 */
Tents.prototype.canGainEntry = function(room, ticket, check_soiled){
	if(this.rooms[room] == undefined) return false;
	if(!this.rooms[room].hasEntryTicket(ticket, check_soiled)) return false;

	return true; 
};

Tents.prototype.ticketExists =function(room, ticket) {
	if(this.rooms[room] == undefined) return false;
	if(this.rooms[room].getTicket(ticket) == undefined) return false;
	return true;
};

Tents.prototype.getTicket = function(room, ticket) {
	if(this.rooms[room] == undefined){ return undefined; }
	return this.rooms[room].getTicket(ticket);
};

Tents.prototype.removeTicket = function(room, ticket) {
	this.rooms[room].removeTicket(ticket);
	this.io.emit("ticket-" + room + "-" + ticket + "-rm", {});
};

Tents.prototype.notifyManager = function(ticket, room) {
	this.io.of('/room').in("ticket-" + room + "-" + ticket).emit("manager",{});
};

Tents.prototype.getReservedRoom = function(room, callback) {
	this.getRoom(room, callback);
};

/**
 * Creates a new room
 */
Tents.prototype.newRoom = function(room, callback) {
	var self = this;
	r = new Room(this, room, function(r) {
		self.rooms[room] = r;
		callback(r);
	});
	return r;
};

Tents.prototype.getRoom = function(room, callback) {
	room = room.toLowerCase();
	if(this.roomExists(room)){
		callback(this.rooms[room]);
	} else{
		var self = this;
		r = new Room(this, room, function(t) {
			self.rooms[room] = t;
			callback(self.rooms[room]);
		});
	}
};

Tents.prototype.emptyRoom = function(room, callback) {
	this.getRoom(room, function(r) {
		if(r.tickets.length <= 0){callback(true, r);}
		else{callback(false, r);}
	});
};

Tents.prototype.roomExists = function(room){
	return this.rooms[room] != undefined;
}

Tents.prototype.removeRoom = function(room){
	this.io.of("/view").in(room).emit("public", {"public":false});
	delete this.rooms[room];
}

Tents.prototype.notifyRemoval = function(r, t) {
	this.io.of("/room").in("ticket-" + r + "-" + t).emit("kick",{});
};

var Ticket = require("./ticket");
var Room = require("./room");

// Exports
module.exports.Ticket = Ticket;
module.exports.Tents = Tents;
module.exports.Room = Room;
