var byline = require("byline");

module.exports = function(stream, source, cb)
{
    var added = 0;
    stream.pipe(byline.createStream()).on("data", function(line)
    {
        /* Cut the string into RegEx. this is my last resort. */
        var hashes = line.toString().match(new RegExp("([0-9A-Fa-f]){40}", "g"));
        if (hashes) hashes.forEach(function(hash) { if (added++ < (source.firstN || Infinity)) addToQueue(hash, source, source.addon) });
    });
    
    stream.on("end", cb);
};