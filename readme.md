# dynamodb-migrator

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
      // Errors are captured in a different file than info logs
      logger.error('%s failed to delete', record.id);

      // Sending an error to the callback function will stop the migration
      return callback(new Error('A record failed to delete'));
    }

    deleted++;
    callback();
  });
}

module.exports.finish = function(logger) {
  logger.info('Deleted %s records', deleted);
}
```

### Decide on stream vs. scan mode

Streaming mode is where you feed records into your migration script from a file. This is useful for testing your migration based on a backup from your database, or if you know you have a small subset of records that you want your migration to impact. This file is consist of line-delimited JSON strings.

Scan mode is where the database is scanned and your migration script will be fed each record in the database.

### Do a dry-run

Run your migration without impacting any records to check that your conditions are filtering as you expect them to. Remember that your migration script *will not* receive a dyno object in this case.

```
$ migrate scan us-east-1/my-table ./my-migration-script.js
```

When the migration is complete, it will print the paths to your info and error logs.

### Do it for real

Specify the `--live` flag to run the migration once and for all.

```
$ migrate scan us-east-1/my-table ./my-migration-script.js --live
```

## Help

```
Usage: migrate <method> <database> <script>

method: either scan or stream to read records from the database or from stdin, respectively
database: region/name of the database to work against
script: relative path to a migration script

Options:
 - concurrency [1]: number of records to process in parallel
 - live [false]: if not specified, the migration script will not receive a database reference
 ```
