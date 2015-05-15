var stream = require('stream');
var queue = require('queue-async');
var crypto = require('crypto');
var Logger = require('./logger');

module.exports = function(migrate, dyno, concurrency, live) {
  var migrator = new stream.Writable({ objectMode: true });

  migrator.log = Logger();

  migrator._write = function(items, enc, callback) {
    var q = queue(concurrency);

    items.forEach(function(item) {
      q.defer(migrate, item, live ? dyno : null, migrator.log);
    });

    q.awaitAll(function(err) {
      setImmediate(callback, err);
    });
  };

  return migrator;
};
