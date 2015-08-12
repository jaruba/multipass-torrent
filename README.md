# multipass-torrent

Collects torrents from various sources (dump, RSS, HTML pages) and associates the **video files** within with IMDB ID using Stremio's index.get Addon API.

Runs on a multi-master replicated LevelDB, thanks to [mafintosh/multi-master-merge](http://github.com/mafintosh/multi-master-merge). The peers to replicate with are discovered via database ID, passed via ``-db-id=<16 byte hex string>``, discovered through DHT and SSDP.

This means the system is **distributed** and you can run several instances with their own DB copy. This is useful for creating redundancy and even crawling from several machines to distribute the load. 

It also has a Stremio Addon front-end, allowing for the content you scraped to be used in Stremio.


# example
```bash
node cli/multipass --db-id=ccb9a6f8a9af421809ad6b1f58a76f493fb30fb6 --source="https://torrentz.eu/feed_verified?q=" --db-path=/tmp/test
```


# why multipass?
[For anything else there's multipass](https://www.pinterest.com/pin/83738874291404469/)
