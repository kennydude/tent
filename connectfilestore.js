// @kennydude's ConnectJS File Store for sessions

/**
 * Module dependencies.
 */
connect = 'express/node_modules/connect/lib/';

var Store = require(connect + 'middleware/session/store')
  , utils = require(connect + 'utils')
  , Session = require(connect + 'middleware/session');
var fs = require("fs");

/**
 * Initialize a new `FileStore`.
 *
 * @api public
 */

var FileStore = module.exports = function FileStore(options) {
	this.sessions = {};
	this.folder = options.folder;
	fs.exists(this.folder + "/", function(exists){
		if(!exists) fs.mkdir(this.folder+"/");
	});
};

/**
 * Inherit from `Store.prototype`.
 */

FileStore.prototype.__proto__ = Store.prototype;

/**
 * Attempt to fetch session by the given `sid`.
 *
 * @param {String} sid
 * @param {Function} fn
 * @api public
 */

FileStore.prototype.get = function(sid, fn){
	if(this.sessions[sid] != undefined) return fn(null, this.sessions[sid]);
	fs.readFile(this.folder + "/" + sid + ".txt", function(err, data){
		if(err){ fn(err); }
		else{
			fn(null, JSON.parse(data));
		}
	});
};

/**
 * Commit the given `sess` object associated with the given `sid`.
 *
 * @param {String} sid
 * @param {Session} sess
 * @param {Function} fn
 * @api public
 */

FileStore.prototype.set = function(sid, sess, fn){
	fs.writeFile(this.folder + "/" + sid + ".txt", JSON.stringify(sess), function(err){
		fn(err);
	});
	this.sessions[sid] = sess;
};

/**
 * Destroy the session associated with the given `sid`.
 *
 * @param {String} sid
 * @api public
 */

FileStore.prototype.destroy = function(sid, fn){
	fs.unlink(this.folder + "/" + sid + ".txt", function(err){
		fn(err);
	});
	delete this.sessions[sid];
};

