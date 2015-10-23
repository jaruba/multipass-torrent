var tape = require("tape");
var async = require("async");
var _ = require("lodash");

var Stremio = require("stremio-addons");

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
	t.timeoutAfter(10000);

	importer.collect({ url: "http://torrentz.eu/feed_verified?q=", category: ["tv", "movies"] }, function(err, status) {
		t.ok(!err, "no err from importer.collect");
		t.ok(hashes.length > 20, "hashes collected ("+hashes.length+") are more than 20");
		t.end();
	}, function(hash) {
		hashes.push(hash);
		t.ok(typeof(hash)=="string" && hash.length==40, "valid infoHash");
	});
});

tape("importer with dump source", function(t) {
	t.timeoutAfter(20000);

	var hashesDump = [];

	importer.collect({ url: "http://bitsnoop.com/api/latest_tz.php?t=verified", category: ["tv", "movies"], type: "dump" }, function(err, status) {
		t.ok(!err, "no err from importer.collect");
		t.ok(hashesDump.length > 5, "hashes collected ("+hashesDump.length+") are more than 5");
		t.ok(status.type == "dump", "we've collected from a dump")
		t.end();

	}, function(hash, extra) {
		hashesDump.push(hash);
		t.ok(typeof(hash)=="string" && hash.length==40, "valid infoHash");
		t.ok(extra && extra.category.match("movie|tv"), "match movie/tv in category");
	});
});

/*
tape("importer with dump source - large with minseeders", function(t) {
	t.timeoutAfter(500*1000);

	var count = 0;

	importer.collect({ 
		url: "http://ext.bitsnoop.com/export/b3_verified.txt.gz", 
		minSeedersUrl: "http://ext.bitsnoop.com/export/b3_e003_torrents.txt.gz",
		minSeeders: 5,
		category: ["tv", "movies"], type: "dump" 
	}, function(err, status) {
		t.ok(!err, "no err from importer.collect");
		t.ok(status.type == "dump", "we've collected from a dump")
		console.log("found "+count+" hashes");
		// around 3k with over 10 seeds
		// found 5k with over 5 seeds
		// around 
		t.end();
	}, function(hash, extra) {
		//t.ok(typeof(hash)=="string" && hash.length==40, "valid infoHash");
		//t.ok(extra && extra.category.match("movie|tv"), "match movie/tv in category");
		//t.ok(extra && extra.uploaders >= 10, "has min uploaders");
		count++;
	});
});
*/


tape("retriever", function(t) {
	t.timeoutAfter(5000);

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

tape("retriever - catch errors", function(t) {
	t.timeoutAfter(10000);
	var hash = "230bb375188a9ecf57ba469fc8ec36cf5634a0382";

	retriever.retrieve(hash, function(errs, tor) {
		t.ok(errs && errs.length, "has errors");
		t.end();
	});
})

tape("retriever - pass url", function(t) {
	t.timeoutAfter(3000);

	// try with 3 hashes, accept 2/3 success rate - some of them are simply not available
	var results = [ ];
	async.each(hashes.slice(0,3), function(hash, callback) {
		retriever.retrieve(hash, { url: "http://torcache.net/torrent/"+hash.toUpperCase()+".torrent" },function(err, tor) {
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


tape("retriever - fallback to DHT/peers fetching", function(t) {
	t.timeoutAfter(20000);

	// try with 3 hashes, accept 3/3 success rate - all metas should be there with peers
	var results = [ ];
	async.each(hashes.slice(0,3), function(hash, callback) {
		retriever.retrieve(hash, { important: true, url: "http://notcache.net/"+hash.toUpperCase()+".torrent" }, function(err, tor) {
			if (err) console.error(err);
			if (tor) results.push(tor);
			callback();
		});
	}, function() {
		t.ok(results.length >= 3, "we have 3 or more results");
		t.ok(results.every(function(x) { return x.infoHash }), "all of them have infohash");
		t.ok(results.every(function(x) { return x.files }), "all of them have files");
		t.end();
	});
});


// TODO this is extremely primitive
var mp = require("../cli/multipass");
var successful = [];
tape("processor - import torrent", function(t) {
	t.timeoutAfter(40000); // 40s for 50 torrents

	async.each(hashes.slice(0, 50), function(hash, callback) {
		mp.processQueue.push({ infoHash: hash, source: { url: "http://torrentz.eu" }, callback: function(err, torrent) {
			if (err) console.error(err);
			if (err) return callback(err);
			if (torrent) {
				successful.push(torrent);
				// Collect those for later tests
				var maxSeed = db.getMaxPopularity(torrent);
				(torrent.files || []).forEach(function(f) {
					//console.log(f.imdb_id,f.type)
					if (maxSeed <= cfg.minSeedToIndex) return; // cleaner?
					if (f.length < 85*1024*1024) return;
					if (f.type == "movie") movie_ids[f.imdb_id] = (movie_ids[f.imdb_id] || 0)+1;
					if (f.type == "series") series_ids[f.imdb_id] = [f.season,f.episode[0]]; // fill it with season / episode so we can use for testing later
				});
			}
			callback();
		} })
	}, function(err) {
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
		t.ok(torrents[0] && torrents[0].infoHash, "infoHash for result");
		t.ok(torrents[0] && _.find(torrents[0].files, function(f) { return f.imdb_id == imdb_id && f.season == season && f.episode.indexOf(episode)!=-1 }), "we have a file with that imdb_id inside");
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
	addon.setAuth(cfg.stremioCentral, cfg.stremioSecret);
	addon.add("http://localhost:"+addonPort);
	addon.on("addon-ready", function(service) {
		t.ok(service.manifest, "has manifest");
		t.ok(service.manifest.name, "has name");
		t.ok(service.manifest.methods && service.manifest.methods.length, "has methods");
		t.ok(service.manifest.methods && service.manifest.methods.indexOf("stream.get")!=-1, "has stream.get method");
		t.end();
	});
});


tape("addon - sample query with a movie", function(t) {
	t.timeoutAfter(3000);

	var imdb_id = Object.keys(movie_ids)[0];

	addon.stream.get({ query: { imdb_id: imdb_id, type: "movie" } }, function(err, resp) {
		t.ok(!err, "no error");
		t.ok(resp && resp.infoHash && resp.infoHash.length == 40, "has infoHash");
		//t.ok(resp && Array.isArray(resp.map), "has map");
		//t.ok(resp && !isNaN(resp.mapIdx), "has mapIdx");
		t.ok(resp && !isNaN(resp.availability), "has availability");
		//t.ok(resp && !isNaN(resp.uploaders), "has uploaders");

		t.end();
	});
});


tape("addon - sample query with a movie - stream.find", function(t) {
	t.timeoutAfter(3000);

	var imdb_id = _.pairs(movie_ids).sort(function(b,a){ return a[1] - b[1] })[0][0];

	addon.stream.find({ query: { imdb_id: imdb_id, type: "movie" } }, function(err, resp) {
		t.ok(!err, "no error");
		t.ok(Array.isArray(resp), "returns an array of streams");
		t.end();
	});
});

tape("addon - sample query with an episode", function(t) {
	t.timeoutAfter(3000);

	var imdb_id = Object.keys(series_ids)[0];
	var season = series_ids[imdb_id][0], episode = series_ids[imdb_id][1];

	addon.stream.get({ query: { imdb_id: imdb_id, season: season, episode: episode, type: "series" } }, function(err, resp) {
		t.ok(!err, "no error");
		t.ok(resp && resp.infoHash && resp.infoHash.length == 40, "has infoHash");
		//t.ok(resp && Array.isArray(resp.map), "has map");
		//t.ok(resp && !isNaN(resp.mapIdx), "has mapIdx");
		t.ok(resp && !isNaN(resp.availability), "has availability");
		//t.ok(resp && !isNaN(resp.uploaders), "has uploaders");

		/*
		var file = resp && resp.map[resp.mapIdx];
		t.ok(file, "has selected file");
		t.ok(file && file.season && file.episode, "selected file has season/episode");
		t.ok(file && file.season==season && file.episode.indexOf(episode)!=-1, "selected file matches query");	
		*/
		
		t.end();
	});
});

tape("addon - test preferrences", function(t) {
	t.skip("TEST NOT IMPLEMENTED - functionality is");
	t.end();
});


tape("addon - get stream by infoHash", function(t) {
	t.timeoutAfter(1500);

	addon.stream.get({ infoHash: successful[0].infoHash }, function(err, resp) {
		t.ok(resp && resp.infoHash && resp.infoHash.length == 40, "has infoHash");
		//t.ok(resp && Array.isArray(resp.map), "has map");
		t.ok(resp && !isNaN(resp.availability), "has availability");
		//t.ok(resp && !isNaN(resp.uploaders), "has uploaders");

		t.end();
	});
});


tape("addon - get popularities", function(t) {
	addon.call("stream.popularities", { }, function(err, res) { 
		t.ok(!err, "no error");
		t.ok(res && res.popularities, "has popularities object");
		t.ok(Object.keys(res.popularities).length > 1, "popularities object full");
		//t.ok()
	});
});


tape("addon - meta.find", function(t) {
	addon.call("meta.find", { limit: 5, query: {} }, function(err, res) { 
		t.ok(!err, "no error");
		t.ok(res && res.length === 5, "returns 5 results");
		t.end();
	});

});

tape("addon - meta.find by genre", function(t) {
	addon.call("meta.find", { limit: 3, query: { genre: "Comedy" } }, function(err, res) { 
		t.ok(!err, "no error");
		t.ok(res && res.length === 3, "returns 3 results");
		res.forEach(function(r) {
			t.ok(r.genre.indexOf("Comedy")!=-1, "has Comedy in genre");
		});
		t.end();
	});
	
});
