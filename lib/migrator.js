var stream = require('stream');
var queue = require('queue-async');
var crypto = require('crypto');

module.exports = function(migrate, dyno, concurrency, live) {
  var migrator = new stream.Writable({ objectMode: true });

  migrator._write = function(items, enc, callback) {
    var q = queue(concurrency);

    items.forEach(function(item) {
      q.defer(migrate, item, live ? dyno : null);
    });

    q.awaitAll(function(err) {
      setImmediate(callback, err);
    });
  };

  return migrator;
};
