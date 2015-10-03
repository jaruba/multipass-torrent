var request = require("needle"),
    async = require("async"),
    _ = require("lodash"),
    gunzip = require("gunzip-maybe"),
    needle = require("needle"),
    util = require("util"),
    torrentStream = require("torrent-stream"),
    parseTorrent = require("parse-torrent");

var downloadSources = [
    { url: "http://torcache.net/torrent/%s.torrent" },
    //{ url: "http://torrage.com/torrent/%s.torrent" },
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
            timeout: 3000,
            agent: module.exports.getAgent(),
            follow_max: 3,
            headers: { referer: source.url || source.formatted }
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
        if (! result) return task.callback(new Error("Did not manage to download torrent"));
        var tor;
        try { tor = parseTorrent(result); } catch(e) { return task.callback(e); }
        task.callback(null, tor);
    });
}, 2);

// TODO: ability to rate-limit that section of the code
// OR just use a rate-limited peer-search instead of torrent-stream's peer searching
function fetchTorrent(infoHash, opts, cb) {
    var engine = new torrentStream(infoHash, { 
        connections: 20,
        trackers: [
            'udp://open.demonii.com:1337',
            'udp://tracker.openbittorrent.com:80',
            'udp://tracker.leechers-paradise.org:6969',
            'udp://tracker.pomf.se:80'
        ],
    });
    var cb = _.once(cb);

    engine.ready(function() { 
        cb(null, engine.torrent);
        engine.destroy(); 
    });
    setTimeout(function() { cb(new Error("fetchTorrent timed out")) }, 10 * 1000);
};

function downloadTorrent(infoHash, opts, cb)
{
    if (typeof(opts) == "function") cb = opts;
    if (! (opts && typeof(opts) == "object")) opts = {};

    downloader[opts.important ? "unshift" : "push"]({ infoHash: infoHash, callback: function(err, torrent) {
        if (err && opts.important) return fetchTorrent(infoHash, opts, cb);
        if (err) return cb(err);
        cb(null, torrent);
    }, url: opts.url })
}

module.exports = { retrieve: downloadTorrent };
module.exports.getAgent = function() { return null }; // dummy, to replace if you want your own agent
