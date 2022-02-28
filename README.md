# [WIP] Speaker-Calibration
Use your iOS device to measure your computer loudspeaker output.

[![Netlify Status](https://api.netlify.com/api/v1/badges/4662ab8c-dd4f-43ce-8e2d-add7a406300a/deploy-status)](https://app.netlify.com/sites/focused-hodgkin-0a6531/deploys)

# Contribution Guidelines
*As of 02/25/2022*

## Initial Setup

1. Clone this repository locally 
2. In the root of the repository run `npm i` to install the dependencies listed in `package.json`

## Development
All outputs from the scripts/recipies below should be placed in the root `dist` folder. This is what will be made available in the deployed env

### Javascript 
In `package.json` you will see two (2) key scripts:
-  `build:webpack` tells webpack to build the `speakerCalibrator` library and output to `/dist`
-  `start:dev` spins up an `express.js` server on port `3000` using `nodemon`

Run both scripts (in seperate shell windows), with this setup you will be able to modify both the library and front end examples with hot reload built in

### CPP/WASM
In `makefile` you will see four (4) recipies:
- `mlsGen_module` compiles the cpp files to wasm, generating a modularized javascript "glue" file. This is the current build target
- `mlsGen_wasm` compiles the cpp file to a stand-alone wasm without a javascript "clue" file. 
- `clean` cleans up and generated code
- `rebuild` cleans and rebuilds the output

## Deployment

Changes publshed to `main` will automatically trigger a deploy on the `netlify` project


