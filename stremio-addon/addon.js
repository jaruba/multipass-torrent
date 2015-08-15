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
        return { code: 2, message: "season and episode required for type=series" };
    return false;
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
        if (!args.items) return callback({code: 10, message: "please provide args.items"});
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