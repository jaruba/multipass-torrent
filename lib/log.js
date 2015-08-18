var cfg = require("./cfg");

// <infohash> <collect | process | retire | delete> <extra message>
function logHash(hash, type, message)
{
	// TODO we can log hashes individually here, as we receive messages on what is happening with them
	// currently retire and delete cannot be received since we don't clean our DB
};

function logOther()
{
	if (cfg.logLevel >= this.level) console.log.apply(console, arguments)
};

module.exports = {
	hash: logHash,
	message: logOther.bind({ level: 3}),
	warning: logOther.bind({ level: 2 }),
	error: logOther.bind({ level: 1 }),
	important: logOther.bind({ level: 0 }),
};