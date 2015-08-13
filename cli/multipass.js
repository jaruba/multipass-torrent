#!/usr/bin/env node

var argv = require("minimist")(process.argv.slice(2));
var url = require("url");
var net = require("net");
var _ = require("lodash");
var hat = require("hat");
var async = require("async");
var Tracker = require("peer-search/tracker");

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
		processQueue.push({ infoHash: hash, extra: extra, source: source });
	});
}, 1);

// temporary, to test
//importQueue.push({ url: "https://torrentz.eu/feed_verified?q=", category: ["tv","movies"] }); 
//importQueue.push({ url: "https://torrentproject.se/verifieddailydump.txt.gz" }); // too big, not suitable
if (argv.source) importQueue.push({ url: argv.source, category: ["tv", "movies"] });

/* Process & index infoHashes
 */
var processQueue = async.queue(function(task, next) {
	db.get(task.infoHash, function(err, res) {
		if (err) return next(err);
		
		// Pass a merge of existing torrent objects as a base for indexing		
		task.torrent = res && res.length && indexer.merge(res.sort(function(a, b) { return a.seq - b.seq }).map(function(x) { return x.value }));

		indexer.index(task, { }, function(err, torrent) {
			// TODO: seed/leech count update
			db.merge(torrent.infoHash, res, torrent); 
			next();
		});
	});
}, 6);

/* Log number of torrents we have
 */
async.forever(function(next) {
	var count = 0;
	db.createKeyStream()
		.on("data",function(d) { count++ })
		.on("end", function() { log.important("We have "+count+" torrents"); setTimeout(next, 5000) });
});

/* Simple dump
 */
if (argv["db-dump"]) db.createReadStream()
	.on("data", function(d) { 
		d.value.files.forEach(function(f) {
			console.log([d.value.infoHash, f.path, f.imdb_id, f.season, f.episode].filter(function(x) { return x }).join(" / "))
		});
	});
