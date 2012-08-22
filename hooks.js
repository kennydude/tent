// Hooks

// Add your own: make a url (please use /hooks/hookname/whatever/else )
// When you get a push, make sure to call rooms.pingMessage( 'a label for your message like github:kennydude/tent', json )
// The json can just have 'html' to render
// and 'markdown'

module.exports = function (app, rooms, view) {
	app.get("/hooks/docs", function(req, res) {
		var fs = require("fs");
		fs.readFile(__dirname + "/docs/hooks.markdown", function(err, data) {
			d = require("./assets/js/showdown.js").parse(data.toString());
			view(req, res, { "content" : d }, "docs");
		});
	});

	app.get("/hooks/ping", function(req, res) {
		rooms.pingMessage("ping:" + req.query['service'], {"text" : req.query['message']});
		res.end("ok ping:" + req.query['service']);
	});

	app.all("/hooks/github", function(req, res) {
		label = "github:" + req.body.repository.owner.name + "/" + req.body.repository.name;
		for(commit in req.body.commits){
			commit = req.body.commits[commit];
			text = commit.author.name + " commited to " + req.body.repository.name + ": " + commit.message;
			rooms.pingMessage(label, {
				"html" : '<a href="'+commit.url+'">'+text+'</a>',
				"markdown" : text
			});
			res.end("ok");
		}
	});
};