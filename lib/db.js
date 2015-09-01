var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");
var url = require("url");
var mkdirp = require("mkdirp");
var sublevel = require("level-sublevel");
var Map = require("es6-map");
var _ = require("lodash");
var async = require("async");
var net = require("net");
var DHT = require("bittorrent-dht");
var SSDP = require("node-ssdp");
var ip = require("ip");
var zlib = require("zlib");
var duplexify = require("duplexify");

// hole punch for our replication interface
var entry = require("entry");
var natPmp = require("nat-pmp");

var log = require("./log");
var cfg = require("./cfg");

var dht = new DHT();
var ssdp = new SSDP.Client();

mkdirp.sync(cfg.dbPath);
var db = mmm(level(cfg.dbPath), { encoding: "json", gc: true, postupdate: updateIndexes });
var AVLTree = require("binary-search-tree").AVLTree;


/* Indexes
 */
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

	if (db.onIdxBuild) db.onIdxBuild(torrent);

	db.indexes.seeders.set(torrent.infoHash, maxSeeders);
	db.indexes.updated.set(torrent.infoHash, torrent.updated);
	if (torrent.files) torrent.files.forEach(function(x) {
		getHashes(x).forEach(function(hash) {
			db.indexes.meta.delete(hash, torrent.infoHash); // always ensure there are no duplicates
			if (maxSeeders > cfg.minSeedToIndex) db.indexes.meta.insert(hash, torrent.infoHash);
		});
	});
	callback && callback();
}
db.createValueStream().on("data", function(val) { updateIndexes({ value: val.pop() }) });

/* Utilities 
 */
db.getMaxPopularity = function(torrent) {
	return Math.max.apply(Math, _.values(torrent.popularity).map(function(x) { return x[0] }).concat(0));
};
db.isFileBlacklisted = function(file) {
	return file.tag.concat(require("./utils").tags(file)).some(function(tag) { return cfg.blacklisted[tag] });
};
db.getSourcesForTorrent = function(torrent) {
	return undefined; // Stremio Defaults
};

/* Querying
 */
db.lookup = function(query, items)
{
	return db.indexes.meta.search(getHashes(query)[0])
		.map(function(id) { return { id: id, seeders: db.indexes.seeders.get(id) || 0 } })
		.sort(function(a,b) { return b.seeders - a.seeders })
		.slice(0, items);
};

// query - { imdb_id, season?, episode? } ; items - number of items to return
db.find = function(query, items, callback)
{
	async.map(db.lookup(query, items), function(x, cb) { 
		return db.get(x.id, function(err, res) { cb(err, res && res[0] && res[0].value) });
	}, callback);
};


/* Replication - server & swarm
 */
db.syncStream = function()
{
	var stream = db.sync();
	// return stream; 
	return stream.pipe(duplexify(zlib.createGzip(), zlib.createGunzip())).pipe(stream);
};

var server;
db.listenReplications = function(id) {
	server = net.createServer(function(c) { 
		log.important("DB replication connection established from "+c.remoteAddress+":"+c.remotePort);
		c.pipe(db.syncStream()).pipe(c);
		c.on("error", function(err) { console.log(err) });
	});
	server.listen(function() {
		var port = server.address().port;

		log.important("DB replication server listening at "+port);
		dht.announce(id, port);

		// Hole punch so this server is accessible behind router firewalls
		// We can play around with public / private - maybe we want a consistent public port?
		try {
			// Both throw err in their async code which we cannot catch
			entry.map({ external: port, internal: port, name: require("../package").name }, function(e) { e && console.error(e) });
			//natPmp.connect("10.0.1.1").portMapping({ public: port, private: port, ttl: 1000, description: require("../package").name }, function(e) { e && console.error(e) });		
		} catch(e) { console.error(e) }
	});

	// Announce as an SSDP server
	var ssdpServer = new SSDP.Server({ location: ip.address() +":" + server.address().port });
	ssdpServer.addUSN("upnp:rootdevice");
	ssdpServer.addUSN("urn:schemas-upnp-org:service:MultiPassTorrent:"+id);
	ssdpServer.start("0.0.0.0");
};

db.findReplications = function(id) {
	log.important(id+": finding other instances to replicate with through "+[cfg.ssdp ? "ssdp" : "", cfg.dht ? "dht" : ""].join(", "));

	// WARNING: what if it emits beforehand?
	if (cfg.dht) dht.on("ready", function() { 
		dht.lookup(id);
	});

	if (cfg.ssdp) ssdp.search("urn:schemas-upnp-org:service:MultiPassTorrent:"+id);
};

/* Swarm
 */
var peers = { };
function onpeer(addr)
{
	if (ip.address()+":"+server.address().port == addr) return; // Do not connect to ourselves

	if (peers[addr]) return;
	peers[addr] = true;

	var spl = addr.split(":");
	var c = net.connect(spl[1], spl[0]);
	c.on("connect", function() {
		log.message("connected to peer "+addr); // TODO: handle errs
		c.pipe(db.syncStream()).pipe(c);
	}).on("error", function(e) {
		c.destroy()
	}).on("end", function() {
		c.destroy();
		delete peers[addr];
	}).on("close", function() {
		// cleanup sync pipe?
	});
};
dht.on("peer", onpeer);
ssdp.on("response", function(meta, status, matchine) { onpeer(meta.LOCATION) });

module.exports = db;