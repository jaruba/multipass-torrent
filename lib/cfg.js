var log = require("../lib/log");
var _ = require("lodash");
var hat = require("hat");
var argv = require("minimist")(process.argv.slice(2));

var cfg = { sources: [] };

cfg.dbPath = argv["db-path"] || argv["path"] || "./db";
cfg.dbId = argv["db-id"] || argv["id"]; // use minimist alias
cfg.dbId = (cfg.dbId && cfg.dbId.length==40 && parseInt(cfg.dbId, 16)) ? cfg.dbId : hat(160,16);

log.important("reading default config from defaults.js");
_.merge(cfg, require("../defaults"));

if (argv.config) {
	log.important("reading config from "+argv.config);
	_.merge(cfg, require(argv.config));
}

(Array.isArray(argv.source) ? argv.source : [argv.source]).forEach(function(source) { 
	if (source) cfg.sources.push({ url: source, category: ["tv", "movies"] });
});

module.exports = cfg;