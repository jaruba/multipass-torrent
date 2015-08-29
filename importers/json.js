'use strict';

var needle = require('needle');
var Q = require('q');
var url = require('url');
var _ = require('underscore');

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
            getEztvPages().then(parseEztv);
            break;
        case 'yts.to':

            break;

    }

}


function parseEztv(pages) {
    var imdbs = [];
    var requests = 0
    while (pages > 0 && requests <= 2) {
        requests++;
        console.log(requests, pages);
        getjson('https://eztvapi.re/shows/' + pages).then(function(json) {
            requests--;
        });
        pages--;
    }
}

function getEztvPages() {
    var defer = Q.defer();
    getjson('https://eztvapi.re/shows').then(function(json) {
        defer.resolve(json.length);
    });
    return defer.promise;
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