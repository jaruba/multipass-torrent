/* Index torrents into our database
 */

var argv = require("minimist")(process.argv.slice(2));
var parseTorrent = require("parse-torrent");
var _ = require("lodash");
var path = require("path");
var Stremio = require("stremio-service");
var retriever = require("../lib/retriever");

var MATCH_FILES = /.mp4$|.avi$|.mkv$/i; // video types we're interested in
var EXCLUDE = /^RARBG$|^Sample$/i; // exclude from filename

var CENTRAL = "http://api8.linvo.me";
var CINEMETA_URL = argv.cinemeta || process.env.CINEMETA || "http://cinemeta.herokuapp.com";
var addons = new Stremio.Client();
addons.addService(CINEMETA_URL);
//addons.setAuth(CENTRAL, SECRET);

function index(task, options, callback)
{
	var task = typeof(task) == "string" ? { infoHash: task } : task;

	// step 1 - check in our index what's the state of the torrent - db.indexes.state[infoHash] - if it's not indexed and not un-interesting, go on
	// step 2 
	retriever.download(task.infoHash, function(err, buf) {
		var torrent = parseTorrent(buf);
		delete torrent.pieces;

        var files = torrent.files
            .map(function(file, idx) { return _.extend(file, { idx: idx }) })
            .filter(function(file) { return file.path.match(options.matchFiles || MATCH_FILES) && !path.basename(file.path).match(EXCLUDE) }); 
        
        console.log(files);
		//console.log(torrent);
	});
}

module.exports = { index: index };