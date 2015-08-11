var byline = require("byline");

var log = require("../lib/log");

module.export = function(stream, source, cb)
{
    var i = 0;

    stream.pipe(byline.createStream())
    .on("data", function(line)
    {
        var parts = line.toString().split("|"),
            infoHash = parts[0], cat = (parts[2] || "").toLowerCase();

        if (cat.match("porn") || cat.match("adult")) return; // exclude that for now

        //if (cat.match("video") && (cat.match("dvd") || cat.match("rip") || cat.match("tv")))
        if (cat.match("movies") || cat.match("dvd") || cat.match("rip") || cat.match("tv")/* || cat.match("video")*/) {
            stream.emit("infoHash", infoHash, source.addon);
        };
    })
    .on("error", function(err) { log.error("dump", err) })
    .on("end", cb);

    return stream;
}