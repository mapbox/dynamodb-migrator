var Aggregator = require('./lib/aggregator');
var Migrator = require('./lib/migrator');
var Dyno = require('dyno');
var split = require('split');

module.exports = function(method, database, migrate, stream, live, concurrency, callback) {
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

  var aggregator = Aggregator(concurrency, method === 'scan');
  var migrator = Migrator(migrate, dyno, concurrency, live);

  var scanner = method === 'scan' ?
    dyno.scan({ pages: 0 }) :
    process.stdin.pipe(split());

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
