var tape = require('tape');

var table = require('./table.json');
var dynamodb = require('dynamodb-test')(tape,'dynamodb-migrator', table);

var _ = require('underscore');
var fs = require('fs');
var migration = require('..');
var stream = require('stream');

var fixtures = _.range(100).map(function(i) {
  return {
    id: i.toString(),
    collection: 'fake:' + i.toString(),
    data: new Buffer(i.toString())
  };
});

dynamodb.test('[index] live scan', fixtures, function(assert) {
  var active = 0;
  function migrate(item, dyno, callback) {
    active++;
    if (active > 10) assert.fail('surpassed concurrency');

    assert.ok(dyno, 'received dyno');
    assert.ok(item.id, 'one item');
    assert.ok(Buffer.isBuffer(item.data), 'decoded base64 data');

    setTimeout(function() {
      active--;
      callback();
    }, 300);
  }

  migrate.finish = function(dyno, callback) {
    assert.ok(dyno, 'finish function received dyno');
    callback();
  };

  migrate.before = function(dyno, successCallback, callback) {
    assert.ok(dyno, 'finish function received dyno');
    callback();
  };

  var options = {
    method: 'scan',
    database: 'local/' + dynamodb.tableName,
    migrate: migrate,
    stream: null,
    live: true,
    plainJSON: false,
    concurrency: 10,
    rateLogging: false
  };

  migration(options, function(err, logpath) {
    assert.ifError(err, 'success');
    assert.end();
  });
});

dynamodb.test('[index] test-mode with user-provided stream', fixtures, function(assert) {
  var received = [];
  function migrate(item, dyno, callback) {
    received.push(item);

    setTimeout(function() {
      callback();
    }, 300);
  }

  migrate.finish = function(dyno, callback) {
    assert.ok(dyno, 'finish function received dyno');
    callback();
  };

  migrate.before = function(dyno, successCallback, callback) {
    assert.ok(dyno, 'finish function received dyno');
    successCallback();
  };

  var testStream = new stream.Readable();
  testStream.items = [{ id: { N: '1'} }, { id: { N: '2'} }, { id: { N: '3'} }, { id: { N: '4'} }, { id: { N: '5'} }, { id: { N: '6'} }];
  testStream.index = 0;
  testStream._read = function() {
    testStream.push(JSON.stringify(testStream.items[testStream.index]) + '\n');
    testStream.index++;
    if (testStream.index === 6) testStream.push(null);
  };

  var options = {
    method: testStream,
    database: 'local/' + dynamodb.tableName,
    migrate: migrate,
    stream: null,
    live: true,
    plainJSON: false,
    concurrency: 10,
    rateLogging: false
  };

  migration(options, function(err, logpath) {
    assert.ifError(err, 'success');
    assert.deepEqual(
      received,
      [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}],
      'received everything from the test stream'
    );
    assert.end();
  });
});

dynamodb.test('[index] test-mode with user-provided stream that needs splitting', fixtures, function(assert) {
  var received = [];
  function migrate(item, dyno, callback) {
    received.push(item);

    setTimeout(function() {
      callback();
    }, 300);
  }

  migrate.finish = function(dyno, callback) {
    assert.ok(dyno, 'finish function received dyno');
    callback();
  };

  migrate.before = function(dyno, successCallback, callback) {
    assert.ok(dyno, 'finish function received dyno');
    successCallback();
  };

  var testStream = new stream.Readable();
  testStream.items = [{ id: { N: '1'} }, { id: { N: '2'} }, { id: { N: '3'} }, { id: { N: '4'} }, { id: { N: '5'} }, { id: { N: '6'} }];
  testStream.finished = false;
  testStream._read = function() {
    if (testStream.finished) return testStream.push(null);
    var data = testStream.items.reduce(function(data, item, i) {
      data += i > 0 ? '\n' + JSON.stringify(item) : JSON.stringify(item);
      return data;
    }, '');
    testStream.push(data);
    testStream.finished = true;
  };

  var options = {
    method: testStream,
    database: 'local/' + dynamodb.tableName,
    migrate: migrate,
    stream: null,
    live: true,
    plainJSON: false,
    concurrency: 10,
    rateLogging: false
  };

  migration(options, function(err, logpath) {
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
