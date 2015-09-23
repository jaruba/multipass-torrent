var Stremio = require("stremio-addons");
var http = require("http");
var _ = require("lodash");
var async = require("async");

var cfg = require("../lib/cfg");
var db = require("../lib/db");

function validate(args) {
    var meta = args.query;
    if (! (args.query || args.infoHash)) return { code: 0, message: "query/infoHash requried" };
    if (meta && !meta.imdb_id) return { code: 1, message: "imdb_id required" };
    if (meta && (meta.type == "series" && !(meta.hasOwnProperty("episode") && meta.hasOwnProperty("season"))))
        return { code: 2, message: "season and episode required for series type" };
    return false;
};

function query(args, callback) {
    var start = Date.now();

    (function(next) { 
        if (args.infoHash) return db.get(args.infoHash, function(err, res) { next(err, res && res[0] && res[0].value) });
        if (! args.query) return callback(new Error("must specify query or infoHash"));

        //var preferred = _.uniq(PREFERRED.concat(args.preferred || []), function(x) { return x.tag });
        var preferred = args.preferred || [];
        var prio = function(resolution) {
            return preferred.map(function(pref) { 
                return db.getAvailForTorrent(resolution.torrent) >= pref.min_avail && resolution.file.tag.indexOf(pref.tag)!=-1
            }).reduce(function(a,b) { return a+b }, 0);
        };

        var resolution = null;
        var matches = db.lookup(args.query, 3);
        async.whilst(
            function() { return matches.length && (!resolution || prio(resolution) < preferred.length) },
            function(callback) {
                var hash = matches.shift().id;
                db.get(hash, function(err, res) {
                    if (err) return callback({ err: err });

                    var tor = res[0] && res[0].value;
                    if (! tor) return callback({ err: "hash not found "+hash });

                    var file = _.find(tor.files, function(f) { 
                        return f.imdb_id == args.query.imdb_id && 
                            (args.query.season ? (f.season == args.query.season) : true) &&
                            (args.query.episode ? ((f.episode || []).indexOf(args.query.episode) != -1) : true)
                    });

                    if (db.isFileBlacklisted(file)) return callback(); // blacklisted tag

                    var res = { torrent: tor, file: file };
                    if (!resolution || prio(res) > prio(resolution)) resolution = res;

                    callback();
                });
            },
            function() { resolution ? next(resolution.err, resolution.torrent, resolution.file) : next() }
        );
    })(function(err, torrent, file) {
        // Output according to Stremio Addon API for stream.get
        // http://strem.io/addons-api
        callback(err, torrent ? _.extend({ 
            infoHash: torrent.infoHash.toLowerCase(), 
            uploaders: db.getMaxPopularity(torrent), // optional
            downloaders: Math.max.apply(Math, _.values(torrent.popularity).map(function(x) { return x[1] }).concat(0)), // optional
            //map: torrent.files,
            //pieceLength: torrent.pieceLength,
            availability: db.getAvailForTorrent(torrent),
            sources: db.getSourcesForTorrent(torrent), // optional but preferred
            runtime: Date.now()-start // optional
        }, file ? { 
            mapIdx: file.idx,
            tag: file.tag,
        } : { }) : null);      
    });
};

var service = new Stremio.Server({
    "stream.get": function(args, callback, user) {
        var error = validate(args);
        if (error) return callback(error);
        query(args, callback);
    },
    "stream.find": function(args, callback, user) {
        if ( args.items && Array.isArray(args.items)) {
            // OLD FORMAT; TODO: OBSOLETE
            var error = null;
            args.items.forEach(function(x) { error = error || validate(x) });
            if (error) return callback(error);

            async.map(args.items, query, function(err, items) { 
                callback(err, items ? { items: items.map(function(x) { 
                    return x ? { availability: x.availability, tag: x.tag } : null // TODO: send back number of candidates under _candidates
                }) } : null);
            });
        } else if (args.query) {
            // New format ; same as stream.get, even returns the full result; no point to slim it down, takes same time
            var error = validate(args);
            if (error) return callback(error);
            async.map([ _.extend({ preferred: [{ tag: "hd", min_avail: 2 }] }, args), args ], query, function(err, res) {
                callback(err, res ? _.chain(res).filter(function(x) { return x }).uniq(function(x) { return x.infoHash }).value() : undefined);
            });
        } else return callback({code: 10, message: "unsupported arguments"});

    },
    "stats.get": function(args, callback, user) { // TODO
        var c = Object.keys(db.indexes.seeders).length;
        callback(null, { stats: [
            { name: "number of torrents - "+c, count: c, colour: "green" }
        ] });
    },
}, { allow: [cfg.stremioCentral], secret: cfg.stremioSecret }, _.extend(require("./stremio-manifest"), _.pick(require("../package"), "version")));

var server = http.createServer(function (req, res) {
    service.middleware(req, res, function() { res.end() });
}).on("listening", function()
{
    console.log("Multipass Stremio Addon listening on "+server.address().port);
});

if (module.parent) module.exports = function(port, ip) { return server.listen(port, ip) };
else server.listen(process.env.PORT || 7000);
