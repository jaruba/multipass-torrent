var byline = require("byline");

module.exports = function(stream, source)
{
    return stream = stream.pipe(byline.createStream()).on("data", function(line)
    {
        /* Cut the string into RegEx. this is my last resort. */
        var line = line.toString(), match, hashes = [];
        var regex = new RegExp("(?:%3A)?(([0-9A-Fa-f]){40})", "g");
        while (match = regex.exec(line)) hashes.push(match[1]);
        if (hashes) hashes.forEach(function(hash) { stream.emit("infoHash", hash, source.addon) });
    });
};
