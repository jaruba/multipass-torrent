var request = require("needle"),
    async = require("async"),
    _ = require("lodash"),
    gunzip = require("gunzip-maybe"),
    needle = require("needle"),
    util = require("util"),
    parseTorrent = require("parse-torrent");

var downloadSources = [
    { url: "http://torcache.net/torrent/%s.torrent" },
    { url: "http://torrage.com/torrent/%s.torrent" },
    { url: "https://yts.to/torrent/download/%s.torrent" }
];

/* TODO: use torrent-stream - derived module "exchange-metadata" to be able to retrieve the torrent from peers
 * we already have a method to get them in peer-search and namely indexer.seedleech 
 * this should take 2-3 seconds (if we try many peers), a lot more if we try peers slower, but it can be unrestricted by rate limits
 */

var downloader = async.queue(function(task, cb)
{
    setTimeout(cb, 400); /* This async queue is simply a rate limiter */
 
    var result, sources = (task.url ? [{ formatted:task.url }] : []).concat(downloadSources);
    async.whilst(function() { return !result && sources.length }, function(innerCb)
    {
        var source = sources.shift(),
            innerCb = _.once(innerCb);

        var res = needle.get(source.formatted ? source.formatted : util.format(source.url, [ task.infoHash.toUpperCase() ]), {
            timeout: 4000,
            agent: module.exports.getAgent(),
            follow_max: 3
        })
        .on("error", function() { innerCb() }) /* Go on to the next source */
        .on("readable", function()
        {
            res = res.pipe(gunzip());

            var bufs = [];
            res.on("error", function() { innerCb() });
            res.on("data", function(buf) { bufs.push(buf) });
            res.on("end", function() { result = Buffer.concat(bufs); innerCb() });
        });        
    }, function()
    {
        task.callback(result ? null : new Error("Did not manage to download torrent"), result)
    });
}, 2);

function downloadTorrent(infoHash, cb, priority, hints)
{
    downloader[priority ? "unshift" : "push"]({ infoHash: infoHash, callback: function(err, buf) {
        if (err) return cb(err);
        var tor;
        try { tor = parseTorrent(buf); } catch(e) { return cb(e); }
        cb(null, tor);
    }, url: hints && hints.torrent })
}

module.exports = { retrieve: downloadTorrent };
module.exports.getAgent = function() { return null }; // dummy, to replace if you want your own agent
