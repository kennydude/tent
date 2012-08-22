# Hooks
Hooks are a great way to include external sources into Tent automagically.

## GitHub

To use the GitHub hook, you will need to add (relative to this server) `/hooks/github` into your Post-Commit Notify hooks. We handle the rest.

In a room, you subscribe to `github:username/repo` and it will be pulled in automatically

## Ping

To use ping, it's simple. The endpoint is `/hooks/ping` with query string paramters:

* `service` is a label used to distinguish different services operating on the ping hook
* `message` the message to deliver

To subscribe you need `ping:service` where `service` is the value you used above

## Adding your own

To do this, you need to fork your own copy of the repo from http://github.com/kennydude/tent and in hooks.js add something like:

	app.get("/hooks/myhook", function(req, res) {
		rooms.pingMessage("ping:" + req.query['service'], {"text" : req.query['message']});
		res.end("ok ping:" + req.query['service']);
	});

And `rooms.pingMessage( label, data );` is how that works, with data taking `text`, `markdown` or `html`. We do not reconmend allowing html for inputed content to prevent attacks.

Also, make sure to place it inside of the function of which the others are placed.
