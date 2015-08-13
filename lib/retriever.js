var request = require("needle"),
    async = require("async"),
    _ = require("lodash"),
    gunzip = require("gunzip-maybe"),
    needle = require("needle"),
    util = require("util");

var downloadSources = [
    { url: "http://torcache.net/torrent/%s.torrent" },
    { url: "http://torrage.com/torrent/%s.torrent" },
    { url: "https://yts.to/torrent/download/%s.torrent" }
];

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
            agent: module.exports.getAgent()
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
    downloader[priority ? "unshift" : "push"]({ infoHash: infoHash, callback: cb, url: hints && hints.torrent })
}

function retrieveTorrent(infoHash, cb, priority, hints)
{

} 

module.exports = { download: downloadTorrent, retrieve: retrieveTorrent };
module.exports.getAgent = function() { return null }; // dummy, to replace if you want your own agent
