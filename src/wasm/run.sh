#!/bin/sh
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BLUE="\033[0;34m"
NC='\033[0m'

src_dir="/Users/hugo/Desktop/dev/easyeyes/speaker-calibration/src/wasm"
build_dir="./build"
test_dir="./test"

cd $src_dir; cd $build_dir; make