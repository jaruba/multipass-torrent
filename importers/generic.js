var byline = require("byline");

module.exports = function(stream, source, cb)
{
    stream.pipe(byline.createStream()).on("data", function(line)
    {
        /* Cut the string into RegEx. this is my last resort. */
        var hashes = line.toString().match(new RegExp("([0-9A-Fa-f]){40}", "g"));
        if (hashes) hashes.forEach(function(hash) { 
        	stream.emit("infoHash", hash, source.addon);
        });
    });
    
    stream.on("end", cb);

    return stream;
};