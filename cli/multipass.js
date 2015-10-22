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
var buffer = { };
mp.db = db; // expose db

/* Config - dependant stuff
 */
cfg.on("ready", function() {
	db.listenReplications(cfg.dbId); // start our replication server
	db.findReplications(cfg.dbId); // replicate to other instances

	log.important("DB Path "+cfg.dbPath);
	log.important("we have "+cfg.sources.length+" sources");

	if (cfg.sources) cfg.sources.forEach(mp.importQueue.push);
});
cfg.on("updated", function() {
	// currently concurrency for importQueue is 1 so checking buffer[] works
	// TODO: fix this, since some sources may be completed by re-added with setTimeout because of source.interval
	if (cfg.sources) cfg.sources.forEach(function(source) { if (! buffer[source.url]) mp.importQueue.push(source) });
});

/* Collect infoHashes from source
 */
mp.importQueue = async.queue(function(source, next) {
	source = typeof(source) == "string" ? { url: source } : source;

	if (argv["disable-collect"]) { log.important("skipping "+source.url+" because of --disable-collect"); return next(); }

	log.important("importing from "+source.url);
	importer.collect(source, function(err, status) {
		if (err) log.error(err);
		else {
			log.important("importing finished from "+source.url+", "+status.found+" infoHashes, "+status.imported+" of them new, through "+status.type+" importer ("+(status.end-status.start)+"ms)");
			buffering(source, status.found);
		}
		
		if (source.interval) setTimeout(function() { mp.importQueue.push(source) }, source.interval); // repeat at interval - re-push

		next();
	}, function(hash, extra) {
		log.hash(hash, "collect");
		if (!argv["disable-process"]) mp.processQueue.push({ infoHash: hash, extra: extra, hints: extra && extra.hints, source: source });
		// extra - collected from the source, can be info like uploaders/downloaders, category, etc.
		// hints - hints to particular meta information already found from the source, like imdb_id, season/episode
	});
}, 1);

/* Process & index infoHashes
 */
mp.processQueue = async.queue(function(task, _next) {
	var next = _.once(function() { called = true; buffering(task.source); _next() }), called = false;
	setTimeout(function() { next(); if (!called) log.error("process timeout for "+task.infoHash) }, 10*1000);

	log.hash(task.infoHash, "processing");

	// consider using db.indexes.seeders to figure out a skip case here; don't overcomplicate though
	db.get(task.infoHash, function(err, res) {
		if (err) {
			log.error(err);
			return next();
		}
		
		// Pass a merge of existing torrent objects as a base for indexing		
		var noChanges;
		task.torrent = res && res.length && indexer.merge(res.sort(function(a, b) { return a.seq - b.seq }).map(function(x) { return x.value }));
		async.auto({
			index: function(cb) { indexer.index(task, { }, function(err, tor, nochanges) { noChanges = nochanges; cb(err, tor) }) },
			seedleech: function(cb) { (task.torrent && task.torrent.popularityUpdated > (Date.now() - cfg.popularityTTL)) ? cb() : indexer.seedleech(task.infoHash, cb) }
		}, function(err, indexing) {
			if (err) {
				if (task.callback) task.callback(err); log.error(task.infoHash, err);
				return next();
			}

			// Note that this is a _.merge, popularity is not overriden
			var torrent = _.merge(indexing.index, indexing.seedleech ? { popularity: indexing.seedleech, popularityUpdated: Date.now() } : { });
			if ( ! (res.length == 1 && noChanges)) db.merge(torrent.infoHash, res, torrent);
			
			mp.emit("found", task.source.url, torrent);
			
			next();
			if (task.callback) task.callback(null, torrent);

			if (torrent.uninteresting && !res.length) log.warning(torrent.infoHash+" / "+torrent.name+" is non-interesting, no files indexed");
			log.hash(task.infoHash, "processed");
		});
	});
}, 6);

/* Emit buffering event
 */
function buffering(source, total) {
	if (! (source && source.url)) return;
	if (! buffer[source.url]) buffer[source.url] = { progress: 0, total: 0 };
	if (!isNaN(total)) return buffer[source.url].total = total;
	buffer[source.url].progress++;
	var perc;
	perc = buffer[source.url].progress/buffer[source.url].total;
	perc = (Math.floor(perc * 100) / 100).toFixed(2);
	mp.emit("buffering", source, perc);
	if (perc == 1) {
		mp.emit("finished", source);
		delete buffer[source.url];
	}
}

/* Programatic usage of this
 */
if (module.parent) return module.exports = mp;

/* Log number of torrents we have
 */
async.forever(function(next) {
	log.important("We have "+db.indexes.seeders.size+" torrents, "+mp.processQueue.length()+" queued"); 
	setTimeout(next, 5000);
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
if (cfg.stremioAddon) require("../stremio-addon/addon")(cfg.stremioAddon);


