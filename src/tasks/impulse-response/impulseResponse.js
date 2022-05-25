import AudioCalibrator from '../audioCalibrator';
import MlsGenInterface from './mlsGen/mlsGenInterface';

import {sleep} from '../../utils';

/**
 *
 */
class ImpulseResponse extends AudioCalibrator {
  /**
   *
   */
  constructor({download = false, numCalibrationRounds = 2, numCalibrationNodes = 2}) {
    super(numCalibrationRounds, numCalibrationNodes);
    this.#download = download;
  }

  /** @private */
  #download;

  /** @private */
  #mlsGenInterface;

  /** @private */
  #mlsBufferView;

  #afterRecord = () => {
    if (this.#download) {
      this.downloadData();
    }
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
    await this.#mlsGenInterface.withGarbageCollection(this.calibrationSteps, [
      stream,
      this.#playCalibrationAudio,
      this.#setCalibrationNodesFromBuffer,
      this.#afterRecord,
    ]);
  };
}

export default ImpulseResponse;
