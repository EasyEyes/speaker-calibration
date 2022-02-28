// eslint-disable-next-line import/extensions
const createMLSGenModule = require("../../dist/mlsGen.js");

class MlsGenInterface {
  /** @private */
  #wasmInstance;

  /** @private */
  #mls;

  constructor() {
    createMLSGenModule().then((instance) => {
      this.#wasmInstance = instance;
      console.log(instance);
    });
  }

  getMls() {
    // Get function.
    const { _getMls, HEAPU8 } = this.#wasmInstance;

    // Create the arrays.
    // TODO: work around, make this a parameter to the function.
    const length = 262143; // (1 << 18) - 1 from cpp code

    const offset = 0;
    const result = new Uint8Array(HEAPU8.buffer, offset, length);

    // Call the function.
    _getMls(result.byteOffset);

    // save the result.
    this.#mls = result;

    console.log(result);

    // return the result.
    return result;
  }
}

export default MlsGenInterface;
