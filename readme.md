# dynamodb-migrator

[![Build Status](https://travis-ci.org/mapbox/dynamodb-migrator.svg?branch=master)](https://travis-ci.org/mapbox/dynamodb-migrator)

For migration and cleanup operations on your DynamoDB table

## Usage

### Write a migration script

Write a module that exports a function that will run over each record in your table. Optionally, you may also define a `finish` routine that will be executed once the table migration is complete. Here's an example:

```js
var deleted = 0;

module.exports = function(record, dyno, logger, callback) {
  if (record.flag !== 'delete-me') return callback();

  // Use the logger object to both console.log and also capture logs to a file
  logger.info('%s flagged for deletion', record.id);

  // If you are running a dry-run, `dyno` will be null
  if (!dyno) return callback();

  dyno.deleteItem({ id: record.id }, function(err) {
    if (err) {
      logger.error('%s failed to delete', record.id);

      // Sending an error to the callback function will stop the migration
      return callback(new Error('A record failed to delete'));
    }

    deleted++;
    callback();
  });
}

module.exports.finish = function(dyno, logger, callback) {
  logger.info('Deleted %s records', deleted);
  callback();
}
```

### Decide on stream vs. scan mode

Streaming mode is where you feed records into your migration script from a file. This is useful for testing your migration based on a backup from your database, or if you know you have a small subset of records that you want your migration to impact. This file is consist of line-delimited JSON strings.

Scan mode is where the database is scanned and your migration script will be fed each record in the database.

### Do you need to prefilter?

If you're running in stream mode from something like a prior database dump, you may want to prefilter your dump so that it only includes records you're interested in. `dynamodb-filter` is provided for you to help do this.

1. Write a filter function. It will be passed one argument: a single line (as a string) from the original file. The function is expected to return `true/false` indicating whether or not that line should be written into your filtered output. It should be written into a Node.js module as the module's `exports`, i.e.

    ```js
    module.exports = function(line) {
      // I only care about ham.
      return line.indexOf('ham') > -1;
    };
    ```

2. Run `dynamodb-filter`:

```sh
# dynamodb-filter <input file path> <filter function path> [--output <output file path>]
$ dynamodb-filter ./some-dump.gz ./my-script.js > ./some-filtered-dump.gz
$ dynamodb-filter ./some-dump.gz ./my-script.js --output ./some-filtered-dump.gz
```

### Write to a kinesis stream

` --stream region/streamName/key`

To write records to a kinesis stream for replication, `--stream` may be passed as an option. `region`, `stream name`, and `key` should be given as `/`-separated arguments in that order. `key` may contain multiple properties, separated by a comma (e.g. `region/streamName/id,collection`).

### Specify type of JSON

Pass the `--dyno` flag to the migrator if your input JSON objects are in a format suitable for direct usage in [dyno](https://github.com/mapbox/dyno). Otherwise, it is assumed that the objects are formatted using standard DynamoDB syntax.


### Do a dry-run

Run your migration without impacting any records to check that your conditions are filtering as you expect them to. Remember that your migration script *will not* receive a dyno object in this case.

```
$ dynamodb-migrate scan us-east-1/my-table ./my-migration-script.js
```

When the migration is complete, it will print the paths to your info and error logs.

### Do it for real

Specify the `--live` flag to run the migration once and for all.

```
$ dynamodb-migrate scan us-east-1/my-table ./my-migration-script.js --live
```


## Help

```
Usage: dynamodb-migrate <method> <database> <script>

method: either scan or stream to read records from the database or from stdin, respectively
database: region/name of the database to work against
script: relative path to a migration script

Options:
 - stream: region/name/key specifying region, name and keys (keys may be comma separated for multiple properties) for replication kinesis stream
 - concurrency [1]: number of records to process in parallel
 - live [false]: if not specified, the migration script will not receive a database reference
 - dyno [false]: if not specified, it is assumed that the objects are formatted using standard DynamoDB syntax. Pass the `--dyno` flag to the migrator if your input JSON objects are in a format suitable for direct usage in dyno (https://github.com/mapbox/dyno)
 ```
