#!/usr/bin/env node

var argv = require("minimist")(process.argv.slice(2));
var url = require("url");
var net = require("net");
var _ = require("lodash");

module.dbPath = argv["db-path"] || "./db";

var db = require("../lib/db");
db.listenReplications();
if (argv.replicate) { 
	var c = net.connect(url.parse(argv.replicate).port);
	c.on("connect", function() { c.pipe(db.getSyncStream()).pipe(c) });
};


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
