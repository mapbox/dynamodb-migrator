var test = require('tape');
var _ = require('underscore');
var Aggregator = require('../lib/aggregator');

test('[aggregator] objects', function(assert) {
  var aggregator = Aggregator(1, true);
  var count = 0;

  aggregator.on('data', function(data) {
    assert.ok(data.length <= 10, 'aggregates into blocks of up to 10x concurrency');
    count += data.length;

    data.forEach(function(d) {
      assert.ok(Buffer.isBuffer(d.data), 'decodes base64 strings');
      assert.ok(Buffer.isBuffer(d.decoded), 'passes through buffers');
    });
  });

  aggregator.on('end', function() {
    assert.equal(count, 30, 'passed all records through');
    assert.end();
  });

  _.range(30).forEach(function(i) {
    aggregator.write({
      data: 'base64:' + (new Buffer(i.toString())).toString('base64'),
      decoded: new Buffer(i.toString())
    });
  });

  aggregator.end();
});

test('[aggregator] strings', function(assert) {
  var aggregator = Aggregator(1, false);
  var count = 0;

  aggregator.on('data', function(data) {
    assert.ok(data.length <= 10, 'aggregates into blocks of up to 10x concurrency');
    count += data.length;

    data.forEach(function(d) {
      assert.ok(Buffer.isBuffer(d.data), 'decodes base64 strings');
    });
  });

  aggregator.on('end', function() {
    assert.equal(count, 30, 'passed all records through');
    assert.end();
  });

  _.range(30).forEach(function(i) {
    aggregator.write(JSON.stringify({
      data: 'base64:' + (new Buffer(i.toString())).toString('base64')
    }));
  });

  aggregator.end();
});
