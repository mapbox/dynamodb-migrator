var test = require('tape');
var _ = require('underscore');
var fs = require('fs');
var Migrator = require('../lib/migrator');

test('[migrator] live', function(assert) {
  var active = 0;

  function migrate(item, dyno, logger, callback) {
    assert.ok(dyno.isDyno, 'received dyno');
    assert.ok(logger, 'received logger');
    active++;
    if (active > 10) assert.fail('surpassed concurrency');
    logger.info(item);
    setTimeout(function() {
      active--;
      callback();
    }, 500);
  }

  var migrator = Migrator(migrate, { isDyno: true }, 10, true);
  assert.ok(migrator.log, 'exposes logger');

  var items = _.range(30);
  migrator.write(items);
  migrator.end();
  migrator.on('finish', function() {
    var log = fs.readFileSync(migrator.log.path, 'utf8');
    var expected = items.map(function(item) {
      return JSON.stringify(item);
    }).join('\n') + '\n';
    assert.equal(log, expected, 'wrote expected log');
    assert.end();
  });
});

test('[migrator] not live', function(assert) {
  var active = 0;

  function migrate(item, dyno, logger, callback) {
    assert.notOk(dyno, 'did not receive dyno');
    assert.ok(logger, 'received logger');
    active++;
    if (active > 10) assert.fail('surpassed concurrency');
    logger.info(item);
    setTimeout(function() {
      active--;
      callback();
    }, 500);
  }

  var migrator = Migrator(migrate, { isDyno: true }, 10);
  assert.ok(migrator.log, 'exposes logger');

  var items = _.range(30);
  migrator.write(items);
  migrator.end();
  migrator.on('finish', function() {
    var log = fs.readFileSync(migrator.log.path, 'utf8');
    var expected = items.map(function(item) {
      return JSON.stringify(item);
    }).join('\n') + '\n';
    assert.equal(log, expected, 'wrote expected log');
    assert.end();
  });
});
