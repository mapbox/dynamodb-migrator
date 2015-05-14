var table = require('./table.json');
var dynamodb = require('dynamodb-test')('dynamodb-migrator', table);
var kinesis = require('kinesis-test')('dynamodb-migrator', 1);
var _ = require('underscore');
var fs = require('fs');
var migration = require('..');

var fixtures = _.range(100).map(function(i) {
  return {
    id: i.toString(),
    data: 'base64:' + (new Buffer(i.toString())).toString('base64'),
    decoded: new Buffer(i.toString())
  };
});

dynamodb.test('[index] live scan', fixtures, function(assert) {
  var active = 0;
  var gotLogger = false;
  function migrate(item, dyno, logger, callback) {
    active++;
    if (active > 10) assert.fail('surpassed concurrency');

    assert.ok(dyno, 'received dyno');
    assert.ok(item.id, 'one item');
    assert.ok(Buffer.isBuffer(item.data), 'decoded base64 data');
    logger.info(item.id);

    setTimeout(function() {
      active--;
      callback();
    }, 300);
  }

  migrate.finish = function(logger, callback) {
    gotLogger = true;
    callback();
  };

  migration('scan', 'local/' + dynamodb.tableName, migrate, null, true, 10, function(err, logpath) {
    assert.ifError(err, 'success');
    var log = fs.readFileSync(logpath, 'utf8');
    assert.ok(log, 'logged data');
    assert.ok(gotLogger, 'finish function received logger');
    assert.end();
  });
});

kinesis.start();
dynamodb.test('[index] live scan with kinesis', fixtures, function(assert) {
  var records = 0;

  function migrate(item, dyno, logger, callback) {
    dyno.deleteItem({ id: item.id }, callback);
  }

  kinesis.shards[0].on('data', function() { records++; });

  var table = 'local/' + dynamodb.tableName;
  var stream = 'local/' + kinesis.streamName + '/id';

  migration('scan', table, migrate, stream, true, 10, function(err, logpath) {
    kinesis.shards[0].on('end', function() {
      assert.equal(records, fixtures.length, 'wrote to kinesis');
      assert.end();
    });

    setTimeout(function() {
      kinesis.shards[0].close();
    }, 1000);
  });
});

dynamodb.close();
kinesis.close();
