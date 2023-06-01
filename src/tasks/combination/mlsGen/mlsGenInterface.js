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
   *
   * @param WASMInstance
   * @param mlsOrder
   * @param sourceSamplingRate
   * @param sinkSamplingRate
   * @example
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
   *
   * @param mlsOrder
   * @param sourceSamplingRate - The sampling rate of the source audio.
   * @param sinkSamplingRate - The sampling rate of the sink audio.
   * @returns MlsGenInterface.
   * @example
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
   *
   * @param func
   * @param args
   * @param funcsWithParams
   * @example
   */
  withGarbageCollection = async funcsWithParams => {
    try {
      for (let i = 0; i < funcsWithParams.length; i += 1) {
        const funcWithParams = funcsWithParams[i];
        // eslint-disable-next-line no-await-in-loop
        await funcWithParams();
      }
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
   *
   * @returns
   * @example
   */
  getImpulseResponse = () => this.#MLSGenInstance['getImpulseResponse']();

  /**
   * Given a recorded MLS signal, this function sets the recordedSignal property of the MLSGen object.
   *
   * @param signals
   * @example
   */
  setRecordedSignals = signals => {
    // get memory view
    const averagedSignals = this.average(signals);
    const recordedSignalsMemoryView = this.#MLSGenInstance['setRecordedSignalsMemoryView'](
      averagedSignals.byteLength
    );
    for (let i = 0; i < averagedSignals.length; i += 1) {
      recordedSignalsMemoryView[i] = averagedSignals[i];
    }
  };

  /**
   * Calculate the Maximum Length Sequence (MLS) with period P = 2^N - 1
   * using the MLSGen WASM module.
   *
   * @example
   */
  getMLS = () => this.#MLSGenInstance['getMLS']();
}

export default MlsGenInterface;
