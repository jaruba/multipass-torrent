
var mmm = require("multi-master-merge");
var level = require("level"); // LevelUP + LevelDOWN
var path = require("path");

var torrents = mmm(level(path.join(module.parent.dbPath, "torrents.db")), { encoding: "json" });

// todo files db