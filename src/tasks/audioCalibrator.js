/* eslint-disable no-await-in-loop */
import AudioRecorder from './audioRecorder';
import PythonServerAPI from '../server/PythonServerAPI';
import {sleep, saveToCSV} from '../utils';

/**
 * .
 * .
 * .
 * Provides methods for calibrating the user's speakers
 *
 * @extends AudioRecorder
 */
class AudioCalibrator extends AudioRecorder {
  /**
   *
   * @param numCaptures
   * @param numMLSPerCapture
   * @example
   */
  constructor(numCaptures = 1, numMLSPerCapture = 1) {
    super();
    this.numCaptures = numCaptures;
    this.numMLSPerCapture = numMLSPerCapture;
    this.pyServerAPI = new PythonServerAPI();
  }

  /** @private */
  #isCalibrating = false;

  /** @private */
  sourceAudioContext;

  /** @protected */
  numCalibratingRounds = 1;

  /** @protected */
  numSuccessfulCaptured = 0;

  /** @private */
  sourceSamplingRate;

  /** @protected */
  calibrationNodes = [];

  /** @protected */
  localAudio;

  /**
   * Called when a call is received.
   * Creates a local audio DOM element and attaches it to the page.
   *
   * @param targetElement
   * @example
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
   * @param {*} beforePlay - (async) function that is called before playing the audio
   * @param {*} beforeRecord - (async) function that is called before recording
   * @param {*} duringRecord - (async) function that is called while recording
   * @param {*} afterRecord  - (async) function that is called after recording
   * @example
   */
  calibrationSteps = async (
    stream,
    playCalibrationAudio,
    beforePlay = async () => {},
    beforeRecord = async () => {},
    loopCondition = () => false,
    duringRecord = async () => {},
    afterRecord = async () => {}
  ) => {
    this.numSuccessfulCaptured = 0;

    // do something before playing such as using the MLS to fill the buffers
    console.warn('beforePlay');
    await beforePlay();

    // play calibration audio
    console.warn('playCalibrationAudio');
    playCalibrationAudio();

    // do something before recording such as awaiting a certain amount of time
    console.warn('beforeRecord');
    await beforeRecord();

    // calibration loop
    while (loopCondition()) {
      // start recording
      console.warn('startRecording');
      await this.startRecording(stream);

      // do something during the recording such as sleep n amount of time
      console.warn('duringRecord');
      await duringRecord();

      // when done, stop recording
      console.warn('stopRecording');
      await this.stopRecording();

      // do something after recording such as start processing values
      console.warn('afterRecord');
      await afterRecord();

      // eslint-disable-next-line no-await-in-loop
      await sleep(1);
    }
  };

  /**
   *
   * @param {MediaStream} stream
   * @param {Function} playCalibrationAudio - (async) function that plays the calibration audio
   * @param {*} beforeRecord - (async) function that is called before recording
   * @param {*} afterRecord  - (async) function that is called after recording
   * @param {Number} gainValue - the gain value to set the gain node to
   */
  volumeCalibrationSteps = async (
    stream,
    playCalibrationAudio,
    beforeRecord = () => {},
    afterRecord = () => {},
    gainValue,
    lCalib = 104.92978421490648
  ) => {
    this.numCalibratingRoundsCompleted = 0;

    // calibration loop
    while (!this.#isCalibrating && this.numCalibratingRoundsCompleted < this.numCalibratingRounds) {
      // before recording
      await beforeRecord(gainValue);

      // start recording
      await this.startRecording(stream);

      // play calibration audio
      console.log(`Calibration Round ${this.numCalibratingRoundsCompleted}`);
      await playCalibrationAudio();

      // when done, stop recording
      console.log('Calibration Round Complete');
      await this.stopRecording();

      // after recording
      await afterRecord(lCalib);

      this.calibrationNodes = [];

      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
      this.numCalibratingRoundsCompleted += 1;
    }
  };

  /**
   * Getter for the isCalibrating property.
   *
   * @public
   * @returns - True if the audio is being calibrated, false otherwise.
   * @example
   */
  getCalibrationStatus = () => this.#isCalibrating;

  /** .
   * .
   * .
   * Set the sampling rate to the value received from the listener
   *
   * @param {*} sinkSamplingRate
   * @param samplingRate
   * @example
   */
  setSamplingRates = samplingRate => {
    this.sinkSamplingRate = samplingRate;
    this.sourceSamplingRate = samplingRate;
    this.emit('update', {message: `sampling at ${samplingRate}Hz...`});
  };

  sampleRatesSet = () => this.sourceSamplingRate && this.sinkSamplingRate;

  addCalibrationNode = node => {
    this.calibrationNodes.push(node);
  };

  makeNewSourceAudioContext = () => {
    const options = {
      sampleRate: this.sourceSamplingRate,
    };

    this.sourceAudioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)(options);

    return this.sourceAudioContext;
  };

  /** .
   * .
   * .
   * Download the result of the calibration roudns
   *
   * @example
   */
  downloadData = () => {
    const recordings = this.getAllRecordedSignals();
    const i = recordings.length - 1;
    saveToCSV(recordings[i], `recordedMLSignal_${i}.csv`);
  };
}

export default AudioCalibrator;
