/* eslint-disable dot-notation */
// eslint-disable-next-line import/extensions
const createMLSGenModule = require('../../dist/mlsGen.js');

/**
 * MLSGenInterface provides a class for interfacing with the MLSGen WASM module.
 */
class MlsGenInterface {
  /** @private */
  #N = 18;

  /** @private */
  // eslint-disable-next-line no-bitwise
  #P = (1 << 18) - 1;

  /** @private */
  #MLSGen;

  /** @private */
  #WASMInstance;

  /** @private */
  #MlsSignal;

  /** @private */
  #initializationPromise;

  /**
   * Creates an instance of MlsGenInterface.
   * Makes a call to the WASM glue code to load the WASM module.
   */
  constructor(WASMInstance) {
    this.#WASMInstance = WASMInstance;
  }

  /**
   * Factory function that provide an asynchronous function that fetches the WASM module
   * and returns a promise that resolves when the module is loaded.
   * @returns {MlsGenInterface} mlsGenInterface
   */
  static factory = async () =>
    new MlsGenInterface(await createMLSGenModule().then(instance => instance));

  // const mlsGenInterface = new MlsGenInterface();
  // await mlsGenInterface.initialize();

  // #doInitialize = async () => {
  //   this.#WASMInstance = ;
  //   console.log({WASMInstance: this.#WASMInstance});
  // };

  // initialize = async () => {
  //   // prevent concurrent calls firing initialization more than once
  //   if (!this.#initializationPromise) {
  //     this.#initializationPromise = this.#doInitialize();
  //   }
  //   return this.initializationPromise;
  // };

  /**
   * Calculate the Maximum Length Sequence (MLS) with period P = 2^N - 1
   * using the MLSGen WASM module.
   */
  getMls = () => {
    let shallowCopy;
    try {
      this.#MLSGen = new this.#WASMInstance['MLSGen'](this.#N);
      this.#MLSGen['generateMls']();
      shallowCopy = [...this.#MLSGen['getGeneratedSignal']()];
    } catch (error) {
      console.error(error);
    } finally {
      this.#MLSGen.delete();
    }
    return shallowCopy;
  };
}

export default MlsGenInterface;
