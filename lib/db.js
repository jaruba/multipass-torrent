
var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");
var mkdirp = require("mkdirp");
var sublevel = require("level-sublevel");
var net = require("net");
var DHT = require("bittorrent-dht");
var ip = require("ip");

var log = require("./log");

var db = {};
var dht = new DHT();

// It's a good idea to have them as separate DBs, because of storage purposes (torrent objects have different size than mediaFile)
// For now, we'll actually use only torrents DB - might be sufficient
["torrents"].forEach(function(name) {
	var dbPath = path.join(module.parent.dbPath, name+".db");
	mkdirp.sync(dbPath);
	db[name] = mmm(level(dbPath), { encoding: "json" });
});

db.getSyncStream = function() {
	return db.torrents.sync();
};

var server;
db.listenReplications = function(id) {
	server = net.createServer(function(c) { 
		log.important("DB replication connection established from "+c.remoteAddress+":"+c.remotePort);
		c.pipe(db.getSyncStream()).pipe(c); 
	});
	server.listen(function() {
		log.important("DB replication server listening at "+server.address().port);
		dht.announce(id, server.address().port);
	});
};

db.findReplications = function(id) {
	log.important(id+": finding other instances to replicate with");

	// WARNING: what if it emits beforehand?
	dht.on("ready", function() { 
		dht.lookup(id);
	});
};

var peers = { };
dht.on("peer", function(addr, infoHash)
{
	if (ip.address()+":"+server.address().port == addr) return; // Do not connect to ourselves

	if (peers[addr]) return;
	peers[addr] = true;

	var spl = addr.split(":");
	var c = net.connect(spl[1], spl[0]);
	c.on("connect", function() {
		log.message("connected to peer "+addr); // TODO: handle errs
		c.pipe(db.getSyncStream()).pipe(c);
	}).on("error", function(e) {
		c.destroy()
	}).on("end", function() {
		c.destroy();
		delete peers[addr];
	}).on("close", function() {
		// cleanup sync pipe?
	});
});

// TODO: hole punch
// TODO use SSDP 

module.exports = db;