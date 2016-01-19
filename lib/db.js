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
var utils = require("./utils");

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
	var maxSeeders = utils.getMaxPopularity(torrent);
	
	db.evs.emit("idxbuild", torrent, entry.peer, entry.seq);

	db.indexes.seeders.set(torrent.infoHash, maxSeeders);
	db.indexes.updated.set(torrent.infoHash, torrent.updated);
	if (torrent.files && maxSeeders) torrent.files.forEach(function(x) {
		if (utils.isFileBlacklisted(x)) return;
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

db.createLogStream({ }).on("data", function(entry) {
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

// forEachMeta(iterator, callback)
db.forEachMeta = function(fn, cb) { db.indexes.meta.executeOnEveryNode(fn); cb(); }

// forEachTorrent(iterator, callback)
db.forEachTorrent = function(fn, cb) { db.indexes.seeders.executeOnEveryNode(fn); cb(); }

// count(function(err, count) { })
db.count = function(cb) { cb(null, db.indexes.seeders.size) };

// 
db.popularities = function(callback) {
    var popularities = { };
    db.forEachMeta(function(n) {
        // value of db.indexes.seeders is equivalent to utils.getMaxPopularity
        if (n.key) popularities[n.key.split(" ")[0]] = Math.max.apply(null, n.data.map(function(k) { return db.indexes.seeders.get(k) })) || 0;
    }, function() { callback(null, popularities) });
}

module.exports = db;
