
var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");
var mkdirp = require("mkdirp");
var sublevel = require("level-sublevel");

var dbPath = path.join(module.parent.dbPath, "store.db");
mkdirp.sync(dbPath);
var db = mmm(level(dbPath), { encoding: "json" });

module.exports = {
	db: db,
	// pass sublevels to torrents and files
};
// todo files db