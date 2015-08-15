var cfg = require("./cfg");

// <infohash> <collect | process | update | retire | delete> <extra message>
function logHash(hash, type, message)
{
	
};

function logOther(message)
{
	if (cfg.logLevel >= this.level) console.log(message)
};

module.exports = {
	hash: logHash,
	message: logOther.bind({ level: 3}),
	warning: logOther.bind({ level: 2 }),
	error: logOther.bind({ level: 1 }),
	important: logOther.bind({ level: 0 }),
};