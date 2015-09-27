module.exports = {
	"logLevel": 1,
	"trackers": ["udp://open.demonii.com:1337/announce", "udp://tracker.openbittorrent.com:80/announce"],
	"trackerTimeout": 300, 

	"minSeedToIndex": 4,
	"minSeedImportant": 200, // if it's important, we'll try to get the meta from the DHT / peers even when caches fail

	// If the torrent hasn't been updated for that time and not seeded, delete it
	"torrentTTL": 10*24*60*60*1000, 

	"matchFiles": /.mp4$|.avi$|.mkv$/i,
	"excludeFiles": /^RARBG|^Sample|Cam Rip/i,
	"excludeTorrents": null,

	"cinemeta": "http://stremio-cinemeta.herokuapp.com",

	"stremioSecret": "8417fe936f0374fbd16a699668e8f3c4aa405d9f",
	"stremioCentral": "http://api8.herokuapp.com",

	// Tagging system; all tags must be lowercase
	"tags": {
		"screener": ["screener", "dvdscr", "dvdscreener", "bdscr", "scr"],
		"cam": ["cam", "hdcam", "camrip", "hqcam"],
		"telesync": ["ts", "hdts", "telesync", "pdvd"],
		"workprint": ["workprint", "wp"],
		"r5": ["tc", "telecine", "r5"], // r5 + telecine
		"web": ["webdl", "web", "webrip"],
		"dvd": ["dvdrip"],
		"hdtv": ["dsr", "dsrip", "dthrip", "dvbrip", "hdtv", "pdtv", "tvrip", "hdtvrip", "hdrip"],
		"vod": ["vodrip", "vodr"],
		"br": ["bdrip", "brrip", "bluray", "bdr", "bd5", "bd9"],
		"dts": ["dts"],
		"hd": ["1080p"],
		"720p": ["720p"],
		"1080p": ["1080p"],
		"ac3": ["ac3"],
		"nonenglish": ["french", "italian", "spanish", "ru", "russian", "swesub", "dublado"],
		"badripper": ["italian", "sparks","evo", "hc", "korsub", "douglasvip", "murd3r", "nkr"],
		"yify": ["yts","yify"],
		//"yts": ["yts","yify"], // reserve for directly indexing from yts
		"cd1": ["cd1"], "cd2": ["cd2"], "cd3": ["cd3"],
		"splitted": ["cd1","cd2","cd3","cd4","part1","part2","part3", "pt1", "pt2", "pt3"],
	},
	"blacklisted": { "screener": 1, "cam": 1, "telesync": 1, "workprint": 1, "r5": 1, "splitted": 1, "badripper": 1, "nonenglish": 1 }
};
