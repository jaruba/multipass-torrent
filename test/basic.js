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
var movie_ids =  { }; var series_ids = { }; // also global, so we can reuse those 
 
tape("importer with rss source", function(t) {
	/* WARNING: this entire test file depends on this source; if it fails, all tests will fail
	 * write individual tests covering edge cases in all modules, not dependant on external influence
	 */
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
			if (err) console.error(err);
			if (tor) results.push(tor);
			callback();
		});
	}, function() {
		t.ok(results.length >= 2, "we have 2 or more results");
		t.ok(results.every(function(x) { return x.infoHash }), "all of them have infohash");
		t.ok(results.every(function(x) { return x.files }), "all of them have files");
		t.end();
	});
});

// TODO this is extremely primitive
var mp = require("../cli/multipass");
tape("processor - import torrent", function(t) {
	t.timeoutAfter(35000); // 35s for 50 torrents

	var successful = [];
	async.each(hashes.slice(0,50), function(hash, callback) {
		mp.processQueue.push({ infoHash: hash, callback: function(err, torrent) {
			if (err) return callback(err);
			if (torrent) {
				successful.push(torrent);
				// Collect those for later tests
				(torrent.files || []).forEach(function(f) {
					if (f.type == "movie") movie_ids[f.imdb_id] = true;
					if (f.type == "series") series_ids[f.imdb_id] = true;
				});
			}
			callback();
		} })
	}, function(err) {
		if (err) console.error(err);
		t.ok(!err, "no error");

		t.ok(successful.length > 20, "we have more than 20 results");
		t.ok(Object.keys(movie_ids).length > 2, "we have more than two movies");
		t.ok(Object.keys(series_ids).length > 2, "we have more than two series");
		//console.log(movie_ids, series_ids)
		t.end();
	});
});
/*
tape("processor - skip behaviour", function(t) {

});
*/