/* eslint-disable prefer-destructuring */
/* eslint-disable dot-notation */
// eslint-disable-next-line import/extensions
const createMLSGenModule = require('../../../../dist/mlsGen.js');

/**
 * MLSGenInterface provides a class for interfacing with the MLSGen WASM module.
 */
class MlsGenInterface {
  /** @private */
  #mlsOrder;

  /** @private */
  #WASMInstance; // the WASM module instance

  /** @private */
  #MLSGenInstance; // the MLSGen object instance

  /**
   * Creates an instance of MlsGenInterface.
   * Makes a call to the WASM glue code to load the WASM module.
   */
  constructor(WASMInstance, mlsOrder, sourceSamplingRate, sinkSamplingRate) {
    this.#mlsOrder = mlsOrder;
    this.#WASMInstance = WASMInstance;

    console.warn('initializing MLSGen, need to manually garbage collect');
    this.#MLSGenInstance = new this.#WASMInstance['MLSGen'](
      mlsOrder,
      sourceSamplingRate,
      sinkSamplingRate
    );
  }

  /**
   * Factory function that provide an asynchronous function that fetches the WASM module
   * and returns a promise that resolves when the module is loaded.
   * @param {number} sourceSamplingRate - The sampling rate of the source audio.
   * @param {number} sinkSamplingRate - The sampling rate of the sink audio.
   * @returns {MlsGenInterface} mlsGenInterface
   */
  static factory = async (mlsOrder, sourceSamplingRate, sinkSamplingRate) => {
    if (sourceSamplingRate === undefined || sinkSamplingRate === undefined) {
      throw new Error('sourceSamplingRate and sinkSamplingRate must be defined');
    }
    return new MlsGenInterface(
      await createMLSGenModule().then(instance => instance),
      mlsOrder,
      sourceSamplingRate,
      sinkSamplingRate
    );
  };

  /**
   * A Higher-Order function that takes an async callback function that access the MLSGen object,
   * providing safe garbage collection.
   * @param {function} func
   * @param {array} args
   */
  withGarbageCollection = async funcsWithParams => {
    try {
      for (let i = 0; i < funcsWithParams.length; i += 1) {
        const [func, params] = funcsWithParams[i];
        await func(...params);
      }
      // await func(...params);
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
        this.#MLSGenInstance['Destruct'](); // Call the destructor
        this.#MLSGenInstance['delete'](); // Delete the object
        console.warn(`GARBAGE COLLECTION: deleted MLSGen`);
        this.#WASMInstance['doLeakCheck'](); // Check for memory leaks
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
   * @param {Float32Array} signals
   */
  setRecordedSignals = signals => {
    // get memory view
    const averagedSignals = this.average(signals);
    const recordedSignalsMemoryView = this.#MLSGenInstance['setRecordedSignalsMemoryView'](
      averagedSignals.byteLength
    );
    for (let i = 0; i < averagedSignals.length; i++) {
      recordedSignalsMemoryView[i] = averagedSignals[i];
    }
  };

  /**
   * Calculate the Maximum Length Sequence (MLS) with period P = 2^N - 1
   * using the MLSGen WASM module.
   */
  getMLS = () => this.#MLSGenInstance['getMLS']();
}

export default MlsGenInterface;
