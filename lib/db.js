var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");
var url = require("url");
var mkdirp = require("mkdirp");
var sublevel = require("level-sublevel");
var Map = require("es6-map");
var _ = require("lodash");
var async = require("async");
var events = require("events");

var cfg = require("./cfg");

mkdirp.sync(cfg.dbPath);
var db = mmm(level(cfg.dbPath), { encoding: "json", gc: true, postupdate: updateIndexes });
var AVLTree = require("binary-search-tree").AVLTree;
var mmmEnc = require("multi-master-merge/encoders")("json");

/* Indexes
 */
db.evs = new events.EventEmitter();
db.indexes = { meta: new AVLTree(), seeders: new Map(), updated: new Map() };
function getHashes(x) {
	return (Array.isArray(x.episode) ? x.episode : [x.episode]).map(function(ep) { // separate hashes for multi-episode files
		return [x.imdb_id, x.season, ep ].filter(function(x) { return x }).join(" ")
	});
}
function updateIndexes(entry, callback)
{
	var torrent = entry.value;
	if (! torrent) return callback && callback();
	var maxSeeders = db.getMaxPopularity(torrent);
	
	db.evs.emit("idxbuild", torrent, entry.peer, entry.seq);

	db.indexes.seeders.set(torrent.infoHash, maxSeeders);
	db.indexes.updated.set(torrent.infoHash, torrent.updated);
	if (torrent.files && maxSeeders) torrent.files.forEach(function(x) {
		if (db.isFileBlacklisted(x)) return;
		getHashes(x).forEach(function(hash) {
			db.indexes.meta.delete(hash, torrent.infoHash); // always ensure there are no duplicates
			//if (maxSeeders > cfg.minSeedToIndex) db.indexes.meta.insert(hash, torrent.infoHash);
			db.indexes.meta.insert(hash, torrent.infoHash); // currently index everything
			// WARNING: if we use the maxSeeders check, we risk to run this codepath with a conflicted copy of the torrent which doesn't have seeds
			// for now this is un-solvable
		});
	});
	callback && callback();
}

db.createLogStream().on("data", function(entry) {
	updateIndexes({ peer: entry.peer, seq: entry.seq, value: entry.value });
}).on("end", function() { db.evs.emit("idxready") });

/* Compact with old events API
 * this should maybe be obsoleted?
 */
Object.defineProperty(db, "onIdxBuild", { set: function(fn) { db.evs.on("idxbuild", fn) } });
Object.defineProperty(db, "onIdxReady", { set: function(fn) { db.evs.on("idxready", fn) } });

/* Querying
 */
db.lookup = function(query, items)
{
	return db.indexes.meta.search(getHashes(query)[0])
		.map(function(id) { return { id: id, seeders: db.indexes.seeders.get(id) || 0 } })
		.sort(function(a,b) { return b.seeders - a.seeders })
		.slice(0, items);
};

// query - { imdb_id, season?, episode? } ; items - number of items to return, callback - function(err, items)
db.find = function(query, items, callback)
{
	async.map(db.lookup(query, items), function(x, cb) { 
		return db.get(x.id, function(err, res) { cb(err, res && res[0] && res[0].value) });
	}, callback);
};

/* Utilities 
 * Those can be overriden
 */
db.getMaxPopularity = function(torrent) {
	return Math.max.apply(Math, _.values(torrent.popularity).map(function(x) { return x[0] }).concat(0));
};
db.isFileBlacklisted = function(file) {
	return file.tag.concat(require("./utils").tags(file)).some(function(tag) { return cfg.blacklisted[tag] });
};
db.getSourcesForTorrent = function(torrent) {
	return ["dht:"+torrent.infoHash].concat(torrent.announce.map(function(x){ return "tracker:"+x }));
};
db.getAvailForTorrent = function(torrent) {
    var maxSeeders = db.getMaxPopularity(torrent);
    if (maxSeeders >= 300) return 4;
    if (maxSeeders >= 90) return 3;
    if (maxSeeders >= 15) return 2;
    if (maxSeeders > 0) return 1; 
    return 0;
};


module.exports = db;
