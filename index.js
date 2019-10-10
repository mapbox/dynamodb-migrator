var Parser = require('./lib/parser');
var Migrator = require('./lib/migrator');
var Dyno = require('@mapbox/dyno');
var split = require('split');
var Readable = require('stream').Readable;
var util = require('util');

module.exports = function(options, callback) {
  var method = options.method;
  var database = options.database;
  var migrate = options.migrate;
  var live = options.live;
  var plainJSON = options.plainJSON;
  var concurrency = options.concurrency;
  var rateLogging = options.rateLogging;

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
    params.endpoint = 'http://localhost:8000';
  }

  var dyno = Dyno(params);
  var parser = Parser(method === 'scan', plainJSON);
  var migrator = Migrator(migrate, dyno, concurrency, live);
  var scanner = (function () {
    if (method === 'scan') return dyno.scanStream();
    if (method === 'stream') return process.stdin.pipe(split());
    if (method instanceof Readable) return method.pipe(split());
  })();

  if (rateLogging) {
    scanner.scans = 0;
    scanner.on('dbrequest', function () {
      scanner.scans++;
    });

    var starttime = Date.now();

    setInterval(function () {
      var msg = util.format(
        '\r\033[KScanner scans: %s, read depth: %s, Parser write depth: %s, read depth: %s | Migrator depth: %s, active: %s, %s/s',
        scanner.scans,
        scanner._readableState.buffer.length,
        parser._writableState.buffer.length,
        parser._readableState.buffer.length,
        migrator._writableState.buffer.length,
        migrator.active,
        (migrator.total / ((Date.now() - starttime) / 1000)).toFixed(4)
      );
      process.stdout.write(msg);
    }, 50).unref();
  }

  let successCallback = function() {
    scanner
      .pipe(parser)
      .on('error', callback)
      .pipe(migrator)
      .on('error', callback)
      .on('finish', function () {
        if (migrate.finish) migrate.finish(live ? dyno : null, callback);
        else callback();
      });
  }
  migrate.before(dyno, successCallback, callback);
};
