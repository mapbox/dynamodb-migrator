var stream = require('stream');
var Dyno = require('dyno');

module.exports = function(objectMode, plainJSON) {
  var parser = new stream.Transform();
  parser._writableState.objectMode = objectMode;
  parser._readableState.objectMode = true;

  parser._transform = function(item, enc, callback) {
    if (Buffer.isBuffer(item)) item = item.toString('utf8');
    if (!item) return callback();

    function parse(item) {
        if (plainJSON) return JSON.parse(item);
        else return Dyno.deserialize(item);
    }

    item = typeof item === 'string' ? parse(item) : item;
    parser.push(item);
    callback();
  };

  return parser;
};
