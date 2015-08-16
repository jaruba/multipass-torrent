module.exports = {
	"logLevel": 0,
	"trackers": ["udp://open.demonii.com:1337/announce", "udp://tracker.openbittorrent.com:80/announce"],
	"trackerTimeout": 300, 

	"tags": {

	},
	"minSeedToIndex": 4,

	"matchFiles": /.mp4$|.avi$|.mkv$/i,
	"excludeFiles": /^RARBG|^Sample/i,

	"cinemeta": "http://stremio-cinemeta.herokuapp.com",

	"stremioSecret": "8417fe936f0374fbd16a699668e8f3c4aa405d9f",
	"stremioCentral": "http://api8.herokuapp.com",
};