#!/usr/bin/env node

var argv = require("minimist")(process.argv.slice(2));

module.dbPath = argv.dbPath || "./db";

var db = require("../lib/db");