'use strict';

var needle = require('needle');
var Q = require('q');
var url = require('url');

//var collect = require("../lib/collector").collect;
var log = require("../lib/log");



// This should emit results up through an EventEmitter or a pipe, not use collect directly

module.exports = function(stream, source) {

    return Q.all([getjson(source.url), parsesource(source.url)]).spread(importjson);

}

function importjson(json, host) {
    console.log(json, host)
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
        follow_max: 4
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