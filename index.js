var Aggregator = require('./lib/aggregator');
var Migrator = require('./lib/migrator');
var Dyno = require('dyno');
var split = require('split');
var Readable = require('stream').Readable;
var util = require('util');

module.exports = function(method, database, migrate, stream, live, plainJSON, concurrency, callback) {
  require('http').globalAgent.maxSockets = 5 * concurrency;
  require('https').globalAgent.maxSockets = 5 * concurrency;

  var region = database.split('/')[0];
  var params = {
    table: database.split('/')[1],
    region: region
  };

  if (region === 'local') {
    params.accessKeyId = 'fake';
    params.secretAccessKey = 'fake';
    params.endpoint = 'http://localhost:4567';
  }

  if (stream) {
    params.kinesisConfig = {
      stream: stream.split('/')[1],
      region: stream.split('/')[0],
      key: stream.split('/')[2].split(',')
    };

    if (stream.split('/')[0] === 'local') {
      params.kinesisConfig.accessKeyId = 'fake';
      params.kinesisConfig.secretAccessKey = 'fake';
      params.kinesisConfig.endpoint = 'http://localhost:7654';
    }
  }

  var dyno = Dyno(params);

  var aggregator = Aggregator(concurrency, method === 'scan', plainJSON);
  var migrator = Migrator(migrate, dyno, concurrency, live);

  var scanner = (function() {
    if (method === 'scan') return dyno.scan({ pages: 0 });
    if (method === 'stream') return process.stdin.pipe(split());
    if (method instanceof Readable) return method.pipe(split());
  })();

  scanner.scans = 0;
  scanner.on('dbrequest', function() {
    scanner.scans++;
  });

  var starttime = Date.now();
  setInterval(function() {
    var msg = util.format(
      '\r\033[KScanner scans: %s, read depth: %s, Aggregator write depth: %s, read depth: %s, item: %s | Migrator depth: %s, active: %s, %s/s',
      scanner.scans,
      scanner._readableState.buffer.length,
      aggregator.items(),
      aggregator._writableState.buffer.length,
      aggregator._readableState.buffer.length,
      migrator._writableState.buffer.length,
      migrator.active,
      (migrator.total / ((Date.now() - starttime) / 1000)).toFixed(4)
    );
    process.stdout.write(msg);
  }, 500).unref();

  scanner
    .pipe(aggregator)
      .on('error', callback)
    .pipe(migrator)
      .on('error', callback)
      .on('finish', function() {
        if (migrate.finish) migrate.finish(live ? dyno : null, callback);
        else callback();
      });
};
