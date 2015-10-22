var FeedParser = require("feedparser");
//var collect = require("../lib/collector").collect;
var log = require("../lib/log");

var _ = require("lodash");

// This should emit results up through an EventEmitter or a pipe, not use collect directly

module.exports = function(stream, source)
{
    return stream = stream.pipe(new FeedParser())
    .on("error", function (error) { log.error("xml-rss", error, source) })
    .on("readable", function(meta)
    {
        var item, stream = this;
        while(item = stream.read())
        {
            var match = (item.link+"\n"+item.description).match(new RegExp("([0-9A-Fa-f]){40}", "g"));
            var hash = (item["rss:torrent"] && item["rss:torrent"]["infohash"]["#"]) 
                || (item["torrent:infohash"] && item["torrent:infohash"]["#"]) 
                || (match && match[0]);

            if (! (hash && hash.length == 40)) log.error("xml-rss - invalid hash: "+hash);

            /* Category filter - custom */
            if (source.category && item.categories && item.categories[0]
                && !source.category.filter(function(cat) { return item.categories[0].match(new RegExp(cat, "i")) }).length
                ) return;
            
			// For now, skip porn - to avoid false positives when finding movies
            if (item.categories && item.categories[0] && item.categories[0].match("porn")) 
                return;

            var addon = source.addon || { }; // Additional info
            if (item.hasOwnProperty("torrent:seeds")) _.extend(addon, { 
                uploaders: item["torrent:seeds"]["#"],
                downloaders: item["torrent:peers"]["#"],
                verified: !!parseInt(item["torrent:verified"]["#"])
            });
            addon.verified = source.verified || addon.verified; // the source can be assumed verified
            
            // TODO: read seeds via regex matching from description (like from http://torrentz.eu/feed?q=)
            // TODO: read from rss:description for torrentproject - http://torrentproject.com/rss/tv/

            stream.emit("infoHash", hash, addon);
        }
    });
}
