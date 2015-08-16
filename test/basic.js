var tape = require("tape");
var async = require("async");
var _ = require("lodash");

var Stremio = require("stremio-service");

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
	t.timeoutAfter(30000); // 30s for 50 torrents

	var successful = [];
	async.each(hashes.slice(0, 50), function(hash, callback) {
		mp.processQueue.push({ infoHash: hash, callback: function(err, torrent) {
			if (err) return callback(err);
			if (torrent) {
				successful.push(torrent);
				// Collect those for later tests
				var maxSeed = Math.max.apply(Math, _.values(torrent.popularity).map(function(x) { return x[0] }));
				(torrent.files || []).forEach(function(f) {
					if (maxSeed <= cfg.minSeedToIndex) return; // cleaner?
					if (f.type == "movie") movie_ids[f.imdb_id] = true;
					if (f.type == "series") series_ids[f.imdb_id] = [f.season,f.episode[0]]; // fill it with season / episode so we can use for testing later
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


tape("indexes - contain the imdb ids", function(t) {
	Object.keys(movie_ids).forEach(function(id) {
		t.ok(db.indexes.meta.search(id).length, "we have entries for id "+id);
	});
	t.end();
});


tape("db - db.find works with movies", function(t) {
	var imdb_id = Object.keys(movie_ids)[0];
	db.find({ imdb_id: imdb_id }, 1, function(err, torrents) {
		t.ok(!err, "no error");
		t.ok(torrents[0], "has a result");
		t.ok(torrents.length <= 1, "no more than 1 result");
		t.ok(torrents[0].infoHash, "infoHash for result");
		t.ok(_.find(torrents[0].files, function(f) { return f.imdb_id == imdb_id }), "we have a file with that imdb_id inside");
		t.end();
	});
});

tape("db - db.find works series", function(t) {
	var imdb_id = Object.keys(series_ids)[0];
	var season = series_ids[imdb_id][0], episode = series_ids[imdb_id][1];

	db.find({ imdb_id: imdb_id, season: season, episode: episode }, 1, function(err, torrents) {
		t.ok(!err, "no error");
		t.ok(torrents.length <= 1, "no more than 1 result");
		t.ok(torrents[0].infoHash, "infoHash for result");
		t.ok(_.find(torrents[0].files, function(f) { return f.imdb_id == imdb_id && f.season == season }), "we have a file with that imdb_id inside");
		t.end();
	});
});

/* Addon tests
 */
var addonPort, addon;

tape("addon - listening on port", function(t) {
	t.timeoutAfter(500);

	var server = require("../stremio-addon/addon")().on("listening", function() {
		addonPort = server.address().port;
		t.end();
	})
});

tape("addon - initializes properly", function(t) {
	t.timeoutAfter(1000);

	addon = new Stremio.Client();
	addon.addService("http://localhost:"+addonPort);
	addon.on("service-ready", function(service) {
		t.ok(service.manifest, "has manifest");
		t.ok(service.manifest.name, "has name");
		t.ok(service.manifest.methods && service.manifest.methods.length, "has methods");
		t.ok(service.manifest.methods && service.manifest.methods.indexOf("stream.get")!=-1, "has stream.get method");
		t.end();
	});
});


tape("addon - sample query with a movie", function(t) {
	t.timeoutAfter(1000);

	addon.stream.get({ query: { } })
});

/*
tape("addon - sample query with an episode", function(t) {
	t.timeoutAfter(1000);

	addon.stream.get({ query: { } })
});


tape("addon - get stream by infoHash", function(t) {
	t.timeoutAfter(1000);

	addon.stream.get({ infoHash:  })
});
*/
