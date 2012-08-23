function trimarray(a){
	r = [];
	for(k in a){
		r[k] = a[k].trim();
	}
	return r;
}
var Ticket = require("./ticket");

// TODO: Replace with store
var fs = require("fs");
fs.exists(__dirname + "/../reserved/", function(exists) {
	if(!exists) fs.mkdir(__dirname + "/reserved/");
});

function getReservedDeta(room, callback){
	fs.readFile(__dirname + "/../reserved/" + room + ".txt", function(err, data) {
		if(err){ callback(null); }
		else{ callback(JSON.parse(data)); }
	});
}

function Room(tent, room_name, setupcallback){
	this.tent = tent;
	this.room_name = room_name;
	this.tickets = [];
	this.options = {
		"public" : false,
		"doors_open" : false,
		"no_new_tickets" : false
	};
	this.history = [];

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
module.exports = Room;

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
	return this.options['public'];
};

Room.prototype.makePublic = function(public) {
	this.options['public'] = public;
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
	fs.writeFile(__dirname + "/../reserved/" + this.room_name + ".txt", JSON.stringify({
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
	} else if(this.options['no_new_tickets'] == true){
		if(user != undefined){ if(user.is_admin != true){ return null; } }
		else{ return null; }
	}
	t = new Ticket( this.tickets.length + "", this);
	this.tickets[ this.tickets.length + "" ] = t;
	return t;
};
