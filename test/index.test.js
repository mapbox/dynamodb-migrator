var table = require('./table.json');
var dynamodb = require('dynamodb-test')('dynamodb-migrator', table);
var kinesis = require('kinesis-test')('dynamodb-migrator', 1);

var table2 = require('./table2.json');
var dynamodb2 = require('dynamodb-test')('dynamodb-migrator2', table2);
var kinesis2 = require('kinesis-test')('dynamodb-migrator2', 1);

var _ = require('underscore');
var fs = require('fs');
var migration = require('..');
var stream = require('stream');

var fixtures = _.range(100).map(function(i) {
  return {
    id: i.toString(),
    collection: 'fake:' + i.toString(),
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

  migrate.finish = function(dyno, logger, callback) {
    gotLogger = true;
    assert.ok(dyno, 'finish function received dyno');
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
kinesis.close();

dynamodb.test('[index] test-mode with user-provided stream', fixtures, function(assert) {
  var received = [];
  var gotLogger = false;
  function migrate(item, dyno, logger, callback) {
    received.push(item);

    setTimeout(function() {
      callback();
    }, 300);
  }

  migrate.finish = function(dyno, logger, callback) {
    gotLogger = true;
    assert.ok(dyno, 'finish function received dyno');
    callback();
  };

  var testStream = new stream.Readable();
  testStream.items = [{ id: { N: '1'} }, { id: { N: '2'} }, { id: { N: '3'} }, { id: { N: '4'} }, { id: { N: '5'} }, { id: { N: '6'} }];
  testStream.index = 0;
  testStream._read = function() {
    testStream.push(JSON.stringify(testStream.items[testStream.index]) + '\n');
    testStream.index++;
    if (testStream.index === 6) testStream.push(null);
  };

  migration(testStream, 'local/' + dynamodb.tableName, migrate, null, true, 10, function(err, logpath) {
    assert.ifError(err, 'success');
    assert.deepEqual(
      received,
      [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}],
      'received everything from the test stream'
    );
    assert.end();
  });
});
dynamodb.close();

kinesis2.start();
dynamodb2.test('[index] live scan with kinesis, 2-property key', fixtures, function(assert) {
    var records = 0;

    function migrate(item, dyno, logger, callback) {
        var key = {id: item.id, collection: item.collection};
        dyno.deleteItem(key, callback);
    }

    kinesis2.shards[0].on('data', function() { records++; });

    var table = 'local/' + dynamodb2.tableName;
    var stream = 'local/' + kinesis2.streamName + '/id,collection';

    migration('scan', table, migrate, stream, true, 10, function(err, logpath) {
        kinesis2.shards[0].on('end', function() {
            assert.equal(records, fixtures.length, 'wrote to kinesis');
            assert.end();
        });

        setTimeout(function() {
            kinesis2.shards[0].close();
        }, 1000);
    });
});
dynamodb2.close();
kinesis2.close();
