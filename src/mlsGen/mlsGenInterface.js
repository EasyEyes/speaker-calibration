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

  calculateMls(N = 18) {
    // Get function.
    const { _getMls, HEAPU8 } = this.#wasmInstance;

    // Create the arrays.
    // eslint-disable-next-line no-bitwise
    const P = (1 << N) - 1; 
    const offset = 0;
    const result = new Uint8Array(HEAPU8.buffer, offset, P);

    // Call the function.
    _getMls(result.byteOffset, N, P);

    // save the result.
    this.#mls = result;
  }

  getMls() {
    if(!this.#mls) {
      this.calculateMls()
    }
    return this.#mls;
  }
}

export default MlsGenInterface;
