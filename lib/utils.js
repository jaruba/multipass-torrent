var _ = require("lodash");
var cfg = require("./cfg");

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

module.exports = { tags: tags };