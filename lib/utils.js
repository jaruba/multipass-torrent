var _ = require("lodash");
var cfg = require("./cfg");

var utils = { };

/* Utilities 
 * Those can be overriden
 */
utils.getMaxPopularity = function(torrent) {
	return Math.max.apply(Math, _.values(torrent.popularity).map(function(x) { return x[0] }).concat(0));
};
utils.isFileBlacklisted = function(file) {
	return file.tag.concat(tags(file)).some(function(tag) { return cfg.blacklisted[tag] });
};
utils.getSourcesForTorrent = function(torrent) {
	return ["dht:"+torrent.infoHash].concat(torrent.announce.map(function(x){ return "tracker:"+x }));
};
utils.getAvailForTorrent = function(torrent) {
    var maxSeeders = utils.getMaxPopularity(torrent);
    if (maxSeeders >= 300) return 4;
    if (maxSeeders >= 90) return 3;
    if (maxSeeders >= 15) return 2;
    if (maxSeeders > 0) return 1; 
    return 0;
};

function tags(file)
{
	var tags = [];
	tags.push(file.path.split(".").pop()); // file extension

	// Then tokenize into keywords; try against tagWords
	file.path.split("/").forEach(function(seg) {
		var tokens = seg.split(/\.| |-|;|_/).filter(function(x){return x});
		tokens = seg.split(/ |\.|\(|\)|\[|\]/).map(function(x) { return x.toLowerCase() }); // split, this time for tokens
		_.each(cfg.tags, function(words, tag) {
			if (tokens.filter(function(token) { return words.indexOf(token.toLowerCase()) > -1 }).length) tags.push(tag);
		});
	});

	return _.uniq(tags);
}
utils.tags = tags;

module.exports = utils;