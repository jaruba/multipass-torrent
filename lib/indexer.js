/* Index torrents into our database
 */

var argv = require("minimist")(process.argv.slice(2));

var retriever = require("../lib/retriever");

var parseTorrent = require("parse-torrent");

var Stremio = require("stremio-service");

var CENTRAL = "http://api8.linvo.me";
var CINEMETA_URL = argv.cinemeta || process.env.CINEMETA || "http://cinemeta.herokuapp.com";
var addons = new Stremio.Client();
addons.addService(CINEMETA_URL);
//addons.setAuth(CENTRAL, SECRET);

function index(infoHash, extra, callback)
{
	retriever.download(infoHash, function(err, buf) {
		var torrent = parseTorrent(buf);
		delete torrent.pieces;

		console.log(torrent);
	});
}

module.exports = { index: index };