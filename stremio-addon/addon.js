var Stremio = require("stremio-service");
var http = require("http");
var _ = require("lodash");

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

function availability(torrent) {
    var maxSeeders = Math.max.apply(Math, _.values(torrent.popularity).map(function(x) { return x[0] }));

    if (maxSeeders >= 300) return 4;
    if (maxSeeders >= 90) return 3;
    if (maxSeeders >= 15) return 2;
    if (maxSeeders > 0) return 1; 
    return 0;
};

function query(args, callback) {
    (function(next) { 
        if (args.infoHash) db.get(args.infoHash, function(err, res) { next(err, res && res[0] && res[0].value) });
        else if (args.query) db.find(args.query, 3, function(err, torrents) {
            // TODO: instead of retrieving all 3 torrents at once, we can try with first, if blacklisted get second, etc. 
            // until we try top 3-4 
            if (err) return next(err);

            // TODO: maybe update seed/leech counts?

            var found = false;
            torrents.forEach(function(tor) {
                var file = _.find(tor.files, function(f) { 
                    return f.imdb_id == args.query.imdb_id && 
                        (args.query.season ? (f.season == args.query.season) : true) &&
                        (args.query.episode ? ((f.episode || []).indexOf(args.query.episode) != -1) : true)
                });

                //if (file.tags.concat().some(function(tag) { return blacklisted[tag] })) return; // blacklisted tag

                found = true;
                next(null, tor, file);
                //console.log(tor, file)
            });
        });
        else return callback(new Error("must specify query or infoHash"));
    })(function(err, torrent, file) {
        // if (! torrent)

        // TODO link to stremio documentation, documenting those props
        // Properties we have to provide
        // "infoHash", "uploaders", "downloaders", "map", "mapIdx", "pieces", "pieceLength", "tag", "availability" sources runtime/time        
    });
};

var service = new Stremio.Server({
	"stream.get": function(args, callback, user) {
		var error = validate(args);
		if (error) return callback(error);
        query(args, callback);
	},
    "stream.find": function(args, callback, user) {
        if (!( args.items && Array.isArray(args.items))) return callback({code: 10, message: "please provide args.items which is an array"});
        var error = null;
        args.items.forEach(function(x) { error = error || validate(x) });
        if (error) return callback(error);


        // TODO
    },
    //"stats.get":  // TODO
}, { allow: [cfg.stremioCentral], secret: cfg.stremioSecret }, _.extend(require("./stremio-manifest"), _.pick(require("../package"), "version")));

var server = http.createServer(function (req, res) {
    service.middleware(req, res, function() { res.end() });
}).on("listening", function()
{
	console.log("Multipass Stremio Addon listening on "+server.address().port);
});

if (module.parent) module.exports = function(port) { return server.listen(port) };
else server.listen(process.env.PORT || 7000);