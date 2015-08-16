module.exports = {
	"logLevel": 0,
	"trackers": ["udp://open.demonii.com:1337/announce", "udp://tracker.openbittorrent.com:80/announce"],
	"trackerTimeout": 300, 

	"minSeedToIndex": 4,

	"matchFiles": /.mp4$|.avi$|.mkv$/i,
	"excludeFiles": /^RARBG|^Sample|Cam Rip/i,

	"cinemeta": "http://stremio-cinemeta.herokuapp.com",

	"stremioSecret": "8417fe936f0374fbd16a699668e8f3c4aa405d9f",
	"stremioCentral": "http://api8.herokuapp.com",

	// Tagging system
	"tags": {
		"screener": ["SCREENER", "DVDSCR", "DVDSCREENER", "BDSCR", "SCR"],
		"cam": ["CAM", "HDCAM", "CAMRip", "HQCAM"],
		"telesync": ["TS", "HDTS", "TELESYNC", "PDVD"],
		"workprint": ["WORKPRINT", "WP"],
		"r5": ["TC", "TELECINE", "R5"], // r5 + telecine
		"web": ["WEBDL", "WEB", "WEBRIP"],
		"dvd": ["DVDRip"],
		"hdtv": ["DSR", "DSRip", "DTHRip", "DVBRip", "HDTV", "PDTV", "TVRip", "HDTVRip", "HDRip"],
		"vod": ["VODRip", "VODR"],
		"br": ["BDRip", "BRRip", "BluRay", "BDR", "BD5", "BD9"],
		"dts": ["DTS"],
		"hd": ["1080p"],
		"720p": ["720p"],
		"1080p": ["1080p"],
		"ac3": ["ac3"],
		"nonenglish": ["FRENCH", "iTALiAN", "SPANISH", "RU", "RUSSIAN", "SweSub", "dublado"],
		"badripper": ["iTALiAN", "SPARKS","EVO", "HC", "KORSUB", "Douglasvip", "MURD3R", "NKR"],
		"yify": ["yts","yify"],
		//"yts": ["yts","yify"], // reserve for directly indexing from YTS
		"cd1": ["cd1"], "cd2": ["cd2"], "cd3": ["cd3"],
		"splitted": ["cd1","cd2","cd3","cd4","part1","part2","part3", "pt1", "pt2", "pt3"],
	},
	"blacklisted": { "screener": 1, "cam": 1, "telesync": 1, "workprint": 1, "r5": 1, "splitted": 1, "badripper": 1, "nonenglish": 1 }
};