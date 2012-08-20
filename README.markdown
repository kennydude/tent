A tent for talking.

Node.js


## Install:

* clone
* `npm install`
* `node server.js`
* go to server on the web

## Designers

Files in templates are in [Mustache](http://mustache.github.com/mustache.5.html) which is easy to edit. There is some scripts in there too, but ignore them. Also you will find in `assets/basechat.js` there are some templates. You can edit those too (they're shared across pages so they're in that shared file).

## Coders

`tent.js` is the OOP-code which deals with 3 main objects:
* Tents - the overall object
* Room - a room
* Ticket - a ticket to get in a room. This can be "soiled" so it cannot be re-used by others. Also, it must be stamped to gain entry.

`server.js` contains the core end-points. Some of the code is still moving to a more OOP-based system.

## Coming Soon!

The ToDo list is on Trello https://trello.com/board/tent/503237021f3faa671006b7db
