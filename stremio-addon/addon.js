var Stremio = require("stremio-service");
var http = require("http");
var _ = require("lodash");

var CENTRAL = "http://api8.linvo.me";
var SECRET = "8417fe936f0374fbd16a699668e8f3c4aa405d9f";

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
    if (args.infoHash) {

    } else if (args.query) {

    } else return callback(new Error("must specify query or infoHash"));
};

var service = new Stremio.Server({
	"stream.get": function(args, callback, user) {
		var error = validate(args);
		if (error) return callback(error);


        // Properties we have to provide
        // "infoHash", "uploaders", "downloaders", "map", "mapIdx", "pieces", "pieceLength", "tag", "availability" sources runtime/time
        //callback(null, { });
	},
    "stream.find": function(args, callback, user) {
        if (!( args.items && Array.isArray(args.items))) return callback({code: 10, message: "please provide args.items which is an array"});
        var error = null;
        args.items.forEach(function(x) { error = error || validate(x) });
        if (error) return callback(error);

        
        // TODO
    },
    //"stats.get":  // TODO
}, { allow: [CENTRAL], secret: SECRET }, _.extend(require("./stremio-manifest"), _.pick(require("../package"), "")));

var server = http.createServer(function (req, res) {
    service.middleware(req, res, function() { res.end() });
}).on("listening", function()
{
	console.log("Multipass Stremio Addon listening on "+server.address().port);
});

if (module.parent) module.exports = function(port) { server.listen(port) };
else server.listen(process.env.PORT || 7000);