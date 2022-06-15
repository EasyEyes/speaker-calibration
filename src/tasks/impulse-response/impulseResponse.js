import AudioCalibrator from '../audioCalibrator';
import MlsGenInterface from './mlsGen/mlsGenInterface';

import {sleep, csvToArray} from '../../utils';

/**
 *
 */
class ImpulseResponse extends AudioCalibrator {
  /**
   *
   */
  constructor({download = false, numCalibrationRounds = 2, numCalibrationNodes = 3}) {
    super(numCalibrationRounds, numCalibrationNodes);
    this.#download = download;
  }

  /** @private */
  #download;

  /** @private */
  #mlsGenInterface;

  /** @private */
  #mlsBufferView;

  /** @private */
  invertedImpulseResponse = null;

  /** @private */
  // recordedSignals = [];

  /** @private */
  #P;

  #average = signals => {
    let smallest = signals[0].length;

    // find smallest
    for (let i = 0; i < signals.length; i += 1) {
      smallest = signals[0].length < signals[i].length ? signals[0].length : signals[i].length;
    }

    // truncate to smallest
    for (let i = 0; i < signals.length; i += 1) {
      signals[i] = signals[i].slice(0, smallest);
    }

    // average
    // for each index in array 0
    for (let i = 0; i < signals[0].length; i += 1) {
      let sum = 0;
      // sum all values in other arrays
      for (let j = 0; j < signals.length; j += 1) {
        sum += signals[j][i];
      }
      // divide by number of arrays
      signals[0][i] = sum / signals.length;
    }

    return signals[0];
  };

  /**
   * Called immediately after a recording is captured. Used to process the resulting signal
   * whether by sending the result to a server or by computing a result locally
   */
  #afterRecord = () => {
    if (this.#download) {
      this.downloadData();
    }
  };

  /**
   * Sends the recorded signal, or a given csv string of a signal, to the back end server for processing
   * @param {<array>String} signalCsv - Optional csv string of a previously recorded signal, if given, this signal will be processed
   */
  sendToServerForProcessing = async signalCsv => {
    console.log('Sending data to server');
    return this.pyServer
      .getImpulseResponse({
        sampleRate: this.sourceSamplingRate || 96000,
        payload:
          signalCsv && signalCsv.length > 0
            ? csvToArray(signalCsv)
            : this.#average(this.getAllRecordedSignals()),
      })
      .then(res => {
        if (this.invertedImpulseResponse == null) {
          this.invertedImpulseResponse = res;
        }
      })
      .catch(err => {
        console.error(err);
      });
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   * @private
   */
  #createCalibrationNodeFromBuffer = dataBuffer => {
    const audioContext = this.makeNewSourceAudioContext();
    const buffer = audioContext.createBuffer(
      1, // number of channels
      dataBuffer.length, // length
      audioContext.sampleRate // sample rate
    );

    const data = buffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < dataBuffer.length; i += 1) {
        // fill the array with the MLS buffer
        data[i] = dataBuffer[i];
      }
    } catch (error) {
      console.error(error);
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    this.addCalibrationNode(source);
  };

  /**
   * Given an array of data buffers, create a calibration node for each buffer.
   * this.numCalibrationNodes will be created with the data buffers.
   * If the length of the buffer is 1, then all the nodes will be the same.
   * If the length of the buffer is greater than 1, and not euqal to this.numCalibrationNodes, an error will be thrown.
   * @param {Array} dataBufferArray - Array of data buffers
   */
  #setCalibrationNodesFromBuffer = (dataBufferArray = [this.#mlsBufferView]) => {
    this.#P = dataBufferArray[0].length;
    if (dataBufferArray.length === 1) {
      while (this.calibrationNodes.length < this.numCalibrationNodes) {
        this.#createCalibrationNodeFromBuffer(dataBufferArray[0]);
      }
    } else if (dataBufferArray.length === this.numCalibrationNodes) {
      dataBufferArray.forEach(dataBuffer => {
        this.#createCalibrationNodeFromBuffer(dataBuffer);
      });
    } else {
      throw new Error(
        'The length of the data buffer array must be 1 or equal to this.numCalibrationNodes'
      );
    }
  };

  /**
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = async () => {
    const {duration} = this.calibrationNodes[0].buffer;
    const actualDuration = duration * this.numCalibrationNodes;
    const totalDuration = actualDuration * 1.2;
    for (let i = 0; i < this.calibrationNodes.length; i += 1) {
      this.calibrationNodes[i].start(i * duration);
    }
    console.log(`Playing a buffer of ${actualDuration} seconds of audio`);
    console.log(`Waiting a total of ${totalDuration} seconds`);
    await sleep(totalDuration);
  };

  /**
   * Public method to start the calibration process. Objects intialized from webassembly allocate new memory
   * and must be manually freed. This function is responsible for intializing the MlsGenInterface,
   * and wrapping the calibration steps with a garbage collection safe gaurd.
   * @public
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  startCalibration = async stream => {
    // initialize the MLSGenInterface object with it's factory method
    await MlsGenInterface.factory(this.sinkSamplingRate, this.sourceSamplingRate).then(
      mlsGenInterface => {
        this.#mlsGenInterface = mlsGenInterface;
        this.#mlsBufferView = this.#mlsGenInterface.getMLS();
      }
    );

    // after intializating, start the calibration steps with garbage collection
    while (this.numCalibratingRoundsCompleted < this.numCalibratingRounds) {
      await this.#mlsGenInterface.withGarbageCollection([
        [
          this.calibrationSteps,
          [
            stream,
            this.#playCalibrationAudio,
            this.#setCalibrationNodesFromBuffer,
            this.#afterRecord,
          ],
        ],
      ]);
    }

    // await the server response
    await this.sendToServerForProcessing();
    return this.invertedImpulseResponse;
  };
}

export default ImpulseResponse;
