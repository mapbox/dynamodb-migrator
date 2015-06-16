var test = require('tape');
var _ = require('underscore');
var fs = require('fs');
var Migrator = require('../lib/migrator');

test('[migrator] live', function(assert) {
  var active = 0;
  var found = [];
  function migrate(item, dyno, callback) {
    assert.ok(dyno.isDyno, 'received dyno');
    active++;
    if (active > 10) assert.fail('surpassed concurrency');
    found.push(item);
    setTimeout(function() {
      active--;
      callback();
    }, 500);
  }

  var migrator = Migrator(migrate, { isDyno: true }, 10, true);

  var items = _.range(30);
  migrator.write(items);
  migrator.end();
  migrator.on('finish', function() {
    assert.deepEqual(found, items, 'received all items');
    assert.end();
  });
});

test('[migrator] not live', function(assert) {
  var active = 0;
  var found = [];
  function migrate(item, dyno, callback) {
    assert.notOk(dyno, 'did not receive dyno');
    active++;
    if (active > 10) assert.fail('surpassed concurrency');
    found.push(item);
    setTimeout(function() {
      active--;
      callback();
    }, 500);
  }

  var migrator = Migrator(migrate, { isDyno: true }, 10);

  var items = _.range(30);
  migrator.write(items);
  migrator.end();
  migrator.on('finish', function() {
    assert.deepEqual(found, items, 'received all items');
    assert.end();
  });
});
