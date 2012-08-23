function Ticket(name, room){
	this.state = "new";
	this.tid = name;
	this.room = room;
	this.soiled = false;
	this.emitter = undefined;
	this.nickname = "";
	this.is_mobile = false;
}
module.exports = Ticket;

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

/**
 * Setup my event emitter. This is used to seperate code out so it can work on mobile
 */
Ticket.prototype.setupEvents = function(socket){
	var self = this;
	this.emitter = socket;

	socket.on("nick", function(data){
		self.nickname = data['new'];
		self.room.broadcastMessage("rename", { "ticket":self.tid, "nickname":data['new'] });
	});
	socket.on("msg", function(data) {
		data['nickname'] = self.nickname;
		self.room.pushHistory(data);
		self.room.broadcastMessage("msg", data);
	});

	socket.on("set_option", function(data) {
		if(!self.isManager()) return;
		self.room.options[data['option']] = data['value'];
		self.room.broadcastMessage("option", data);
	});

	socket.on("sub_feed", function(data) {
		if(!self.isManager()) return;
		self.room.tent.subscribeToFeed(data['feed'], self.room_name);
	});
	socket.on("rmfeed", function(data) {
		if(!self.isManager()) return;
		self.room.tent.unsubscribeToFeed(data['feed'], self.room_name);
	});
	socket.on("kick", function(data){
		self.room.removeTicket(data['ticket']);
		self.room.broadcastMessage("goodbye", {"ticket":data['ticket']});
	});
};
