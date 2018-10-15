const cp = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_URL = 'https://cloudspool-dev.azurewebsites.net/api/vscodeyarncache/';

exports.downloadFromCache = function (hashSourcePath, artifactDestinationPath, sas) {
  const hash = exports.hashFile(hashSourcePath);
  return exports.downloadFromCacheByHash(hash, artifactDestinationPath, sas);
}

exports.downloadFromCacheByHash = function (sourceHash, artifactDestinationPath, sas) {
  const isWin = process.platform === "win32";
  let resolvedDestinationPath = path.resolve(artifactDestinationPath);

  if (isWin) {
    resolvedDestinationPath = '/' + resolvedDestinationPath.replace(":", "").replace(/\\/g, "/");
  }

  if (isWin) {
    if (!fs.existsSync(artifactDestinationPath)) {
      throw new Error(`path does not exist ${artifactDestinationPath}`);
    }
  } else {
    if (!fs.existsSync(resolvedDestinationPath)) {
      throw new Error(`path does not exist ${resolvedDestinationPath}`);
    }
  }

  const url = CACHE_URL + sourceHash;
  const response = cp.execSync(`curl "${url}"`).toString();

  if (response) {
    sas = sas || process.env.BLOBCACHEACCESSKEY;
    if (!sas) {
      throw new Error('SAS not provided and BLOBCACHEACCESSKEY environment variable not set');
    }

    const blobUrl = JSON.parse(response) + sas;

    cp.execSync(`curl -s "${blobUrl}" | tar xz -C "${resolvedDestinationPath}"`);
    return true;
  }

  return false;
}

exports.uploadToCache = function (hashSourcePath, artifactSourcePath) {
  const hash = exports.hashFile(hashSourcePath);
  return exports.uploadToCacheByHash(hash, artifactSourcePath);
}

exports.uploadToCacheByHash = function (sourceHash, artifactSourcePath) {
  const isWin = process.platform === "win32";

  const originalSourcePath = path.resolve(artifactSourcePath);
  let resolvedSourcePath = path.resolve(artifactSourcePath);
  let sourceBasename = path.basename(resolvedSourcePath);
  let parentPath = path.join(resolvedSourcePath, '..');
  let tarballPath = path.join(parentPath, sourceHash + '.tar.gz');
  let originalTarballPath = tarballPath;
  let url = CACHE_URL + sourceHash;

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
}

exports.hashFile = function (hashSourcePath) {
  const resolvedSourcePath = path.resolve(hashSourcePath);
  let fileContents = fs.readFileSync(resolvedSourcePath, 'utf8');
  fileContents = fileContents.replace(/(\r|\n)/gm, "");
  return crypto.createHash('sha256').update(fileContents).digest('hex') + "-" + process.platform;
}
