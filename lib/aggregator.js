var stream = require('stream');
var Dyno = require('dyno');

module.exports = function(concurrency, objectMode, plainJSON) {
  var aggregator = new stream.Transform();
  aggregator._writableState.objectMode = objectMode;
  aggregator._readableState.objectMode = true;

  aggregator._transform = function(item, enc, callback) {
    if (Buffer.isBuffer(item)) item = item.toString('utf8');
    if (!item) return callback();

    function parse(item) {
        if (plainJSON) return JSON.parse(item);
        else return Dyno.deserialize(item);
    }

    item = typeof item === 'string' ? parse(item) : item;
    aggregator.push(item);
    callback();
  };

  return aggregator;
};
