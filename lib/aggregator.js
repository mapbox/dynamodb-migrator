var stream = require('stream');
var Dyno = require('dyno');

module.exports = function(concurrency, objectMode) {
  var items = [];

  var aggregator = new stream.Transform();
  aggregator._writableState.objectMode = objectMode;
  aggregator._readableState.objectMode = true;

  aggregator._transform = function(item, enc, callback) {
    if (Buffer.isBuffer(item)) item = item.toString('utf8');
    if (!item) return callback();

    item = typeof item === 'string' ? Dyno.deserialize(item) : item;
    for (var key in item) {
      if (typeof item[key] === 'string' && item[key].indexOf('base64:') === 0) {
        item[key] = new Buffer(item[key].split('base64:')[1], 'base64');
      }
    }

    items.push(item);
    if (items.length < 10 * concurrency) return callback();
    aggregator.push(items);

    items = [];
    callback();
  };

  aggregator._flush = function(callback) {
    aggregator.push(items);
    callback();
  };

  return aggregator;
};
