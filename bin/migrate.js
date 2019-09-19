#!/usr/bin/env node

var args = require('minimist')(process.argv.slice(2));
var migration = require('..');
var path = require('path');
var fs = require('fs');

function usage() {
  console.error('');
  console.error('Usage: dynamodb-migrate <method> <database> <script>');
  console.error('');
  console.error('method: either scan or stream to read records from the database or from stdin, respectively');
  console.error('database: region/name of the database to work against');
  console.error('script: relative path to a migration script');
  console.error('');
  console.error('Options:');
  console.error(' - concurrency [1]: number of records to process in parallel');
  console.error(' - live [false]: if not specified, the migration script will not receive a database reference');
  console.error(' - dyno [false]: if not specified, it is assumed that the objects are formatted using standard DynamoDB syntax. Pass the `--dyno` flag to the migrator if your input JSON objects are in a format suitable for direct usage in dyno (https://github.com/mapbox/dyno)');
  console.error(' - rate [false]: log information about the rate at which migration is running. Will interfere with a migration script\'s logs');
}

if (args.help) {
  usage();
  process.exit(0);
}

var method = args._[0];
if (['scan', 'stream'].indexOf(method) < 0) {
  console.error('Error: method must be one of scan, stream');
  usage();
  process.exit(1);
}

var database = args._[1];
if (!database) {
  console.error('Error: must specify region/database to work against');
  usage();
  process.exit(1);
}
var script = path.resolve(process.cwd(), args._[2] || '');
if (!fs.existsSync(script)) {
  console.error('Error: invalid migration script path');
  usage();
  process.exit(1);
}

var migrate = require(script);

var options = {
  method: method,
  database: database,
  migrate: migrate,
  live: args.live,
  plainJSON: args.dyno,
  concurrency: args.concurrency || 1,
  rateLogging: args.rate
};

migration(options, function(err) {
  if (err) {
    throw err;
  }
});
