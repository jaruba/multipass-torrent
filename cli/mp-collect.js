#!/usr/bin/env node

var argv = require("minimist")(process.argv.slice(2));
var url = require("url");
var net = require("net");
var _ = require("lodash");

module.dbPath = argv["db-path"] || "./db";

var db = require("../lib/db");
db.listenReplications();
if (argv.replicate) db.getSyncStream().pipe(net.connect(url.parse(argv.replicate).port));

/*
db.torrents.put("xxxxx", "test");
db.torrents.put("testy test", "foo");
db.torrents.put("another key", "is testing");*/