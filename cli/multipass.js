#!/usr/bin/env node

var url = require("url");
var net = require("net");
var _ = require("lodash");
var async = require("async");
var Tracker = require("peer-search/tracker");
var events = require('events');

var cfg = require("../lib/cfg");
var log = require("../lib/log");
var db = require("../lib/db");
var indexer = require("../lib/indexer");
var importer = require("../lib/importer");

var mp = new events.EventEmitter();
var buffer = [];

mp.db = db; // expose db

db.listenReplications(cfg.dbId); // start our replication server
db.findReplications(cfg.dbId); // replicate to other instances

/* Collect infoHashes from source
 */
mp.importQueue = async.queue(function(source, next) {
	source = typeof(source) == "string" ? { url: source } : source;
	buffer[source.url] = { progress: 0, total: 0 };
	log.important("importing from "+source.url);
	importer.collect(source, function(err, status) {
		if (err) log.error(err);
		else log.important("importing finished from "+source.url+", "+status.found+" infoHashes, "+status.imported+" of them new, through "+status.type+" importer ("+(status.end-status.start)+"ms)");
		buffer[source.url].total = parseInt(status.found);

		if (source.interval) setTimeout(function() { mp.importQueue.push(source) }, source.interval); // repeat at interval - re-push

		next();
	}, function(hash, extra) {
		log.hash(hash, "collect");
		mp.processQueue.push({ infoHash: hash, extra: extra, source: source });
	});
}, 1);
if (cfg.sources) cfg.sources.forEach(mp.importQueue.push);

/* Process & index infoHashes
 */
mp.processQueue = async.queue(function(task, _next) {
	var next = _.once(function() { called = true; _next() }), called = false;
	setTimeout(function() { next(); if (!called) log.error("process timeout for "+task.infoHash) }, 10*1000);

	log.hash(task.infoHash, "processing");

	// consider using db.indexes.seeders to figure out a skip case here; don't overcomplicate though
	db.get(task.infoHash, function(err, res) {
		if (err) {
			buffering(task.source.url);
			log.error(err);
			return next();
		}
		
		// Pass a merge of existing torrent objects as a base for indexing		
		task.torrent = res && res.length && indexer.merge(res.sort(function(a, b) { return a.seq - b.seq }).map(function(x) { return x.value }));

		async.parallel([
			function(cb) { indexer.index(task, { }, cb) },
			function(cb) { (task.torrent && task.torrent.popularityUpdated > (Date.now() - 6*60*60*1000)) ? cb() : indexer.seedleech(task.infoHash, cb) }
		], function(err, indexing) {
			if (err) {
				buffering(task.source.url);
				if (task.callback) task.callback(err); log.error(task.infoHash, err); return next();
			}

			var torrent = _.merge(indexing[0], indexing[1] ? { popularity: indexing[1], popularityUpdated: Date.now() } : { });
			db.merge(torrent.infoHash, res, torrent); // TODO think of cases when to omit that
			
			mp.emit("Found", task.source.url, torrent);
			
			next();
			if (task.callback) task.callback(null, torrent);

			if (torrent.uninteresting && !res.length) log.warning(torrent.infoHash+" / "+torrent.name+" is non-interesting, no files indexed");
			log.hash(task.infoHash, "processed");
			buffering(task.source.url);
		});
	});
}, 6);

/* Emit buffering event
 */
function buffering(source) {
	buffer[source].progress++;
	perc = buffer[source].progress/buffer[source].total;
	perc = (Math.floor(perc * 100) / 100).toFixed(2);
	mp.emit('Buffering', source, perc);
	if (perc == 1) {
		mp.emit('Finished', source);
		delete buffer[source];
	}
}

/* Programatic usage of this
 */
if (module.parent) return module.exports = mp;

/* Log number of torrents we have
 */
async.forever(function(next) {
	var count = 0;
	db.createKeyStream()
		.on("data",function(d) { count++ })
		.on("end", function() { log.important("We have "+count+" torrents, "+mp.processQueue.length()+" queued"); setTimeout(next, 5000) });
});

/* Simple dump
 */
var argv = module.parent ? { } : require("minimist")(process.argv.slice(2));
if (argv["db-dump"]) db.createReadStream()
.on("data", function(d) { 
	d.value.files.forEach(function(f) {
		console.log([d.value.infoHash, f.path, f.imdb_id, f.season, f.episode].filter(function(x) { return x }).join(" / "))
	});
});

/* Stremio Addon interface
 */
if (argv["stremio-addon"]) require("../stremio-addon/addon")(argv["stremio-addon"]);

