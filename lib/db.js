
var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");
var mkdirp = require("mkdirp");
var sublevel = require("level-sublevel");
var multistream = require("parallel-multistream");
var net = require("net");

var db = {};

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

db.listenReplications = function() {
	var server = net.createServer(function(c) { 
		console.log("DB replication connection established from "+c.remoteAddress+":"+c.remotePort);
		c.pipe(db.getSyncStream()); 
	});
	server.listen(function() {
		console.log("DB replication server listening at "+server.address().port);
	});
};

module.exports = db;