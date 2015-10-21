/* Collect info hashes to queue for indexing
 */

var needle = require("needle");
var gunzip = require("gunzip-maybe");
var url = require("url");
var _ = require("lodash");

var importers = {
    dump: require("../importers/dump"),
    json: require("../importers/json"),
    xmlRss: require("../importers/xml-rss"),
    generic: require("../importers/generic")
};

var db = require("../lib/db");

function collect(source, callback, onHash) {
    var status = {
        found: 0,
        start: Date.now()
    };

    getStream(source, function(err, stream, detectedType) {
        if (err) return callback(err);

        var type = status.type = importers[source.type] ? source.type : detectedType;

        // Pass on to the importer
        stream = importers[type](stream, source);

        // Collection results
        stream.on("infoHash", function(hash, extra) {
            status.found++;
            if (onHash) onHash(hash.toLowerCase(), extra);
        });

        stream.on("end", function() {
            stream.removeAllListeners();
            status.end = Date.now();
            callback(null, status)
        });
    });
};

function getStream(source, callback) {
    var stream, response, callback = _.once(callback);
    stream = response = needle.get(source.url, {
        follow_max: 4, open_timeout: 3500,
        headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.99 Safari/537.36" }
    }).on("headers", function(headers) {
        var filename = headers["content-disposition"] || url.parse(source.url).pathname;
        var detectedType = "generic";
        if (headers["content-type"] && headers["content-type"].match("xml")) detectedType = "xmlRss";
        if (headers["content-type"] && headers["content-type"].match("json")) detectedType = "json";
        if (filename.match(".txt.gz$")) detectedType = "dump";

        if (detectedType !="json") stream = stream.pipe(gunzip()).pipe(gunzip()); // Some sources can be gunzipped twice (one for request, another for being a .txt.gz)

        stream.on("end", function() { response.end() }); // make sure response is closed

        callback(null, stream, detectedType);
    }).on("error", function(e) { callback(e) })
    .on("end", function() { 
        // TODO: we can check statusCode / etc?
        callback(new Error("empty response / couldn't detect type"));
    })
};

module.exports = {
    collect: collect,
    getStream: getStream
};