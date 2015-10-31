var request = require("needle"),
    async = require("async"),
    _ = require("lodash"),
    needle = require("needle"),
    util = require("util"),
    cfg = require("./cfg"),
    torrentStream = require("torrent-stream"),
    bencode = require("parse-torrent/node_modules/parse-torrent-file/node_modules/bencode"),
    parseTorrent = require("parse-torrent");

var downloadSources = cfg.downloadSources || [];

var defaultHeaders = {
    "accept-charset" : "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
    "accept-language" : "en-US,en;q=0.8",
    "accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.99 Safari/537.36" 
};

var downloader = async.queue(function(task, cb)
{
    setTimeout(cb, 500); /* This async queue is simply a rate limiter */

    var result, errors = [], sources = (task.url ? [{ formatted:task.url }] : []).concat(downloadSources);

    async.whilst(function() { return !result && sources.length }, function(innerCb)
    {
        var source = sources.shift(),
            innerCb = _.once(innerCb),
            url = source.formatted ? source.formatted : util.format(source.url, [ task.infoHash.toUpperCase() ]);

        needle.get(url, {
            open_timeout: 3500, read_timeout: 3500,
            agent: module.exports.getAgent(),
            follow_max: 3, compressed: true,
            headers: _.extend({ referer: source.url || source.formatted }, defaultHeaders)
        }, function(err, res, body) {
            if (err) { err.source = url; errors.push(err); return innerCb(); }
            else if (res && res.statusCode != 200) { errors.push(_.extend(new Error("status code "+res.statusCode), { source: url })); return innerCb() }

            if (!body) return innerCb();
             
            try { 
                if (typeof(body) == "string") body = JSON.parse(body);
                body = body["piece length"] ? bencode.encode({ info: _.extend({ pieces: [] }, body) }) : body;
                result = parseTorrent(body);
                result.infoHash = task.infoHash;
                if (! result.files) throw new Error("no files found in torrent");
            } catch(e) { e.source = url; errors.push(e) };
            innerCb();
        });
    }, function()
    {
        if (! (result && result.infoHash)) return task.callback(errors.concat([new Error("Did not manage to download parsable torrent")]));
        task.callback(null, result);
    });
}, 2);

// TODO: ability to rate-limit that section of the code
// OR just use a rate-limited peer-search instead of torrent-stream's peer searching
function fetchTorrent(infoHash, opts, cb) {
    var engine = new torrentStream(infoHash, { 
        connections: 30,
        trackers: cfg.fetchTorrentTrackers,
    });
    var cb = _.once(cb);

    engine.ready(function() { 
        cb(null, engine.torrent);
        engine.destroy(); 
    });
    setTimeout(function() {
        cb(new Error("fetchTorrent timed out"));
        engine.destroy();
    }, 15 * 1000);
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
module.exports.getAgent = function() { return undefined }; // dummy, to replace if you want your own agent
