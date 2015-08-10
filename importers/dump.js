var byline = require("byline");

var log = require("../lib/log");

module.export = function(stream, source, cb, res)
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
            i++;
            if (source.hasOwnProperty("firstN") && i==source.firstN) { 
                /*if (optimist.argv["initial"] || optimist.argv["ignore-firstn"]) {
                    log.message("would stop crawling for "+source.url+" for reaching firstN, but --initial or --ignore-firstn passed");
                } else {
                */
                   log.message("stopping crawling for "+source.url+", reached firstN count");
                   // stream.close(); // zlib error
                   // HACK. FIX IT.
                   res.emit("end"); // close the response - http://stackoverflow.com/questions/14459644/node-js-howto-close-response-request-while-retrieving-data-chuncks             
                //}

            }
         collect
            //addToQueue(infoHash, source, source.addon);
        }
    })
    .on("error", function(err) { log.error("dump", err) })
    .on("end", cb);
}