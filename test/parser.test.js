var test = require('tape');
var _ = require('underscore');
var Parser = require('../lib/parser');
var Dyno = require('dyno');

test('[parser] strings, DynamoDB wire-format json', function(assert) {
  var parser = Parser(false, false);
  var count = 0;

  parser.on('data', function(item) {
    assert.ok(Buffer.isBuffer(item.data), 'accepts wire-format json');
    count++;
  });

  parser.on('end', function() {
    assert.equal(count, 30, 'passed all records through');
    assert.end();
  });

  _.range(30).forEach(function(i) {
    var serial = Dyno.serialize({ data: new Buffer(i.toString()) });
    parser.write(serial);
  });

  parser.end();
});

test('[parser] strings, dyno-compatible json', function(assert) {
  var parser = Parser(false, true);
  var count = 0;

  parser.on('data', function(item) {
    assert.ok(!isNaN(item.id), 'accepts simple json');
    count++;
  });

  parser.on('end', function() {
    assert.equal(count, 30, 'passed all records through');
    assert.end();
  });

  _.range(30).forEach(function(i) {
    var serial = JSON.stringify({ id: i.toString() });
    parser.write(serial);
  });

  parser.end();
});
