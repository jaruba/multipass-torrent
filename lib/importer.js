
var needle = require("needle");
var gunzip = require("gunzip-maybe");

var dump = require("../importers/dump");
var xmlRss = require("../importers/xml-rss");
var generic = require("../importers/generic");

function collect(source, callback)
{
	var status = { found: 0, imported: 0 };
	
	var stream = needle.get(source.url, { /* TODO */ })
	.on("headers", function(headers) {
		// Some sources can be gunzipped twice (one for request, another for being a .txt.gz)
		stream = stream.pipe(gunzip()).pipe(gunzip()); 
	})
	.on("error", function(err) {
		console.log(err);
		//callback
	});
	console.log(source);
};

module.exports = { collect: collect };
