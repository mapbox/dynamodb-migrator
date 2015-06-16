#!/usr/bin/env node

var stream = require('stream');
var fs = require('fs');
var path = require('path');
var split = require('split');
var zlib = require('zlib');

module.exports = filter;

function filter(inFile, filterFn) {
  var reader = fs.createReadStream(inFile).pipe(zlib.createGunzip());
  var filterer = new stream.Transform();

  filterer._transform = function(line, enc, callback) {
    if (filterFn(line.toString())) filterer.push(line + '\n');
    setImmediate(callback);
  };

  return reader.pipe(split()).pipe(filterer).pipe(zlib.createGzip());
}

if (require.main === module) {
  var args = require('minimist')(process.argv.slice(2));

  var inFile = args._[0];
  if (!inFile) {
    console.error('You must provide an input filepath');
    process.exit(1);
  }

  inFile = path.resolve(inFile);
  if (!fs.existsSync(inFile)) {
    console.error('Input file %s does not exist', inFile);
    process.exit(1);
  }

  var filterFn = args._[1];
  if (!filterFn) {
    console.error('You must provide the path to a filter function');
    process.exit(1);
  }

  filterFn = require(path.resolve(filterFn));

  var outputStream = process.stdout;

  if (args.output) {
    var outFile = path.resolve(args.output);
    if (fs.existsSync(outFile)) {
      console.error('Output file %s already exists', outFile);
      process.exit(1);
    }

    outputStream = fs.createWriteStream(outFile);
  }

  var pipeline = filter(inFile, filterFn)
      .on('error', function(err) {
        console.error(err);
        process.exit(1);
      })
    .pipe(outputStream)
      .on('error', function(err) {
        console.error(err);
        process.exit(1);
      });

  if (args.output) pipeline.on('finish', function() {
    console.log('Finished writing to %s', outFile);
  });
}
