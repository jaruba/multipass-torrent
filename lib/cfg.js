var _ = require("lodash");
var hat = require("hat");
var os = require("os");
var path = require("path");
var crypto = require("crypto");
var events = require("events");
var argv = require("minimist")(process.argv.slice(2));

var cfg = _.extend(new events.EventEmitter(), { sources: [], dht: true, ssdp: true, argv: argv });

//console.log("reading default config from defaults.js");
_.merge(cfg, require("../defaults"));

if (argv.config) {
	console.log("reading config from "+argv.config);
	try {
		_.merge(cfg, require(argv.config));
	} catch(e) { console.error(e) }
}

(Array.isArray(argv.source) ? argv.source : [argv.source]).forEach(function(source) { 
	if (source) cfg.sources.push({ url: source, category: ["tv", "movies"] });
});

cfg.logLevel = !isNaN(argv.log) ? parseInt(argv.log) : cfg.logLevel;

cfg.dbPath = argv["db-path"] || argv.path || path.join(require("os").tmpdir(), "multipass");
cfg.dbId = argv["db-id"] || argv.id || hat(160,16); // use minimist alias
var isHex = (cfg.dbId && cfg.dbId.length==40 && parseInt(cfg.dbId, 16));
cfg.dbId =  isHex ? cfg.dbId : crypto.createHash("sha1").update(cfg.dbId).digest("hex");

process.nextTick(function() { cfg.emit("ready") });

module.exports = cfg;