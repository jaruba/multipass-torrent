'use strict';

var needle = require('needle');
var Q = require('q');
var url = require('url');

var log = require('../lib/log');

var eztvEndpoints = ['eztvapi.re', 'tv.ytspt.re', 'api.popcorntime.io', 'api.popcorntime.cc'];


// This should emit results up through an EventEmitter or a pipe, not use collect directly

module.exports = function(stream, source) {
    return Q.all([getjson(source.url), parsesource(source.url)]).spread(importjson);
}

function importjson(json, host) {
    if (host === 'unknown') {
        log.error('json unknown source', source);
        return;
    }

    switch (host) {
        case 'eztv':
            parseEztv();
            break;
        case 'yts.to':

            break;

    }

}

function crawl(cb) {
    var queue;
    needle.get(source.url + "shows", function(err, resp) {
        if (err) console.error(err);

        if (!(resp && resp.body && Array.isArray(resp.body))) return cb(new Error("/shows err"));

        resp.body.forEach(function(url) {
            queue.push(source.url + url)
        });
    });
    queue = async.queue(function(task, next) {
        needle.get(task.url, function(err, resp) {
            if (err) return next(err); // or ignore - choose one

            // Shows response, add all shows to queue
            if (resp && resp.body && Array.isArray(resp.body)) resp.body.forEach(function(s) {
                queue.push(source.url + "show/" + s.imdb_id)
            });

            // Episodes response, do whatever
            if (resp && resp.body && resp.body.episodes) {

            }
        })
    }, 2);
}

function processEztv() {
    console.log('blah')
    var queue = async.queue(function(task, next) {
        console.log(task);
        getjson(task).then(function(response) {
            process.nextTick(next)
            console.log(response);
        });
    }, 2);

    queue.push('https://eztvapi.re/shows');
}

/*needle.get(task.url, function(err, resp, body) {
            if (err) return next(err); // or ignore - choose one

            if (resp && resp.body && Array.isArray(resp.body) && typeof(resp.body[0]) == "string") resp.body.forEach(function(url) {
                queue.push(source.url + url)
            });

            // Shows response, add all shows to queue
            if (resp && resp.body && Array.isArray(resp.body) && resp.body[0].imdb_id) resp.body.forEach(function(s) {
                queue.push(source.url + "show/" + s.imdb_id)
            });

            // Episodes response, do whatever
            if (resp && resp.body && resp.body.episodes) {
                console.log(resp.body.episodes);

            }
        })*/

function parsesource(s) {
    var host,
        s = url.parse(s);
    switch (s.host) {
        case 'eztvapi.re':
            host = 'eztv';
            break;
        case 'yts.to':
            host = 'yts';
            break;
        default:
            host = 'unknown';
    }
    return Q(host);
}


function getjson(url) {
    var defer = Q.defer();
    var params = {
        compressed: true, // sets 'Accept-Encoding' to 'gzip,deflate'
        follow_max: 2,
        json: true
    };
    needle.get(url, params, function(error, response) {
        if (!error && response.statusCode == 200) {
            defer.resolve(response.body);
        } else {
            defer.reject(error || response.statusCode)
        }
    });
    return defer.promise;
}