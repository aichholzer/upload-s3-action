const core = require('@actions/core');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs');
const path = require('path');
const shortid = require('shortid');
const slash = require('slash').default;
const klawSync = require('klaw-sync');
const { lookup } = require('mime-types');

const accessKeyId = core.getInput('aws_key_id', { required: true });
const secretAccessKey = core.getInput('aws_secret_access_key', { required: true });
const Bucket = core.getInput('aws_bucket', { required: true });
const SOURCE_DIR = core.getInput('source_dir', { required: true });
const DESTINATION_DIR = core.getInput('destination_dir', { required: false });
const endpoint = core.getInput('s3_endpoint', { required: false });
const ACL = core.getInput('acl', { required: false });

const s3 = new S3({
  accessKeyId,
  secretAccessKey,
  ...(endpoint && {
    endpoint
  })
});
const destinationDir = DESTINATION_DIR === '/' ? shortid() : DESTINATION_DIR;
const paths = klawSync(SOURCE_DIR, { nodir: true });

function upload(params) {
  return new Promise((resolve) => {
    s3.upload(params, (err, data) => {
      if (err) core.error(err);
      core.info(`uploaded - ${data.Key}`);
      core.info(`located - ${data.Location}`);
      resolve(data.Location);
    });
  });
}

function run() {
  const sourceDir = slash(path.join(process.cwd(), SOURCE_DIR));
  return Promise.all(
    paths.map((p) => {
      const Key = slash(path.join(destinationDir, slash(path.relative(sourceDir, p.path))));

      return upload({
        Key,
        Bucket,
        Body: fs.createReadStream(p.path),
        ContentType: lookup(p.path) || 'text/plain',
        ...(ACL && { ACL })
      });
    })
  );
}

run()
  .then((locations) => {
    core.info(`object key - ${destinationDir}`);
    core.info(`object locations - ${locations}`);
    core.setOutput('object_key', destinationDir);
    core.setOutput('object_locations', locations);
  })
  .catch((err) => {
    core.error(err);
    core.setFailed(err.message);
  });
