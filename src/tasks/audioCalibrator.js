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
  numCalibratingRounds;

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
   */
  calibrationSteps = async (
    stream,
    playCalibrationAudio,
    beforePlay = async () => {},
    beforeRecord = async () => {},
    duringRecord = async () => {},
    afterRecord = async () => {}
  ) => {
    this.numSuccessfulCaptured = 0;

    // do something before recording such as awaiting a certain amount of time
    // await beforeRecord();

    // calibration loop
    while (this.numSuccessfulCaptured < this.numCaptures) {
      // do something before playing such as using the MLS to fill the buffers
      await beforePlay();

      // start recording
      await this.startRecording(stream);

      // play calibration audio
      playCalibrationAudio();

      // do something during the recording such as sleep n amount of time
      await duringRecord();

      // when done, stop recording
      await this.stopRecording();

      // do something after recording such as start processing values
      await afterRecord();

      // eslint-disable-next-line no-await-in-loop
      this.calibrationNodes = [];
      await sleep(3);
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
