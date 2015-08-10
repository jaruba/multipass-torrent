#!/usr/bin/env node

var argv = require("minimist")(process.argv.slice(2));
var url = require("url");
var net = require("net");
var _ = require("lodash");
var hat = require("hat");

module.dbPath = argv["db-path"] || "./db";
module.dbId = argv["db-identifier"];
module.dbId = (module.dbId && module.dbId.length==40 && parseInt(module.dbId, 16)) ? module.dbId : hat(160,16);

var db = require("../lib/db");

db.listenReplications(module.dbId); // start our replication server
db.findReplications(module.dbId); // replicate to other instances

/*
if (argv.replicate) { 
	var c = net.connect(url.parse(argv.replicate).port);
	c.on("connect", function() { c.pipe(db.getSyncStream()).pipe(c) });
};
*/


/*
setTimeout(function() {
	db.torrents.put("xxxxx "+Math.random(), "test");
	db.torrents.put("testy test"+Math.random(), "foo");
	db.torrents.put("another key", "is testing");
}, 500);
*/

// WARNING we'll need to iterate through the whole dataset on intro in any case to generate query index
setInterval(function() {
	var count = 0;
	db.torrents.createReadStream().on("data",function(d){count++}).on("end", function() { console.log("We have "+count+" torrents") })
}, 3000);
