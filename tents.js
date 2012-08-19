// Tents
// Tents are rooms

function Tents(io){
	this.rooms = {};
	this.io = io;
}

/**
 * Are we allowed entry? True/False
 */
Tents.prototype.canGainEntry = function(room, ticket){
	if(this.rooms[room] == undefined) return false;
	if(!this.rooms[room].hasEntryTicket(ticket)) return false;

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

/**
 * Creates a new room
 */
Tents.prototype.newRoom = function(room) {
	r = new Room(this, room);
	this.rooms[room] = r;
	console.log("HI");
	return r;
};

Tents.prototype.getRoom = function(room) {
	return this.rooms[room];
};

Tents.prototype.roomExists = function(room){
	return this.rooms[room] != undefined;
}

Tents.prototype.removeRoom = function(room){
	delete this.rooms[room];
}

Tents.prototype.notifyRemoval = function(r, t) {
	this.io.of("/room").in("ticket-" + r + "-" + t).emit("kick",{});
};

function Room(tent, room_name){
	this.tent = tent;
	this.room_name = room_name;
	this.tickets = [];
	this.public = false;
}

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
Room.prototype.hasEntryTicket = function(ticket) {
	if(this.tickets[ticket] == undefined) return false;
	return this.tickets[ticket].canGainEntry();
};

Room.prototype.notifyManager = function(ticket) {
	this.tent.notifyManager(ticket, this.room_name);
};

/**
 * Create new ticket!
 */
Room.prototype.newTicket = function() {
	t = new Ticket( this.tickets.length + "", this);
	this.tickets[ this.tickets.length + "" ] = t;
	return t;
};

function Ticket(name, room){
	this.state = "new";
	this.tid = name;
	this.room = room;
}

Ticket.prototype.canGainEntry = function() {
	return this.state == "entry" || this.state == "manager";
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