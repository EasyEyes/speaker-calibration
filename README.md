# [WIP] Speaker-Calibration
Use your iOS device to measure your computer loudspeaker output.

[![Netlify Status](https://api.netlify.com/api/v1/badges/4662ab8c-dd4f-43ce-8e2d-add7a406300a/deploy-status)](https://app.netlify.com/sites/focused-hodgkin-0a6531/deploys)

# Contribution Guidelines
*As of 02/04/2022*

## Initial Setup

1. Clone this repository locally 
2. In the root of the repository run `npm i` to install the dependencies listed in `package.json`

## Local Development

In `package.json` you will see two key scripts:
-  `build:watch` tells webpack to build the `speakerCalibrator` library and output to `/dist`
-  `start:dev` spins up an `express.js` server on port `3000` using `nodemon`

Run both scripts (in seperate windows), with this setup you will be able to modify both the library and front end examples with hot reload built in

## Deployment

Changes publshed to `main` will automatically trigger a deploy on the `netlify` project


