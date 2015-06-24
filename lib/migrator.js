var stream = require('stream');
var queue = require('queue-async');
var crypto = require('crypto');

module.exports = function(migrate, dyno, concurrency, live) {
  var migrator = new stream.Writable({ objectMode: true });
  migrator.active = 0;
  migrator.total = 0;

  migrator._write = function(items, enc, callback) {
    var q = queue(concurrency);

    items.forEach(function(item) {
      q.defer(function(next) {
        migrator.active++;
        migrate(item, live ? dyno : null, function(err, data) {
          migrator.active--;
          migrator.total++;
          next(err, data);
        });
      });
    });

    q.awaitAll(callback);
  };

  return migrator;
};
