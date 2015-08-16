var tape = require("tape");
var async = require("async");

var cfg = require("../lib/cfg");
cfg.dbPath = require("path").join(require("os").tmpdir(), Date.now()+"");
var log = require("../lib/log");
var db = require("../lib/db");
var indexer = require("../lib/indexer");
var importer = require("../lib/importer");
var retriever = require("../lib/retriever");

var hashes = [ ]; // global so we can reuse it
var movie_ids = []; var series_ids = []; // also global, so we can reuse those 
 
tape("importer with rss source", function(t) {
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
	t.timeoutAfter(3000);
	
	// try with 3 hashes, accept 2/3 success rate - some of them are simply not available
	var results = [];
	async.each(hashes.slice(0,3), function(hash, callback) {
		retriever.retrieve(hash, function(err, tor) {
			results.push(tor);
			callback();
		});
	}, function() {
		t.ok(results.length >= 2, "we have 2 or more results");
		t.ok(results.every(function(x) { return x.infoHash }), "all of them have infohash");
		t.ok(results.every(function(x) { return x.files }), "all of them have files");
		t.end();
	});
});

tape("processor - import torrent", function(t) {

});

tape("processor - skip behaviour", function(t) {

});
