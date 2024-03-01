#!/bin/bash
#
# NOTE: Make sure to point to the right Docker-Image
set -e 


URL_BLADE="$1"
CSV_PATH="$2"

if [ -z "$URL_BLADE" ]; then
  echo "Please provide a valid URL"
  exit 1
fi
if [ -z "$CSV_PATH" ]; then
  echo "Please provide a path to your addresses.csv file"
  exit 1
fi


docker run -it --rm -e URL_BLADE=$URL_BLADE -v $(realpath $CSV_PATH):/app/addresses.csv addresses:latest 
exit 0;
