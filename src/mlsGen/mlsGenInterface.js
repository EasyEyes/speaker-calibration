/* eslint-disable prefer-destructuring */
/* eslint-disable dot-notation */
// eslint-disable-next-line import/extensions
const createMLSGenModule = require('../../dist/mlsGen.js');

/**
 * MLSGenInterface provides a class for interfacing with the MLSGen WASM module.
 */
class MlsGenInterface {
  /** @private */
  static N = 18;

  /** @private */
  #WASMInstance; // the WASM module instance

  /** @private */
  #MLSGenInstance; // the MLSGen object instance

  /**
   * Creates an instance of MlsGenInterface.
   * Makes a call to the WASM glue code to load the WASM module.
   */
  constructor(WASMInstance) {
    this.#WASMInstance = WASMInstance;
    console.warn('initializing MLSGen, need to manually garbage collect');
    this.#MLSGenInstance = new this.#WASMInstance['MLSGen'](MlsGenInterface.N);
  }

  /**
   * Factory function that provide an asynchronous function that fetches the WASM module
   * and returns a promise that resolves when the module is loaded.
   * @returns {MlsGenInterface} mlsGenInterface
   */
  static factory = async () =>
    new MlsGenInterface(await createMLSGenModule().then(instance => instance));

  /**
   * A Higher-Order function that takes an async callback function that access the MLSGen object,
   * providing safe garbage collection.
   * @param {function} func
   * @param {array} args
   */
  withGarbageCollection = async (func, params) => {
    try {
      await func(...params);
    } catch (error) {
      console.error(error);
    } finally {
      // garbage collect
      if (
        this !== undefined &&
        this !== null &&
        this.#MLSGenInstance !== undefined &&
        this.#MLSGenInstance !== null
      ) {
        this.#MLSGenInstance.delete();
        console.warn(`GARBAGE COLLECTION: deleted MLSGen`);
      }
    }
  };

  /**
   * Calculate and return the Impulse Response of the recorded signal.
   * @returns 
   */
  getImpulseResponse = () => this.#MLSGenInstance['getImpulseResponse']();

  /**
   * Given a recorded MLS signal, this function sets the recordedSignal property of the MLSGen object.
   * @param {Float32Array} signal
   */
  setRecordedSignal = (
    signal = [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1,
    ]
  ) => {
    // get memory view
    const recordedSignalMemoryView = this.#MLSGenInstance['getRecordedSignalMemoryView']();

    // iterate and set
    for (let i = 0; i < signal.length; i += 1) {
      recordedSignalMemoryView[i] = signal[i];
    }
  };

  /**
   * Calculate the Maximum Length Sequence (MLS) with period P = 2^N - 1
   * using the MLSGen WASM module.
   */
  getMLS = () => this.#MLSGenInstance['getMLS']();
}

export default MlsGenInterface;

/*
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
*/
