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
    this.currentTime = 0;
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

  numCalibratingRoundsCompleted = 0;
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
    const currentTime   = new Date().getTime();           // ms
    const elapsedTime   = (currentTime - this.startTime) / 1000;  // s
    const stepDuration  = elapsedTime - this.currentTime;
    const startTimeSec  = elapsedTime - stepDuration;
  
    this.currentTime = elapsedTime; // for the next call
  
    const startStr = startTimeSec.toFixed(1);
    const stepStr  = stepDuration.toFixed(1);
  
    if (taskName === "Plot results") {
      // first push your normal Plot‐results line
      this.timeStamp.push(
        `${startStr} s. ∆ ${stepStr} s.  ${taskName}`
      );
      // *then* push the final “Done” line using the final elapsedTime
      const endStr = elapsedTime.toFixed(1);
      this.timeStamp.push(
        `${endStr} s.  Done`
      );
    }
    else {
      this.timeStamp.push(
        `${startStr} s. ∆ ${stepStr} s.  ${taskName}`
      );
    }
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
    if (this.numSuccessfulCaptured >= 2) {
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
    const totalSec =
      this._calibrateSoundBurstPreSec +
      (this.numMLSPerCapture - this.num_mls_to_skip) * this._calibrateSoundBurstSec +
      this._calibrateSoundBurstPostSec;

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
    maxSD,
    maxRetry
  ) => {
    this.numCalibratingRoundsCompleted = 0;
    console.log('maxSD in VolumeCaibrationSteps: ', maxSD, '0' >= maxSD);
    // calibration loop
    while (!this.isCalibrating && this.numCalibratingRoundsCompleted < maxRetry) {
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
      const sd = await checkSD();
      let sdMessage;
      if (sd <= maxSD) {
        console.log(`SD =${sd}, less than calibrateSound1000HzMaxSD_dB=${maxSD}`);
        this.numCalibratingRoundsCompleted += maxRetry;
        sdMessage = `. SD = ${sd} dB`;
      } else {
        // if exist the maxSD do it one more time and only one more time
        console.log(`SD =${sd}, greater than calibrateSound1000HzMaxSD_dB=${maxSD}`);
        this.numCalibratingRoundsCompleted += 1;
        sdMessage = `. SD = ${sd} > ${this.calibrateSound1000HzMaxSD_dB} dB.`;
      }
      this.addTimeStamp(
        `${this.calibrateSound1000HzPreSec.toFixed(1)}` +
          `+${this.calibrateSound1000HzSec.toFixed(1)}` +
          `+${this.calibrateSound1000HzPostSec.toFixed(1)} s. ` +
          `1000 Hz at ${this.inDB} dB${sdMessage}`
      );
      this.calibrationNodes = [];

      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
    }
  };

  /**
   * Simulates recording by convolving input signal with loudspeaker and microphone impulse responses
   *
   * @param {Array<number>} inputSignal - The input signal to be convolved
   * @param {Array<number>} loudspeakerImpulseResponse - The loudspeaker impulse response
   * @param {Array<number>} microphoneImpulseResponse - The microphone impulse response
   * @param {Function} afterRecord - Callback function to execute after recording simulation
   * @param {number} lCalib - Calibration parameter
   * @param {string} checkRec - Recording check type
   */
  simulatedVolumeCalibrationSteps = async (
    inputSignal,
    loudspeakerImpulseResponse,
    microphoneImpulseResponse,
    afterRecord = () => {},
    lCalib,
    checkSD,
    maxSD,
    maxRetry
  ) => {
    const totalSec = this.CALIBRATION_TONE_DURATION;
    // Convolve with loudspeaker and microphone impulse responses
    const convolvedSignalWithMicrophone = await this.pyServerAPI
      .irConvolution({
        input_signal: inputSignal,
        loudspeaker_ir: loudspeakerImpulseResponse,
        microphone_ir: microphoneImpulseResponse,
        duration: totalSec,
        sample_rate: this.sourceSamplingRate / this._calibrateSoundBurstDownsample,
      })
      .then(res => {
        console.log('res in simulatedVolumeCalibrationSteps: ', res);
        return res['output_signal'];
      });

    // Log details about the simulated recording
    const uniqueSet = new Set(convolvedSignalWithMicrophone);
    const numberOfUniqueValues = uniqueSet.size;
    const squaredValues = convolvedSignalWithMicrophone.map(value => value * value);
    const sum_of_squares = squaredValues.reduce((total, value) => total + value, 0);
    const squared_mean = sum_of_squares / convolvedSignalWithMicrophone.length;
    const dbLevel = 20 * Math.log10(Math.sqrt(squared_mean));
    const roundedDbLevel = Math.round(dbLevel * 10) / 10;

    console.log(
      '[SIMULATION] 1000-Hz recording: ' +
        roundedDbLevel +
        ' dB with ' +
        numberOfUniqueValues +
        ' unique values.'
    );

    // Save the simulated recording as if it were captured from a microphone
    this.saveVolumeRecording(convolvedSignalWithMicrophone);

    // Process the simulated recording
    await afterRecord(lCalib); 
    const sd = await checkSD();
    let sdMessage;
    if (sd <= maxSD) {
      console.log(`SD =${sd}, less than calibrateSound1000HzMaxSD_dB=${maxSD}`);
      this.numCalibratingRoundsCompleted += maxRetry;
      sdMessage = `. SD = ${sd} dB`;
    } else {
      // if exist the maxSD do it one more time and only one more time
      console.log(`SD =${sd}, greater than calibrateSound1000HzMaxSD_dB=${maxSD}`);
      this.numCalibratingRoundsCompleted += 1;
      sdMessage = `. SD = ${sd} > ${this.calibrateSound1000HzMaxSD_dB} dB.`;
    }
    this.addTimeStamp(
      `${this.calibrateSound1000HzPreSec.toFixed(1)}` +
        `+${this.calibrateSound1000HzSec.toFixed(1)}` +
        `+${this.calibrateSound1000HzPostSec.toFixed(1)} s. ` +
        `1000 Hz at ${this.inDB} dB${sdMessage}`
    );
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
  };

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
