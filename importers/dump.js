var byline = require("byline");
var _ = require("lodash");
var log = require("../lib/log");
var events = require("events");
var needle = require("needle");

module.exports = function(stream, source)
{
    var emitter = new events.EventEmitter();

    stream.pipe(byline.createStream())
    .on("data", function(line)
    {
        var parts = line.toString().split("|"),
            infoHash = parts[0], cat = (parts[2] || "").toLowerCase(),
            additional = { }; // additional info found

        var infoUrl = parts[3];
        if (infoUrl.match("kat.cr|kickass.to")) additional.hints = { url: infoUrl }; // OR any torrent website that we know contains IMDB ID on it's info page
        
        if (cat.match("porn") || cat.match("adult")) return; // exclude that for now

        //if (cat.match("video") && (cat.match("dvd") || cat.match("rip") || cat.match("tv")))
        if (cat.match("movie") || cat.match("dvd") || cat.match("rip") || cat.match("tv")/* || cat.match("video")*/) {
            additional.category = cat;
            hashReady(infoHash, _.extend(additional, source.addon || { }));
        };
    })
    .on("error", function(err) { log.error("dump", err) })
    .on("end", function() { emitter.emit("end") });

    var checkingMinSeeders = source.minSeedersUrl && source.minSeeders;
    if (checkingMinSeeders) {
        var seedersStream = require("../lib/importer").getStream({ url: source.minSeedersUrl });

    };

    function hashReady(hash, extra) {
        emitter.emit("infoHash", hash, extra);
    };

    return emitter;
}
