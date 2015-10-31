#!/usr/bin/env node

var url = require("url");
var net = require("net");
var _ = require("lodash");
var async = require("async");
var Tracker = require("peer-search/tracker");
var events = require('events');

var cfg, db, indexer, importer;

var log = require("../lib/log");

var argv = module.parent ? { } : require("minimist")(process.argv.slice(2));

var mp = new events.EventEmitter();
var sources = { }, recurring = { };

mp.init = function(settings) {

	if (cfg) {
		log.important('Multipass has already been initiated.');
		return;
	}

	// set defaults
	if (!settings) settings = {};
	if (typeof settings.replicate === 'undefined') settings.replicate = true;

	cfg = require("../lib/cfg");

	// sync cfg with settings
	for (var key in settings) {
		if (settings.hasOwnProperty(key)) {
			cfg[key] = settings[key];
		}
	}

	db = require("../lib/db");

	this.db = db;

	indexer = require("../lib/indexer");
	importer = require("../lib/importer");

	if (settings.replicate) {
		db.listenReplications(cfg.dbId); // start our replication server
		db.findReplications(cfg.dbId); // replicate to other instances
	}

	if (cfg.sources) cfg.sources.forEach(mp.importQueue.push);

	db.evs.on("idxbuild", function(tor, peer, seq) {
		var updated = tor.sources && Math.max.apply(null, _.values(tor.sources));
		if (cfg.nonSeededTTL && peer && updated && (Date.now()-updated > cfg.nonSeededTTL) && !db.getMaxPopularity(tor))
			db.log.del(peer, seq, function() { console.log("removed "+tor.infoHash) });
	});

}

/* Collect infoHashes from source
 */

mp.import = function(link) {
	sources[link] = { progress: 0, total: 0 };
	this.importQueue.push(link);
}

mp.importQueue = async.queue(function(source, next) {
	source = typeof(source) == "string" ? { url: source } : source;

	if (argv["disable-collect"]) { log.important("skipping "+source.url+" because of --disable-collect"); return next(); }

	if (source.fn) return source.fn(mp, function() {
		if (source.interval) recurring[source.url] = setTimeout(function() { mp.importQueue.push(source) }, source.interval); // repeat at interval - re-push
	});

	log.important("importing from "+source.url);
	importer.collect(source, function(err, status) {
		if (err) log.error(err);
		else {
			log.important("importing finished from "+source.url+", "+status.found+" infoHashes, "+status.imported+" of them new, through "+status.type+" importer ("+(status.end-status.start)+"ms)");
			buffering(source, status.found);
		}
		
		if (source.interval) recurring[source.url] = setTimeout(function() { mp.importQueue.push(source) }, source.interval); // repeat at interval - re-push

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
		
		// WARNING: no skip logic here, as we need at least to update .sources and seed/leech data		
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
}, (cfg && cfg.processingConcurrency) ? cfg.processingConcurrency : 6);

/* Emit buffering event
 */
function buffering(source, total) {
	if (! (source && source.url)) return;
	if (! sources[source.url]) sources[source.url] = { progress: 0, total: 0 };
	if (!isNaN(total)) return sources[source.url].total = total;
	sources[source.url].progress++;
	var perc;
	perc = sources[source.url].progress/sources[source.url].total;
	perc = (Math.floor(perc * 100) / 100).toFixed(2);
	mp.emit("buffering", source.url, perc);
	if (perc == 1) {
		mp.emit("finished", source.url);
		delete sources[source.url];
	}
}

/* Programatic usage of this
 */
if (module.parent) return module.exports = mp;
else mp.init();

/* Log number of torrents we have
 */
db.evs.on("idxready", function() {
	async.forever(function(next) {
		log.important("We have "+db.indexes.seeders.size+" torrents, "+mp.processQueue.length()+" queued"); 
		setTimeout(next, 5000);
	});
});

/* Stremio Addon interface
 */
if (cfg.stremioAddon) require("../stremio-addon/addon")(cfg.stremioAddon);


