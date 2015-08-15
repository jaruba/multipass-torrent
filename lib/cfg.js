var _ = require("lodash");
var hat = require("hat");
var os = require("os");
var path = require("path");
var argv = require("minimist")(process.argv.slice(2));

var cfg = { sources: [] };

console.log("reading default config from defaults.js");
_.merge(cfg, require("../defaults"));

if (argv.config) {
	console.log("reading config from "+argv.config);
	_.merge(cfg, require(argv.config));
}

(Array.isArray(argv.source) ? argv.source : [argv.source]).forEach(function(source) { 
	if (source) cfg.sources.push({ url: source, category: ["tv", "movies"] });
});

cfg.logLevel = !isNaN(argv.log) ? parseInt(argv.log) : cfg.logLevel;

cfg.dbPath = argv["db-path"] || argv.path || path.join(require("os").tmpdir(), "multipass");
cfg.dbId = argv["db-id"] || argv.db; // use minimist alias
cfg.dbId = (cfg.dbId && cfg.dbId.length==40 && parseInt(cfg.dbId, 16)) ? cfg.dbId : hat(160,16);

module.exports = cfg;