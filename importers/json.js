var JSONStream = require('JSONStream');
var es = require('event-stream');

var log = require("../lib/log");

// This should emit results up through an EventEmitter or a pipe, not use collect directly

module.exports = function(stream, source)
{
    return stream = stream.pipe(process.stdout)
}