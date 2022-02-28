# [WIP] Speaker-Calibration
Use your iOS device to measure your computer loudspeaker output.

[![Netlify Status](https://api.netlify.com/api/v1/badges/4662ab8c-dd4f-43ce-8e2d-add7a406300a/deploy-status)](https://app.netlify.com/sites/focused-hodgkin-0a6531/deploys)

# Contribution Guidelines
*As of 02/25/2022*

## Initial Setup

1. `git clone https://github.com/EasyEyes/speaker-calibration.git`
2. `cd speaker-calibration`
3. `npm i`

## Local Development
All outputs from the scripts/recipies below should be automatically placed in the `/dist` directory. This is what will be served once the library is published.

### Example
In `/example` you will find a small example app that uses the `speaker-calibration` library. 

### Javascript 
In `package.json` you will see some key scripts:
1.  `build:wasm` cleans and rebuilds the wasm files
2.  `build:watch` tells webpack to build the `speaker-calibration` library in development watch mode, outputing to `/dist`
3.  `start:dev` spins up an `express.js` server on port `3000` using `nodemon`. It serves the `/dist` & `/example` folders.
4.  `lint` runs `eslint` on all js files in the project
5.  `lint:fix` lints and automatically fixes all js files in the project. 

Run `(1)` & `(2)` in seperate shell windows, with this setup you will be able to modify both the library and front end examples with hot reload built in. `(3)` provides a simple abstraction on the `makefile` recipies below. Run `(5)` precommit to keep you code standardized. 

TODO Make `(5)` a precommit hook

### CPP/WASM
In `makefile` you will see four (4) recipies:
- `mlsGen_module` compiles the cpp files to wasm, generating a modularized javascript "glue" file. This is the current build target
- `mlsGen_wasm` compiles the cpp file to a stand-alone wasm without a javascript "clue" file. 
- `clean` cleans up and generated code
- `rebuild` cleans and rebuilds the output. Run this after making changes to the cpp files.

## Deployment

Changes publshed to `main` will automatically trigger a deploy on the `netlify` project


