var tape = require("tape");

var cfg = require("../lib/cfg");
cfg.dbPath = require("path").join(require("os").tmpdir(), Date.now()+"");
var log = require("../lib/log");
var db = require("../lib/db");
var indexer = require("../lib/indexer");
var importer = require("../lib/importer");

tape("importer with rss source", function(t) {
	var hashes = [ ];
	importer.collect({ url: "http://torrentz.eu/feed_verified?q=", category: ["tv", "movies"] }, function(err, status) {
		t.ok(!err, "no err from importer.collect");
		t.ok(hashes.length > 20, "hashes collected ("+hashes.length+") are more than 20");
		t.end();
	}, function(hash) {
		hashes.push(hash);
		t.ok(typeof(hash)=="string" && hash.length==40, "valid infoHash");
	});
});

tape("retriever", function(t) {
	// try with 3 hashes, accept 2/3 success rate - some of them are simply not available
	async.each(hashes.slice(0,3), function(hash, callback) {

	});
});

tape("processor - import torrent", function(t) {

});

tape("processor - skip behaviour", function(t) {

});
