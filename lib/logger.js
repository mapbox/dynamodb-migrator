var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('util');
var crypto = require('crypto');

module.exports = function() {
  var job = crypto.randomBytes(4).toString('hex');
  var logpath = path.join(os.tmpdir(), 'migration-' + job + '.log');

  var logger = fs.createWriteStream(logpath);

  logger.path = logpath;

  logger.info = function() {
    var msg = util.format.apply(util, arguments);
    logger.write(msg + '\n');
    console.log(msg);
  };

  logger.error = function() {
    var msg = '[error] ' + util.format.apply(util, arguments);
    logger.write(msg + '\n');
    console.log(msg);
  };

  return logger;
};
