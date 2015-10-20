var byline = require("byline");
var _ = require("lodash");
var log = require("../lib/log");
var events = require("events");
var needle = require("needle");

module.exports = function(stream, source)
{
    var emitter = new events.EventEmitter();
    var i = 0, j = 0; // i - how many streams, j - how many completed

    stream.pipe(byline.createStream())
    .on("data", function(line)
    {
        var parts = line.toString().split("|"),
            infoHash = parts[0].toLowerCase(), cat = (parts[2] || "").toLowerCase(),
            additional = { }; // additional info found

        var infoUrl = parts[3];
        if (infoUrl.match("kat.cr|kickass.to")) additional.hints = { url: infoUrl }; // OR any torrent website that we know contains IMDB ID on it's info page
            
        if (parts[4].match(".torrent$")) additional.download = parts[4]; // URL to torrent file

        var imdbMatch = (parts[5] && parts[5].match("(tt[0-9]+)")) || (parts[3] && parts[3].match("(tt[0-9]+)"));
        if (imdbMatch) additional.hints = { imdb_id: imdbMatch && imdbMatch[0] }; // no issue to override, because the hint url is for getting imdb_id anyway

        if (cat.match("porn") || cat.match("adult")) return; // exclude that for now

        //if (cat.match("video") && (cat.match("dvd") || cat.match("rip") || cat.match("tv")))
        if (cat.match("movie") || cat.match("dvd") || cat.match("rip") || cat.match("tv")/* || cat.match("video")*/) {
            additional.category = cat;
            hashReady(infoHash, _.extend(additional, source.addon || { }));
        };
    })
    .on("error", function(err) { log.error("dump", err) })
    .on("end", checkEnded());

    var checkingSeeders = source.minSeedersUrl && source.minSeeders;
    if (checkingSeeders) require("../lib/importer").getStream({ url: source.minSeedersUrl }, function(err, stream) {
        if (err) return checkingSeeders = false; // warning - bug - some info hashes will never be flushed 

        stream.pipe(byline.createStream())
        .on("data", function(line) {
            var parts = line.toString().split("|");
            var infoHash = parts[0].toLowerCase(), uploaders = parseInt(parts[1]), downloaders = parseInt(parts[2]);
            if (uploaders >= source.minSeeders) hashReady(infoHash, { uploaders: uploaders, downloaders: downloaders });
        })
        .on("end", checkEnded())
    });

    // TODO: make sure this is cleaned up
    var hashes = { };
    function hashReady(hash, extra) {
        if (!checkingSeeders) return emitter.emit("infoHash", hash, extra);
            
        hashes[hash] = hashes[hash] || { hit: 0 };
        hashes[hash].hit++;
        _.extend(hashes[hash], extra || { });
        if (hashes[hash].hit == 2) emitter.emit("infoHash", hash, hashes[hash]);
    };

    function checkEnded() {
        i++;
        return function() { if (++j == i) emitter.emit("end") };
    };

    return emitter;
}
