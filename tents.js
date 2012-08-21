// Tents
// Tents are rooms
var fs = require("fs");
fs.exists(__dirname + "/reserved/", function(exists) {
	if(!exists) fs.mkdir(__dirname + "/reserved/");
});

function Tents(io){
	this.rooms = {};
	this.io = io;
	this.subscribed = {};
}

Tents.prototype.subscribeToFeed = function(label, room) {
	if(this.subscribed[label] == undefined) this.subscribed[label] = [];
	this.subscribed[label].push(room);
	this.getRoom(room, function() {
		r.broadcastMessage("newfeed", {"feed" : label});
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
					"data" : data
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
	return this.rooms[room].getTicket(ticket);
};

Tents.prototype.removeTicket = function(room, ticket) {
	this.rooms[room].removeTicket(ticket);
	this.io.emit("ticket-" + room + "-" + ticket + "-rm", {});
};

Tents.prototype.notifyManager = function(ticket, room) {
	this.io.of('/room').in("ticket-" + room + "-" + ticket).emit("manager",{});
};

function getReservedDeta(room, callback){
	fs.readFile(__dirname + "/reserved/" + room + ".txt", function(err, data) {
		if(err){ callback(null); }
		else{ callback(JSON.parse(data)); }
	});
}

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

function trimarray(a){
	r = [];
	for(k in a){
		r[k] = a[k].trim();
	}
	return r;
}

function Room(tent, room_name, setupcallback){
	this.tent = tent;
	this.room_name = room_name;
	this.tickets = [];
	this.public = false;
	this.history = [];
	this.allow_new_tickets = true;

	var self = this;
	getReservedDeta(room_name, function(rdata){
		if(rdata != null){
			self.reserved = true;
			self.reserved = true;
			self.forever_reserved = rdata['forever'];
			self.reserved_for = trimarray(rdata['for'].split(","));
			self.reserved_date = rdata['date'];
		} else{
			this.reserved = false;
		}
		if(setupcallback != undefined)
			setupcallback(self);
	});
}

Room.prototype.pushHistory = function(h) {
	while(this.history.length > 5){
		this.history.shift();
	}
	this.history.push(h);
};

Room.prototype.getHistory = function() {
	return this.history;
};

Room.prototype.removeHistory = function() {
	this.history = [];
};

Room.prototype.isPublic = function() {
	return this.public;
};

Room.prototype.makePublic = function(public) {
	this.public = public;
};

Room.prototype.getTicket = function(ticket) {
	return this.tickets[ticket];
};

Room.prototype.removeTicket = function(ticket) {
	delete this.tickets[ticket];
	this.tent.notifyRemoval(this.room_name, ticket);
	this.doManagerCheck();
};

Room.prototype.doManagerCheck = function(){
	for(ticket in this.tickets){
		if(this.tickets[ticket].isManager()){
			return true;
		}
	}
	// NOOO, There's no managers left! Promote someone quick!
	for(ticket in this.tickets){
		if(this.tickets[ticket].makeManager()){
			return true;
		}
	}

	// Worst thing ever, close the room up
	console.log("Room "+this.room_name+" has closed");
	this.tent.removeRoom(this.room_name);
};

/**
 * Does this room have the specified ticket?
 */
Room.prototype.hasEntryTicket = function(ticket, check_soiled) {
	if(this.tickets[ticket] == undefined) return false;
	return this.tickets[ticket].canGainEntry(check_soiled);
};

Room.prototype.notifyManager = function(ticket) {
	this.tent.notifyManager(ticket, this.room_name);
};

Room.prototype.saveReserved = function() {
	if(this.reserved_for == undefined) this.reserved_for = [];
	fs.writeFile(__dirname + "/reserved/" + this.room_name + ".txt", JSON.stringify({
		"forever" : this.forever_reserved,
		"for" : this.reserved_for.join(","),
		"date" : this.reserved_date
	}));
};

Room.prototype.broadcastMessage = function(event, data) {
	if (this.isPublic()) {
		this.tent.io.of("/view").in(this.room_name).emit(event, data);
	}
	this.tent.io.of("/room").in(this.room_name).emit(event, data);
};

function getRDate(){
	now = new Date();
	return now.getDay() + "/" + now.getMonth() + "/" + now.getFullYear();
}

/**
 * Create new ticket!
 */
Room.prototype.newTicket = function(user) {
	if(user == undefined && this.reserved == true){
		return null;
	} else if(this.reserved == true){
		if(this.forever_reserved || this.reserved_date == getRDate()){
			if(this.reserved_for.indexOf(user.name) == -1 && user.is_admin != true){
				return null;
			}
		}
	} else if(this.allow_new_tickets == false){
		if(user != undefined){ if(user.is_admin != true){ return null; } }
		else{ return null; }
	}
	t = new Ticket( this.tickets.length + "", this);
	this.tickets[ this.tickets.length + "" ] = t;
	return t;
};

function Ticket(name, room){
	this.state = "new";
	this.tid = name;
	this.room = room;
	this.soiled = false;
}

Ticket.prototype.soil = function() {
	this.soiled = true;
};

Ticket.prototype.canGainEntry = function(check_soiled) {
	if(this.soiled && check_soiled == true){ return false; }
	return (this.state == "entry" || this.state == "manager");
};

Ticket.prototype.isManager = function() {
	return this.state == "manager";
};

Ticket.prototype.makeManager = function() {
	if(this.state == "new") return false;
	if(this.state == "manager") return true;

	this.state = "manager";
	this.room.notifyManager(this.tid);
	return true;
};

Ticket.prototype.getName = function() {
	return this.tid;
};

Ticket.prototype.stampEntry = function() {
	this.state = "entry";
	return this;
};


// Exports
module.exports.Ticket = Ticket;
module.exports.Tents = Tents;
module.exports.Room = Room;