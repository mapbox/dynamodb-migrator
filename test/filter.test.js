var test = require('tape');
var path = require('path');
var os = require('os');
var fs = require('fs');
var crypto = require('crypto');
var zlib = require('zlib');
var filterer = require('../bin/filter');
var cmd = path.resolve(__dirname, '..', 'bin', 'filter.js');
var exec = require('child_process').exec;

var infile = path.resolve(__dirname, 'fixtures', 'input.gz');
var expected = path.resolve(__dirname, 'fixtures', 'output.gz');
expected = fs.readFileSync(expected);
var filter = path.resolve(__dirname, 'fixtures', 'filter.js');

test('[filter] filters', function(assert) {
  var found = new Buffer(0);
  filterer(infile, require(filter))
    .on('data', function(chunk) {
      found = Buffer.concat([found, chunk]);
    })
    .on('end', function() {
      assert.deepEqual(found, expected, 'created expected output file');
      assert.end();
    });
});

test('[filter] cli filters', function(assert) {
  var found = new Buffer(0);
  var outputFile = path.join(os.tmpdir(), crypto.randomBytes(4).toString('hex'));
  var proc = exec([cmd, infile, filter, '>', outputFile].join(' '));
  proc.stderr.pipe(process.stderr);

  proc.on('close', function() {
    fs.readFile(outputFile, function(err, found) {
      assert.deepEqual(found, expected, 'created expected output file');
      assert.end();
    });
  });
});
