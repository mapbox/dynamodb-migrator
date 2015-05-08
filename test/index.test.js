var table = require('./table.json');
var dynamodb = require('dynamodb-test')('dynamodb-migrator', table);
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

  migration('scan', 'local/' + dynamodb.tableName, migrate, true, 10, function(err, logpath) {
    assert.ifError(err, 'success');
    var log = fs.readFileSync(logpath, 'utf8');
    assert.ok(log, 'logged data');
    assert.end();
  });
});

dynamodb.close();
