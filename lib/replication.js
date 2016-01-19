var replication = { };

// hole punch for our replication interface
var entry = require("entry");
var natPmp = require("nat-pmp");

var log = require("./log");
var cfg = require("./cfg");
var db = require("./db");

var DHT = require("bittorrent-dht");
var SSDP = require("node-ssdp");
var ip = require("ip");
var zlib = require("zlib");
var duplexify = require("duplexify");
var events = require("events");
var net = require("net");

var dht = new DHT();
var ssdp = new SSDP.Client();


/* Replication - server & swarm
 */
replication.syncStream = function()
{
	var stream = db.sync();
	// return stream; 
	return stream.pipe(duplexify(zlib.createGzip(), zlib.createGunzip())).pipe(stream);
};

var server;
replication.listenReplications = function(id) {
	server = net.createServer(function(c) { 
		log.important("DB replication connection established from "+c.remoteAddress+":"+c.remotePort);
		c.pipe(replication.syncStream()).pipe(c);
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
			entry.map({ external: port, internal: port, name: require("../package").name }, function(e) { e && console.error("entry error (non-fatal)", e) });
			//natPmp.connect("10.0.1.1").portMapping({ public: port, private: port, ttl: 1000, description: require("../package").name }, function(e) { e && console.error(e) });		
		} catch(e) { console.error("entry error (non-fatal)", e) }
	});

	// Announce as an SSDP server
	var ssdpServer = new SSDP.Server({ location: ip.address() +":" + server.address().port });
	ssdpServer.addUSN("upnp:rootdevice");
	ssdpServer.addUSN("urn:schemas-upnp-org:service:MultiPassTorrent:"+id);
	ssdpServer.start("0.0.0.0");
};

replication.findReplications = function(id) {
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

module.exports = replication;
