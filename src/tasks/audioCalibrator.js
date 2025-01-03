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
  isCalibrating = false;

  /** @private */
  sourceAudioContext;

  /** @private */
  sourceAudioContextConvolved;

  /** @protected */
  numCalibratingRounds = 1;

  /** @protected */
  numSuccessfulCaptured = 0;

  /** @private */
  sourceSamplingRate;

  /** @protected */
  calibrationNodes = [];

  /** @protected */
  calibrationNodesConvolved = [];

  /** @protected */
  localAudio;

  /** @private */
  startTime;

  numCalibratingRoundsCompleted=0;
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

  addTimeStamp = taskName => {
    let startTaskTime = (new Date().getTime() - this.startTime) / 1000;
    this.timeStamp.push(`SOUND ${Number(startTaskTime.toFixed(1))} s. ${taskName}`);
  };

  recordBackground = async (
    stream,
    loopCondition = () => false,
    duringRecord = async () => {},
    afterRecord = async () => {},
    mode,
    checkRec
  ) => {
    console.warn('before recording background noise');
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
      await this.stopRecording(mode, checkRec);

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
    afterRecord = async () => {},
    mode,
    checkRec
  ) => {
    // if it finished 2 attempts, it move to next iteration so reset numSuccessfulCaptured
    if (this.numSuccessfulCaptured >=2) {
      this.numSuccessfulCaptured = 0;
    }

    // do something before playing such as using the MLS to fill the buffers
    console.warn('beforePlay');
    await beforePlay();

    // play calibration audio
    console.warn('playCalibrationAudio');
    playCalibrationAudio();

    // do something before recording such as awaiting a certain amount of time
    console.warn('beforeRecord');
    await beforeRecord();
    const totalSec = this._calibrateSoundBurstPreSec + (this.numMLSPerCapture - this.num_mls_to_skip) * this._calibrateSoundBurstSec + this._calibrateSoundBurstPostSec;
    this.addTimeStamp(`Record ${totalSec.toFixed(1)} s of MLS with speaker+microphone IIR.`);

    // calibration loop
    while (loopCondition()) {
      if (this.isCalibrating) break;
      // start recording
      console.warn('startRecording');
      await this.startRecording(stream);

      if (this.isCalibrating) break;
      // do something during the recording such as sleep n amount of time
      console.warn('duringRecord');
      await duringRecord();

      if (this.isCalibrating) break;
      // when done, stop recording
      console.warn('stopRecording');
      await this.stopRecording(mode, checkRec);

      if (this.isCalibrating) break;
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
    lCalib = 104.92978421490648,
    checkRec,
    checkSD,
    maxSD
  ) => {
    this.numCalibratingRoundsCompleted = 0;
    this.numCalibratingRounds = 2;
    // calibration loop
    while (!this.isCalibrating && this.numCalibratingRoundsCompleted < this.numCalibratingRounds) {
      if (this.isCalibrating) break;
      // before recording
      await beforeRecord(gainValue);
      if (this.isCalibrating) break;
      // start recording
      await this.startRecording(stream);
      if (this.isCalibrating) break;
      // play calibration audio
      console.log(`Calibration Round ${this.numCalibratingRoundsCompleted}`);
      await playCalibrationAudio();
      if (this.isCalibrating) break;
      // when done, stop recording
      console.log('Calibration Round Complete');
      await this.stopRecording('volume', checkRec);
      if (this.isCalibrating) break;
      // after recording
      await afterRecord(lCalib);
      const sd = await checkSD() || Infinity;
      if (sd <= maxSD) {
        console.log(`SD =${sd}, less than calibrateSound1000HzMaxSD_dB=${maxSD}`);
        this.numCalibratingRoundsCompleted += 2;
      } else {
        // if exist the maxSD do it one more time and only one more time
        console.log(`SD =${sd}, greater than calibrateSound1000HzMaxSD_dB=${maxSD}`);
        this.numCalibratingRoundsCompleted += 1;
      }
      this.calibrationNodes = [];

      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
    }
  };

  /**
   * Getter for the isCalibrating property.
   *
   * @public
   * @returns - True if the audio is being calibrated, false otherwise.
   * @example
   */
  getCalibrationStatus = () => this.isCalibrating;

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

    // this.emit('update', {message: `sampling at ${samplingRate}Hz...`});
  };

  setSampleSize = sampleSize => {
    this.sampleSize = sampleSize;
  };

  setFlags = flags => {
    this.flags = flags;
  }

  sampleRatesSet = () => this.sourceSamplingRate && this.sinkSamplingRate;

  addCalibrationNode = node => {
    this.calibrationNodes.push(node);
  };

  addCalibrationNodeConvolved = node => {
    this.calibrationNodesConvolved.push(node);
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

  makeNewSourceAudioContextConvolved = () => {
    const options = {
      sampleRate: this.sourceSamplingRate,
    };

    this.sourceAudioContextConvolved = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)(options);

    return this.sourceAudioContextConvolved;
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
    saveToCSV(recordings[i], `recordedMLSignal_${i}_unconvolved.csv`);
  };
  downloadSingleUnfilteredRecording = () => {
    const recordings = this.getAllUnfilteredRecordedSignals();
    saveToCSV(recordings[recordings.length - 1], `recordedMLSignal_unconvolved.csv`);
  };
  downloadSingleFilteredRecording = () => {
    const recordings = this.getAllFilteredRecordedSignals();
    console.log('Single filtered recording should be of length: ' + recordings[0].length);
    saveToCSV(recordings[0], `recordedMLSignal_convolved.csv`);
  };
  downloadUnfilteredRecordings = () => {
    const recordings = this.getAllRecordedSignals();
    console.log('unfilterd download?');
    for (let i = 0; i < recordings.length; i++) {
      console.log(i);
      saveToCSV(recordings[i], `recordedMLSignal_${i}_unconvolved.csv`);
    }
  };
  downloadFilteredRecordings = () => {
    const recordings = this.getAllFilteredRecordedSignals();
    for (let i = 0; i < recordings.length; i++) {
      saveToCSV(recordings[i], `recordedMLSignal_${i}_convolved.csv`);
    }
  };
}

export default AudioCalibrator;
