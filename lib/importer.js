
var needle = require("needle");
var gunzip = require("gunzip-maybe");
var url = require("url");

var importers = { 
	dump: require("../importers/dump"),
	xmlRss: require("../importers/xml-rss"),
	generic: require("../importers/generic")
};

var db = require("../lib/db");

function collect(source, callback)
{
	var status = { found: 0, start: Date.now() }, stream, response;

	stream = response = needle.get(source.url, { /* TODO */ })
	.on("headers", function(headers) {
		// Some sources can be gunzipped twice (one for request, another for being a .txt.gz)
		stream = stream.pipe(gunzip()).pipe(gunzip());

		var filename = headers["content-disposition"] || url.parse(source.url).pathname;
		var detectedType = "generic";
        if (headers["content-type"].match("xml")) detectedType = "xmlRss";
        if (filename.match(".txt.gz$")) detectedType = "dump";
     
		var type = status.type = importers[source.type] ? source.type : detectedType;

		// Pass on to the importer
		stream = importers[type](stream, source);

		// Collection results
		stream.on("infoHash", function(hash, extra) {
			status.found++;
		});

		stream.on("end", function() { status.end = Date.now(); callback(null, status) });
	})
	.on("error", function(err) {
		console.log(err);
		//callback TODO TODO
	});
};

module.exports = { collect: collect };
