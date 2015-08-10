# multipass-torrent

Collects torrents from various sources (dump, RSS, HTML pages) and associates the **video files** within with IMDB ID using Stremio's index.get Addon API.

Runs on a multi-master replicated LevelDB, thanks to [mafintosh/multi-master-merge](http://github.com/mafintosh/multi-master-merge).

This means the system is **distributed** and you can run several instances with their own DB copy. This is useful for creating redundancy and even crawling from several machines to distribute the load. 

``multipass`` takes an infoHash to identify it's database, finding other ``multipass`` instances with this database using Kademlia DHT.

It also has a Stremio Addon front-end, allowing for the content you scraped to be used in Stremio.


# why multipass?
[For anything else there's multipass](https://www.pinterest.com/pin/83738874291404469/)
