var stream = require('stream');
var queue = require('d3-queue').queue;
var crypto = require('crypto');

module.exports = function(migrate, dyno, concurrency, live) {
  var migrator = new stream.Writable({ highWaterMark: 10 * concurrency, objectMode: true });
  migrator.active = 0;
  migrator.total = 0;
  migrator.deferred = 0;

  var q = queue(concurrency);

  migrator._write = function(item, enc, callback) {
    if (migrator.deferred >= 10 * concurrency)
      return setImmediate(migrator._write.bind(migrator), item, enc, callback);

    migrator.deferred++;
    q.defer(function(next) {
      migrator.active++;
      migrate(item, live ? dyno : null, function(err, data) {
        migrator.active--;
        migrator.deferred--;
        migrator.total++;
        next(err, data);
      });
    });

    callback();
  };

  var done = migrator.end.bind(migrator);
  migrator.end = function() {
    q.awaitAll(function(err) {
      if (err) migrator.emit('error', err);
      if (migrator.active) return setImmediate(migrator.end.bind(migrator));
      done();
    });
  };

  return migrator;
};
