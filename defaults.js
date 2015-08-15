module.exports = {
	"logLevel": 0,
	"trackers": ["udp://open.demonii.com:1337/announce", "udp://tracker.openbittorrent.com:80/announce"],
	"trackerTimeout": 300, 

	"tags": {

	},
	"minSeedToIndex": 4,

	"matchFiles": /.mp4$|.avi$|.mkv$/i,
	"excludeFiles": /^RARBG|^Sample/i,

	"cinemeta": "http://stremio-cinemeta.herokuapp.com"
};