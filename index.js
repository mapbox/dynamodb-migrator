var Aggregator = require('./lib/aggregator');
var Migrator = require('./lib/migrator');
var Dyno = require('dyno');
var split = require('split');
var Readable = require('stream').Readable;

module.exports = function(method, database, migrate, stream, live, json, concurrency, callback) {
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

  var aggregator = Aggregator(concurrency, method === 'scan', json);
  var migrator = Migrator(migrate, dyno, concurrency, live);

  var scanner = (function() {
    if (method === 'scan') return dyno.scan({ pages: 0 });
    if (method === 'stream') return process.stdin.pipe(split());
    if (method instanceof Readable) return method;
  })();

  scanner
    .pipe(aggregator)
      .on('error', callback)
    .pipe(migrator)
      .on('error', callback)
      .on('finish', function() {
        if (migrate.finish) migrate.finish(live ? dyno : null, migrator.log, done);
        else done();

        function done() {
          migrator.log.on('finish', function() {
            callback(null, migrator.log.path);
          });
          migrator.log.end();
        }
      });
};
