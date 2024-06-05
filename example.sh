#!/bin/bash
set -e

export NMOS_REGISTRY=http://172.16.0.53:30010
export URL_BLADE=http://172.16.210.107
export PTP_DOMAIN=127
export PTP_MODE=SlaveOnly
export PTP_RESPONSE_TYPE=Unicast
export NUM_SDI_OUT=1
export NUM_AUDIO=4
export DATA_DIR=./key/
export NUM_AUDIO=4
export LUT_DIR=./luts/
export SHIFT_BY=12ns

npm install
npx tsc

node build/base.js

SDI_INDEX=0 node build/ip-sdi.js
SDI_INDEX=1 node build/sdi-ip.js
BACKUP_CONFIG=./redundancy_config.example.json node build/monitor.js

echo 'Finished! Exiting...'
