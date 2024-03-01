#!/bin/bash
#

set -e


# Modify this  script to your liking using the scripts found under src/***.ts

echo 'Starting Base-Setup'
node base.js

echo 'Setting IP->SDI'
SDI_INDEX=0 node ip_sdi.js
SDI_INDEX=1 node ip_sdi.js
SDI_INDEX=2 node ip_sdi.js
SDI_INDEX=3 node ip_sdi.js
SDI_INDEX=4 node ip_sdi.js

echo 'Setting SDI->IP'
SDI_INDEX=0 node sdi_ip.js
SDI_INDEX=1 node sdi_ip.js
SDI_INDEX=2 node sdi_ip.js
SDI_INDEX=3 node sdi_ip.js
SDI_INDEX=4 node sdi_ip.js
