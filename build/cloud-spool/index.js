const cp = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const util = require('util');

const exec = util.promisify(cp.exec);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);

const CACHE_URL = 'https://cloudspool-dev.azurewebsites.net/api/vscodeyarncache/';

exports.downloadFromCache = async function (hashSourcePath, artifactDestinationPath, sas) {
  const hash = await exports.hashFile(hashSourcePath);
  return await exports.downloadFromCacheByHash(hash, artifactDestinationPath, sas);
}

exports.downloadFromCacheByHash = async function (sourceHash, artifactDestinationPath, sas) {
  const isWin = process.platform === "win32";
  let resolvedDestinationPath = path.resolve(artifactDestinationPath);

  if (isWin) {
    resolvedDestinationPath = '/' + resolvedDestinationPath.replace(":", "").replace(/\\/g, "/");
  }

  if (isWin) {
    await stat(artifactDestinationPath); // ensure exists
  } else {
    await stat(resolvedDestinationPath); // ensure exists
  }

  const url = CACHE_URL + sourceHash;
  const { stdout: response } = await exec(`curl "${url}"`, { stdio: 'inherit' });

  if (response) {
    sas = sas || process.env.BLOBCACHEACCESSKEY;
    if (!sas) {
      throw new Error('SAS not provided and BLOBCACHEACCESSKEY environment variable not set');
    }

    const blobUrl = JSON.parse(response) + sas;

    const { stdout, stderr } = await exec(`curl -s \"${blobUrl}\" | tar xz -C "${resolvedDestinationPath}"`, { stdio: 'inherit' });
    if (stderr) {
      console.log(`error: ${stderr}`);
      return false;
    }
    console.log(stdout);
    return true;
  }

  return false;
}

exports.uploadToCache = async function (hashSourcePath, artifactSourcePath) {
  const hash = await exports.hashFile(hashSourcePath);
  return await exports.uploadToCacheByHash(hash, artifactSourcePath);
}

exports.uploadToCacheByHash = async function (sourceHash, artifactSourcePath) {
  const isWin = process.platform === "win32";

  const originalSourcePath = path.resolve(artifactSourcePath);
  let resolvedSourcePath = path.resolve(artifactSourcePath);
  let sourceBasename = path.basename(resolvedSourcePath);
  let parentPath = path.join(resolvedSourcePath, '..');
  let tarballPath = path.join(parentPath, sourceHash + '.tar.gz');
  let originalTarballPath = tarballPath;
  let url = CACHE_URL + sourceHash;

  // await stat(resolvedSourcePath); // ensure exists

  if (isWin) {
    resolvedSourcePath = '/' + resolvedSourcePath.replace(":", "").replace(/\\/g, "/");
    sourceBasename = sourceBasename.replace(":", "").replace(/\\/g, "/");
    parentPath = '/' + parentPath.replace(":", "").replace(/\\/g, "/");
    tarballPath = '/' + tarballPath.replace(":", "").replace(/\\/g, "/");
  }

  if (fs.existsSync(originalSourcePath)) {
    console.log('uploading cache');
    cp.execSync(`tar -czf "${tarballPath}" -C "${parentPath}" "${sourceBasename}"`);
    cp.execSync(`curl -X PUT -H "Content-Type: multipart/form-data" -F "file=@${originalTarballPath}" "${url}"`)
    cp.execSync(`rm -rf ${tarballPath}`);
    return true;
  }
  console.log('skipped uploading cache');
  return false;
  // let { stdout, stderr } = await exec(`tar -czf "${tarballPath}" -C "${parentPath}" "${sourceBasename}"`, { stdio: 'inherit' });
  // if (stderr) {
  //   console.error(`${stderr}`);
  // }
  // if (stdout) {
  //   console.log(`${stdout}`);
  // }
  // let { stdout2, stderr2 } = await exec(`curl -X PUT -H "Content-Type: multipart/form-data" -F "file=@${originalTarballPath}" "${url}"`, { stdio: 'inherit' });
  // if (stderr2) {
  //   console.error(`error: ${stderr2}`);
  // }
  // console.log(`${stdout2}`);
  // await exec(`rm -rf ${tarballPath}`);
}

exports.hashFile = async function (hashSourcePath) {
  const resolvedSourcePath = path.resolve(hashSourcePath);
  let fileContents = await readFile(resolvedSourcePath, 'utf8');
  fileContents = fileContents.replace(/(\r|\n)/gm, "");
  return crypto.createHash('sha256').update(fileContents).digest('hex') + "-" + process.platform;
}
