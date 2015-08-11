#!/usr/bin/env node

var argv = require("minimist")(process.argv.slice(2));
var url = require("url");
var net = require("net");
var _ = require("lodash");
var hat = require("hat");
var async = require("async");

module.dbPath = argv["db-path"] || "./db";
module.dbId = argv["db-identifier"] || argv["db-id"] || argv["id"]; // use minimist alias
module.dbId = (module.dbId && module.dbId.length==40 && parseInt(module.dbId, 16)) ? module.dbId : hat(160,16);

var db = require("../lib/db");
var log = require("../lib/log");
var indexer = require("../lib/indexer");
var importer = require("../lib/importer");

db.listenReplications(module.dbId); // start our replication server
db.findReplications(module.dbId); // replicate to other instances

/* Collect infoHashes from source
 */
var importQueue = async.queue(function(source, next) {
	source = typeof(source) == "string" ? { url: source } : source;
	log.important("importing from "+source.url);
	importer.collect(source, function(err, status) {
		if (err) log.error(err);
		else log.important("importing finished from "+source.url+", "+status.found+" infoHashes, "+status.imported+" of them new, through "+status.type+" importer ("+(status.end-status.start)+"ms)");

		if (source.interval) setTimeout(function() { importQueue.push(source) }, source.interval); // repeat at interval - re-push
	}, function(hash, extra) {
		processQueue.push({ infoHash: hash, extra: extra });
	});
}, 1);

// temporary, to test
importQueue.push({ url: "https://torrentz.eu/feed_verified?q=" }); 
//importQueue.push({ url: "https://torrentproject.se/verifieddailydump.txt.gz" }); // too big, not suitable


/* Process & index infoHashes
 */
var processQueue = async.queue(function(task, next) {
	indexer.index(task.infoHash, task.extra, next);
}, 5);

/* Log number of torrents we have
 */
setInterval(function() {
	var count = 0;
	db.createKeyStream()
		.on("data",function(d) { count++ })
		.on("end", function() { log.important("We have "+count+" torrents") });
}, 5000);
