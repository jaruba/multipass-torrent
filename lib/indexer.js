/* Index torrents into our database
 */

var _ = require("lodash");
var async = require("async");
var Stremio = require("stremio-addons");
var retriever = require("../lib/retriever");
var Tracker = require("peer-search/tracker");

var cfg = require("./cfg");

var CINEMETA_URL = cfg.cinemeta || process.env.CINEMETA || "http://stremio-cinemeta.herokuapp.com";
var addons = new Stremio.Client();
addons.add(CINEMETA_URL);
addons.setAuth(cfg.stremioCentral, cfg.stremioSecret);

// Rate limit that
var indexGet = async.queue(function(task, callback) {
	addons.index.get(task.args, function() { task.cb.apply(null, arguments); callback() });
}, 6); // Do not increase that - Cinemeta is internally rate limited, so you'll only get a bunch of timeouts

function index(task, options, callback)
{
	var task = typeof(task) == "string" ? { infoHash: task } : task;
	var torrent = task.torrent || { };

	// Core properties
	torrent.sources = torrent.sources || { };
	torrent.popularity = torrent.popularity || { };

	if (!options.force && task.source && torrent.sources[task.source.url]) return callback(null, torrent);

	// Update sources
	if (task.source) torrent.sources[task.source.url] = Date.now();
	delete torrent.source;

	// Skip logic - if we already have an indexed torrent with files / uninteresting
	if (!options.force && (torrent.files || torrent.uninteresting)) return callback(null, torrent);

	// Retrieve the torrent meta and set .files
	(options.retrieve || retriever.retrieve)(task.infoHash, function(err, tor) {
		if (err) return callback(err);

		_.extend(torrent, _.omit(tor, "pieces", "info", "infoBuffer"));

		torrent.files = torrent.files
			.map(function(file, idx) { return _.extend(file, { idx: idx }) })
			.filter(function(file) { return file.path.match(options.matchFiles || cfg.matchFiles) && !file.name.match(cfg.excludeFiles) }); 
		
		(function(next) { 
			if (! torrent.files.length) return next();
			if (cfg.excludeTorrents && torrent.name.match(cfg.excludeTorrents)) return next();

			// fromOutside - parsing names from the outside, since with torrents outside names make more sense
			indexGet.push({ args: { fromOutside: true, strict: true, files: torrent.files }, cb: function(err, res) {
				if (err) return callback(err);
				torrent.files = res.files.filter(interestingFile);
				torrent.files.forEach(function(f) { 
					// WARNING: do that before index.get - and if all requirements are satisfied - imdb_id, type, optional season/episode, don't ask it at all - for EZTV/YTS case
					if (task.extra && task.extra.imdb_id) f.imdb_id = task.extra.imdb_id;
				});
				next(true);
			}});
		})(function(called) {
			torrent.updated = Date.now(); torrent.updatedCinemeta = called || false;
			torrent.uninteresting = !torrent.files.length;
			callback(null, torrent);
		});
	});
}

function seedleech(infoHash, callback)
{
	var popularity = { }, cb = _.once(function() { callback(null, popularity) });
	setTimeout(cb, cfg.trackerTimeout);

	async.each(cfg.trackers, function(tracker, ready) {
		var t = new Tracker(tracker, { }, infoHash);
		t.run();
		t.on("info", function(inf) {
			popularity[tracker] = [inf.seeders, inf.leechers];
			ready();
		});
	}, cb);	
}

// Conflict resolution logic is here
function merge(torrents)
{
	// NOTE: here, on the merge logic, we can set properties that should always be set
	// Or just rip out the model logic from LinvoDB into a separate module and use it
	return torrents.reduce(function(a, b) { 
		return _.merge(a, b, function(x, y) {
			// this is for the files array, and we want more complicated behaviour 
			if (_.isArray(a) && _.isArray(b)) return b;
		})
	})
}

function interestingFile(f)
{
	return (f.type == "movie" || f.type == "series") && f.length > 85*1024*1024
}

module.exports = { index: index, seedleech: seedleech, merge: merge, addons: addons };
