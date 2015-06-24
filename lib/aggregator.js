var stream = require('stream');
var Dyno = require('dyno');

module.exports = function(concurrency, objectMode, plainJSON) {
  var items = [];

  var aggregator = new stream.Transform();
  aggregator._writableState.objectMode = objectMode;
  aggregator._readableState.objectMode = true;
  aggregator.items = function() { return items.length; };

  aggregator._transform = function(item, enc, callback) {
    if (Buffer.isBuffer(item)) item = item.toString('utf8');
    if (!item) {
      aggregator.emit('readable');
      return callback();
    }

    function parse(item) {
        if (plainJSON) return JSON.parse(item);
        else return Dyno.deserialize(item);
    }

    item = typeof item === 'string' ? parse(item) : item;
    items.push(item);

    if (items.length < 10 * concurrency) {
      aggregator.emit('readable');
      return callback();
    }

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
