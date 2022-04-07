# Speaker-Calibration

_As of 04/06/2022_

## Initial Setup

1. `git clone https://github.com/EasyEyes/speaker-calibration.git`
2. `cd speaker-calibration`
3. `npm i`

## Local Development

All outputs from the scripts/recipies below should be automatically placed in the `/dist` directory.

### Javascript
In `package.json` you will see some key scripts:

1.  `build:prod` - tells webpack to build the library for production.
2.  `build:dev` tells webpack to build the `speaker-calibration` library in development watch mode,
    outputing to `/dist`
3.  `build:wasm` cleans and rebuilds the wasm files
4.  `lint` runs `eslint` on all js files in the project
5.  `lint:fix` lints and automatically fixes all js files in the project.
6.  `build:doc` builds the documentation using `jsdoc`. Outputs to `/doc`
7.  `test` runs all tests in the project.

### CPP/WASM

We are using [Emscripten](https://emscripten.org/) to compile the C++ code into a wasm file. Usage
requires the installation of the Emscriten compiler. Instructions can be found on their website. In
`makefile` you will see a few recipies:

- `mlsGen_bind` compiles the cpp files to wasm, generating a modularized javascript "glue" file,
  using embind. This is the current build target
- `mlsGen_module` compiles the cpp files to wasm, generating a modularized javascript "glue" file.
- `mlsGen_wasm` compiles the cpp file to a stand-alone wasm without a javascript "clue" file.
- `clean` cleans up and generated code
- `rebuild` cleans and rebuilds the output. Run this after making changes to the cpp files.

### Documentation

We use [jsdoc](https://jsdoc.app/) standards to document our library.

### Linting

We use [ESLint](https://eslint.org/) to lint our code and enforce best practices. We are currently
using [AirBnB's JavaScript Style Guide](https://airbnb.io/javascript/)

### Styling

We use [Prettier](https://prettier.io/) to format our code.
