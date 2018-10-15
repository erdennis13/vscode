#!/usr/bin/env node

const cache = require('./index.js');
const fs = require('fs');
const pkg = require('./package.json');

const [, , ...args] = process.argv;

let cmd;
let target;
let hash;
let file;
let sas;

for (let i = 0; i < args.length; i++) {
  let a = args[i];
  switch (a) {
    case 'help':
      cmd = runHelp;
      break;
    case 'cache':
      cmd = runCache;
      break;
    case 'retrieve':
      cmd = runRetrieve;
      break;
    case '-h':
      hash = args[++i];
      break;
    case '-f':
      file = args[++i];
      break;
    case '-sas':
      sas = args[++i];
      break;
    default:
      if (!cmd) {
        fail(`Invalid command "${a}"`);
      } else if (target) {
        fail(`Invalid argument "${a}"`);
      } else {
        target = a;
      }
      break;
  }
}

target = target || process.cwd();
cmd = cmd || runHelp;

if ((cmd !== runHelp) && (!(hash || file) || (hash && file))) {
  // if not help command and (neither defined or both defined)
  fail('Must specify hash key (-h) or file to hash (-f)');
}

cmd();

function runCache() {
  if (!fs.existsSync(target)) {
    fail('Source path does not exist');
  }

  if (hash) {
    cache.uploadToCacheByHash(hash, target);
  } else if (file) {
    cache.uploadToCache(file, target);
  }
}

function runRetrieve() {
  if (!fs.existsSync(target)) {
    fail('Destination path does not exist');
  }

  if (!sas && !process.env.BLOBCACHEACCESSKEY) {
    fail('Must provide a shared access signature (-sas) or set the BLOBCACHEACCESSKEY environment variable');
  }

  let success;
  if (hash) {
    success = cache.downloadFromCacheByHash(hash, target, sas);
  } else if (file) {
    success = cache.downloadFromCache(file, target, sas);
  }

  if (!success) {
    console.error('Cache miss');
  }
}

function runHelp() {
  console.log(`${pkg.name} ${pkg.version}`);
  console.log(`usage:
    upload:      cache [source path] [-h <hash key>] [-f <file to hash>]
    download:    retrieve [destination path] [-h <hash key>] [-f <file to hash>] [-sas <token>]`
  );
}

function fail(message) {
  console.log(message);
  process.exit(1);
}
