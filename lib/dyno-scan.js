
var Readable = require('stream').Readable;

module.exports = function(dyno, concurrency) {
  var readable = new Readable({ objectMode: true});

  var items = [];
  var streams = [];
  var numEnded = 0;
  
  for (var i=0; i<concurrency; i++) {
    streams[i] = dyno.scanStream({TotalSegments: concurrency, Segment: i});
    streams[i].on('data', function(data) {
      items.push(data);
    }).on('end', function() {
      numEnded++;      
    }).on('error', function(err) {
      readable.emit('error', err);
    }).on('validate', function(req) {
      readable.emit('validate', req);      
    });
  }

  readable._read = function() {
    var status = true;
    while (status && items.length) status = readable.push(items.shift());
    if (numEnded === concurrency) return readable.push(null);
    if (status === true) return setTimeout(readable._read);
  };

  return readable;
}

