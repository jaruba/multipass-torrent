'use strict';

var needle = require('needle');
var Q = require('q');
var url = require('url');
var async = require('async');

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
            processEztv();
            break;
        case 'yts':
            break;
    }
}

function processEztv() {
    var queue = async.queue(function(task, next) {
        getjson(task).then(function(response) {
            if (response.episodes) {
                console.log(response);
            } else if (response.imdb_id) {
                response.forEach(function(s) {
                    queue.push('https://eztvapi.re' + "show/" + s.imdb_id)
                });
            } else if (response && response.length > 0) {
                response.forEach(function(item) {
                    queue.push('https://eztvapi.re/' + item.imdb_id)
                });
            }
            process.nextTick(next);
        });
    }, 2);
    queue.push('https://eztvapi.re/shows');
}

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
        follow_max: 2
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