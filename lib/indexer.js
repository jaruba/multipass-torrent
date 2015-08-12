/* Index torrents into our database
 */

var argv = require("minimist")(process.argv.slice(2));
var parseTorrent = require("parse-torrent");
var _ = require("lodash");
var Stremio = require("stremio-service");
var retriever = require("../lib/retriever");

var MATCH_FILES = /.mp4$|.avi$|.mkv$/i; // video types we're interested in
var EXCLUDE = /^RARBG|^Sample$/i; // exclude from filename

var CENTRAL = "http://api8.linvo.me";
var SECRET = "8417fe936f0374fbd16a699668e8f3c4aa405d9f";
var CINEMETA_URL = argv.cinemeta || process.env.CINEMETA || "http://stremio-cinemeta.herokuapp.com";
var addons = new Stremio.Client();
addons.addService(CINEMETA_URL);
addons.setAuth(CENTRAL, SECRET);

function index(task, options, callback)
{
	var task = typeof(task) == "string" ? { infoHash: task } : task;
	var torrent = task.torrent || { };

	// Core properties
	torrent.sources = torrent.sources || { };
	torrent.popularity = torrent.popularity || { };

	if (task.source && torrent.sources[task.source.url]) return callback(null, torrent);

	// Update sources
	if (task.source) torrent.sources[task.source.url] = Date.now();
	delete torrent.source;

	// Skip logic - if we already have an indexed torrent with files / uninteresting
	if (!options.force && (torrent.files || torrent.uninteresting)) return callback(null, torrent);

	// Retrieve the torrent meta and set .files
	retriever.download(task.infoHash, function(err, buf) {
		if (err) return callback(err);

		_.extend(torrent, _.omit(parseTorrent(buf), "pieces", "info", "infoBuffer"));

        torrent.files = torrent.files
            .map(function(file, idx) { return _.extend(file, { idx: idx }) })
            .filter(function(file) { return file.path.match(options.matchFiles || MATCH_FILES) && !file.name.match(EXCLUDE) }); 
        
        (function(next) { 
	        if (! torrent.files.length) return next();

	        // fromOutside - parsing names from the outside, since with torrents outside names make more sense
	        addons.index.get({ fromOutside: true, strict: true, files: torrent.files }, function(err, res) {
	        	if (err) return callback(err);

	        	torrent.files = res.files;
	        	next();
	        });
        })(function() {
        	torrent.uninteresting = !torrent.files.length;
        	callback(null, torrent);
        });
	});
}

function update(torrent, callback)
{

}

function merge(torrents)
{
	// NOTE: here, on the merge logic, we can set properties that should always be set
	// Or just rip out the model logic from LinvoDB into a separate module and use it
	return torrents.reduce(function(a, b) { 
		return _.merge(a, b, function(x, y) {
			// this is for the files array, and we want more complicated behaviour 
			if (_.isArray(a) && _.isArray(b)) return b;
		})
	})
}

module.exports = { index: index, update: update, merge: merge };