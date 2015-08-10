// <infohash> <collect | process | update | retire | delete> <extra message>
function logHash(hash, type, message)
{
	
};

function logOther(message)
{

};

module.exports = {
	hash: logHash,
	message: logOther.bind({ level: 1}),
	warning: logOther.bind({ level: 2 }),
	error: logOther.bind({ level: 3 })
};