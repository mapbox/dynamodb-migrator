var test = require('tape');
var fs = require('fs');
var Logger = require('../lib/logger');

test('[logger]', function(assert) {
  var logger = Logger();
  assert.ok(logger.path, 'exposes file path');
  assert.ok(fs.existsSync(logger.path), 'creates file');
  logger.info('informational %s', 1);
  logger.error('problematic %s', 2);
  logger.end();

  logger.on('finish', function() {
    var output = fs.readFileSync(logger.path, 'utf8');
    assert.equal(output, '[info] informational 1\n[error] problematic 2\n', 'writes expected log file');
    assert.end();
  });
});
