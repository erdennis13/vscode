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

    try {
      await exec(`curl -s \"${blobUrl}\" | tar xz -C "${resolvedDestinationPath}"`);
      return true;
    } catch (err) {
      console.log(err);
    }
  }

  return false;
}

exports.uploadToCache = async function (hashSourcePath, artifactSourcePath) {
  const hash = await exports.hashFile(hashSourcePath);
  return await exports.uploadToCacheByHash(hash, artifactSourcePath);
}

exports.uploadToCacheByHash = async function (sourceHash, artifactSourcePath) {
  const isWin = process.platform === "win32";

  let resolvedSourcePath = path.resolve(artifactSourcePath);
  let sourceBasename = path.basename(resolvedSourcePath);
  let parentPath = path.join(resolvedSourcePath, '..');
  let tarballPath = path.join(parentPath, sourceHash + '.tar.gz');
  let originalTarballPath = tarballPath;
  let url = CACHE_URL + sourceHash;

  await stat(resolvedSourcePath); // ensure exists

  if (isWin) {
    resolvedSourcePath = '/' + resolvedSourcePath.replace(":", "").replace(/\\/g, "/");
    sourceBasename = sourceBasename.replace(":", "").replace(/\\/g, "/");
    parentPath = '/' + parentPath.replace(":", "").replace(/\\/g, "/");
    tarballPath = '/' + tarballPath.replace(":", "").replace(/\\/g, "/");
  }

  // catch and ignore exceptions from win symlink error
  try {
    await exec(`tar -C "${parentPath}" -czf "${tarballPath}" "${sourceBasename}"`);
  } catch (err) {
    console.log(err);
  }

  await exec(`curl -X PUT -H "Content-Type: multipart/form-data" -F "file=@${originalTarballPath}" "${url}"`);
  await exec(`rm -rf ${tarballPath}`);
}

exports.hashFile = async function (hashSourcePath) {
  const resolvedSourcePath = path.resolve(hashSourcePath);
  let fileContents = await readFile(resolvedSourcePath, 'utf8');
  fileContents = fileContents.replace(/(\r|\n)/gm, "");
  return crypto.createHash('sha256').update(fileContents).digest('hex') + "-" + process.platform;
}
