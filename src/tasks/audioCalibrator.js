/* eslint-disable no-await-in-loop */
import AudioRecorder from './audioRecorder';
import PythonServerAPI from '../server/PythonServerAPI';
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
    this.pyServerAPI = new PythonServerAPI();
  }

  /** @private */
  #isCalibrating = false;

  /** @private */
  #sourceAudioContext;

  /** @protected */
  numCalibratingRounds;

  /** @protected */
  numCalibratingRoundsCompleted = 0;

  /** @private */
  sourceSamplingRate;

  /** @protected */
  numCalibrationNodes;

  /** @protected */
  calibrationNodes = [];

  /** @protected */
  localAudio;

  /**
   * Called when a call is received.
   * Creates a local audio DOM element and attaches it to the page.
   */
  createLocalAudio = targetElement => {
    this.localAudio = document.createElement('audio');
    this.localAudio.setAttribute('id', 'localAudio');
    targetElement.appendChild(this.localAudio);
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
    this.numCalibratingRoundsCompleted = 0;

    // calibration loop
    while (!this.#isCalibrating && this.numCalibratingRoundsCompleted < this.numCalibratingRounds) {
      // before recording
      await beforeRecord();

      // start recording
      await this.startRecording(stream);

      // play calibration audio
      console.log(`Calibration Round ${this.numCalibratingRoundsCompleted}`);
      await playCalibrationAudio();

      // when done, stop recording
      console.log('Calibration Round Complete');
      await this.stopRecording();

      // after recording
      await afterRecord();

      this.calibrationNodes = [];

      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
      this.numCalibratingRoundsCompleted += 1;
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

  sampleRatesSet = () => this.sourceSamplingRate && this.sinkSamplingRate;

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
    const recordings = this.getAllRecordedSignals();
    const i = recordings.length - 1;
    saveToCSV(recordings[i], `recordedMLSignal_${i}.csv`);
  };
}

export default AudioCalibrator;
