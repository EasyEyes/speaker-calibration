import AudioCalibrator from '../audioCalibrator';
import MlsGenInterface from './mlsGen/mlsGenInterface';
// import fftw from 'fftw-js';

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
  #recordedSignal;

  /** @private */
  #P;

  // #argMax = array => {
  //   return [].reduce.call(array, (m, c, i, arr) => (c > arr[m] ? i : m), 0);
  // };

  // #arrayAverage = array => array.reduce((a, b) => a + b) / array.length;

  // #npdiff = arr1 => arr1.map((x, i) => arr1[i + 1] - x);

  // #compute_correlation = (recorded, generated, P) => {
  //   let size;
  //   const v = generated.slice(len(recorded) - 2 * P, len(recorded)); // take the last 2P samples of the recorded signal
  //   const g_reversed = generated.reverse();
  //   const g_avg = this.#arrayAverage(g_reversed);
  //   const v_reversed = v.reverse();
  //   const v_avg = this.#arrayAverage(v);

  //   // cross correlate to find the best match
  //   size = len(v) * len(generated);
  //   const fftr2r_x = new fftw.r2r.fft1d(size);
  //   const xCorr = fftr2r_x.backward(
  //     fftr2r_x.forward(v - v_avg) * fftr2r_x.forward(g_reversed - g_avg)
  //   );
  //   fftr2r_x.dispose(); // manual garbage collection
  //   const lag = this.#argMax(xCorr) - Math.floor(v.length / 2);

  //   // auto correlate to find the sampling difference
  //   size = len(v) * len(v);
  //   const fftr2r_auto = new fftw.r2r.fft1d(size);
  //   const autoCorr_full = fftr2r_auto.backward(
  //     fftr2r_auto.forward(v) * fftr2r_auto.forward(v_reversed)
  //   );
  //   const autoCorr = autoCorr_full.slice(len(autoCorr_full) - len(v), len(autoCorr_full));
  //   const inflection = this.#npdiff(Math.sign(this.#npdiff(autoCorr)));
  //   const peaks = inflection.map((x, i) => (x < 0 ? 1 : 0));
  // };

  // #compute_inverse_impulse_response = h => {
  //   const n = len(h);
  //   const fftc2c = new fftw.c2c.fft1d(n);
  //   const H = fftc2c.forward(h);
  //   const magnitudes = H.map(x => x.abs());
  //   console.log(H);
  // };

  /**
   * Called immediately after a recording is captured. Used to process the resulting signal 
   * whether by sending the result to a server or by computing a result locally
   */
  #afterRecord = () => {
    if (this.#download) {
      this.downloadData();
    }
    this.sendToServerForProcessing();
  };

  /**
   * Sends the recorded signal, or a given csv string of a signal, to the back end server for processing
   * @param {<array>String} signalCsv - Optional csv string of a previously recorded signal, if given, this signal will be processed 
   */
  sendToServerForProcessing = signalCsv => {
    console.log('Sending data to server');
    this.pyServer
      .getImpulseResponse({
        sampleRate: this.sourceSamplingRate || 96000,
        payload: signalCsv ? csvToArray(signalCsv) : this.getLastRecordedSignal(),
      })
      .then(res => {
        if (this.invertedImpulseResponse == null) {
          this.invertedImpulseResponse = res;
          console.log(this.invertedImpulseResponse);
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

    do {
      // after intializating, start the calibration steps with garbage collection
      await this.#mlsGenInterface.withGarbageCollection(this.calibrationSteps, [
        stream,
        this.#playCalibrationAudio,
        this.#setCalibrationNodesFromBuffer,
        this.#afterRecord,
      ]);
    } while (this.invertedImpulseResponse === null || this.numCalibratingRoundsCompleted < this.numCalibratingRounds);

    return this.invertedImpulseResponse;
  };
}

export default ImpulseResponse;
