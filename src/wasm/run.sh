#!/bin/sh
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BLUE="\033[0;34m"
NC='\033[0m'

src_dir="/Users/hugo/Desktop/dev/easyeyes/speaker-calibration/src/wasm"
build_dir="/Users/hugo/Desktop/dev/easyeyes/speaker-calibration/src/wasm/build"
test_dir="test"

cd build;
rm -rf *;
cd ..;
em++ -std=c++11 mlsGen.cpp -o mlsGen.wasm -s STANDALONE_WASM -O2 -s ENVIRONMENT='web' --no-entry;
sudo cp mlsGen.wasm /build;
#em++ -std=c++17 mlsGen.cpp -s WASM=1 -s SIDE_MODULE=1 -s BINARYEN_ASYNC_COMPILATION=0 -o mleGen.wasm