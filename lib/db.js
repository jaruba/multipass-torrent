
var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");
var url = require("url");
var mkdirp = require("mkdirp");
var sublevel = require("level-sublevel");
var net = require("net");
var DHT = require("bittorrent-dht");
var SSDP = require("node-ssdp");
var ip = require("ip");

// hole punch for our replication interface
var entry = require("entry");
var natPmp = require("nat-pmp");

var log = require("./log");

var dht = new DHT();
var ssdp = new SSDP.Client();

var dbPath = path.join(module.parent.dbPath);
mkdirp.sync(dbPath);
var db = mmm(level(dbPath), { encoding: "json" });

var server;
db.listenReplications = function(id) {
	server = net.createServer(function(c) { 
		log.important("DB replication connection established from "+c.remoteAddress+":"+c.remotePort);
		c.pipe(db.sync()).pipe(c); 
	});
	server.listen(function() {
		var port = server.address().port;

		log.important("DB replication server listening at "+port);
		dht.announce(id, port);

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
	log.important(id+": finding other instances to replicate with");

	// WARNING: what if it emits beforehand?
	dht.on("ready", function() { 
		dht.lookup(id);
	});

	ssdp.search("urn:schemas-upnp-org:service:MultiPassTorrent:"+id);
};

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
		c.pipe(db.sync()).pipe(c);
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

// TODO: hole punch

module.exports = db;