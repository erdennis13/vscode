#!/usr/bin/env bash

yarn () {
	if [[ $@ == "install" ]]; then
		command yarn install --pre-fetch-script "node $BUILD_SOURCESDIRECTORY/build/cloud-spool/cli.js retrieve -f ./yarn.lock" --post-install-script "node $BUILD_SOURCESDIRECTORY/build/cloud-spool/cli.js cache ./node_modules -f ./yarn.lock"
	else
		command yarn "@a"
	fi
}