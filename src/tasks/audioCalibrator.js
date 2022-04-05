/* eslint-disable no-await-in-loop */
import AudioRecorder from './audioRecorder';
import PythonServerInterface from '../server/PythonServerInterface';
import {sleep, saveToCSV} from '../utils';

/**
 * Provides methods for calibrating the user's speakers
 * @extends AudioRecorder
 */
class AudioCalibrator extends AudioRecorder {
  /**
   *
   */
  constructor(numCalibrationRounds = 1, numCalibrationNodes = 1) {
    super();
    this.numCalibratingRounds = numCalibrationRounds;
    this.numCalibrationNodes = numCalibrationNodes;
    this.pyServer = new PythonServerInterface();
  }

  /** @private */
  #isCalibrating = false;

  /** @private */
  #sourceAudioContext;

  /** @protected */
  numCalibratingRounds;

  /** @private */
  sourceSamplingRate;

  /** @protected */
  numCalibrationNodes;

  /** @protected */
  calibrationNodes = [];

  /**
   * Called when a call is received.
   * Creates a local audio DOM element and attaches it to the page.
   */
  createLocalAudio = targetElement => {
    const localAudio = document.createElement('audio');
    localAudio.setAttribute('id', 'localAudio');
    targetElement.appendChild(localAudio);
  };

  /**
   *
   * @param {MediaStream} stream
   * @param {Function} playCalibrationAudio - (async) function that plays the calibration audio
   * @param {*} beforeRecord - (async) function that is called before recording
   * @param {*} afterRecord  - (async) function that is called after recording
   */
  calibrationSteps = async (
    stream,
    playCalibrationAudio,
    beforeRecord = () => {},
    afterRecord = () => {}
  ) => {
    let numRounds = 0;

    // calibration loop
    while (!this.#isCalibrating && numRounds < this.numCalibratingRounds) {
      // before recording
      await beforeRecord();

      // start recording
      await this.startRecording(stream);

      // play calibration audio
      console.log(`Calibration Round ${numRounds}`);
      await playCalibrationAudio();

      // when done, stop recording
      console.log('Calibration Round Complete');
      await this.stopRecording();

      // after recording
      await afterRecord();

      this.calibrationNodes = [];

      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
      numRounds += 1;
    }
  };

  /**
   * Getter for the isCalibrating property.
   * @public
   * @returns {Boolean} - True if the audio is being calibrated, false otherwise.
   */
  getCalibrationStatus = () => this.#isCalibrating;

  /**
   * Set the sampling rate to the value received from the listener
   * @param {*} sinkSamplingRate
   */
  setSamplingRates = samplingRate => {
    this.sinkSamplingRate = samplingRate;
    this.sourceSamplingRate = samplingRate;
    console.log('sampling rate', samplingRate);
  };

  addCalibrationNode = node => {
    this.calibrationNodes.push(node);
  };

  makeNewSourceAudioContext = () => {
    const options = {
      sampleRate: this.sourceSamplingRate,
    };

    this.#sourceAudioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)(options);

    return this.#sourceAudioContext;
  };

  /**
   * Download the result of the calibration roudns
   */
  downloadData = () => {
    this.getAllRecordedSignals().forEach((signal, i) => {
      saveToCSV(signal, `recordedMLSignal_${i}.csv`);
    });
  };
}

export default AudioCalibrator;
