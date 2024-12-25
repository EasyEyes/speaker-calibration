import AudioCalibrator from '../audioCalibrator';

import {
  sleep,
  csvToArray,
  saveToCSV,
  saveToJSON,
  findMinValue,
  findMaxValue,
  getCurrentTimeString,
  standardDeviation,
  interpolate,
} from '../../utils';

import {
  volumePowerCheck,
  getPower
} from '../../powerCheck';

import database from '../../config/firebase';
import {ref, set, get, child} from 'firebase/database';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  setDoc,
  arrayUnion,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { phrases } from '../../../dist/example/i18n';

/**
 *
 */
class Combination extends AudioCalibrator {
  /**
   * Default constructor. Creates an instance with any number of paramters passed or the default parameters defined here.
   *
   * @param {Object<boolean, number, number, number>} calibratorParams  - paramter object
   * @param {boolean} [calibratorParams.download = false]  - boolean flag to download captures
   * @param {number} [calibratorParams.mlsOrder = 18] - order of the MLS to be generated
   * @param {number} [calibratorParams.numCaptures = 5] - number of captures to perform
   * @param {number} [calibratorParams.numMLSPerCapture = 2] - number of bursts of MLS per capture
   */
  constructor({
    download = false,
    mlsOrder = 18,
    numCaptures = 3,
    numMLSPerCapture = 2,
    lowHz = 20,
    highHz = 10000,
  }) {
    super(numCaptures, numMLSPerCapture);
    this.#mlsOrder = parseInt(mlsOrder, 10);
    this.#P = 2 ** mlsOrder - 1;
    this.#download = download;
    this.#mls = [];
    this.#lowHz = lowHz;
    this.#highHz = highHz;
  }

  /** @private */
  stepNum = 0;

  /** @private */
  totalSteps = 25;

  /** @private */
  #download;

  /** @private */
  #mlsGenInterface;

  /** @private */
  #mlsBufferView;

  /** @private */
  componentInvertedImpulseResponse = null;

  /** @private */
  systemInvertedImpulseResponse = null;

  //averaged and subtracted ir returned from calibration used to calculated iir
  /** @private */
  ir = null;

  /** @private */
  impulseResponses = [];

  /** @private */
  #mlsOrder;

  /** @private */
  #lowHz;

  /** @private */
  #highHz;

  /** @private */
  #mls;

  /** @private */
  #P;

  /** @private */
  #audioContext;

  /** @private */
  offsetGainNode;

  /** @private */
  componentConvolution;

  /** @private */
  componentConvolutionNoBandpass;

  /** @private */
  componentIROrigin = {
    Freq: [],
    Gain: [],
  };

  /** @private */
  systemConvolution;

  /** @private */
  systemConvolutionNoBandpass;

  ////////////////////////volume
  /** @private */
  #CALIBRATION_TONE_FREQUENCY = 1000; // Hz

  /** @private */
  #CALIBRATION_TONE_TYPE = 'sine';

  CALIBRATION_TONE_DURATION = 5; // seconds
  calibrateSound1000HzPreSec = 3.5;
  calibrateSound1000HzSec = 1.0;
  calibrateSound1000HzPostSec = 0.5;

  /** @private */
  outDBSPL = null;
  THD = null;
  outDBSPL1000 = null;

  /** @private */
  TAPER_SECS = 0.01; // seconds

  /** @private */
  status_denominator = 8;

  /** @private */
  status_numerator = 0;

  /** @private */
  percent_complete = 0;

  /** @private */
  status = ``;

  /**@private */
  status_literal = `<div style="display: flex; justify-content: center;"><div style="width: 200px; height: 20px; border: 2px solid #000; border-radius: 10px;"><div style="width: ${this.percent_complete}%; height: 100%; background-color: #00aaff; border-radius: 8px;"></div></div></div>`;

  /**@private */
  componentIR = null;

  /**@private */
  oldComponentIR = null;

  /**@private */
  systemIR = null;

  /**@private */
  _calibrateSoundCheck = '';

  deviceType = null;

  deviceName = null;

  deviceInfo = null;

  desired_time_per_mls = 0;

  num_mls_to_skip = 0;

  desired_sampling_rate = 0;

  #currentConvolution = [];

  mode = 'unfiltered';

  sourceNode;

  autocorrelations = [];

  iirLength = 0;

  irLength = 0;

  calibrateSoundIIRPhase = 'linear';

  componentInvertedImpulseResponseNoBandpass = [];

  componentIRInTimeDomain = [];

  systemInvertedImpulseResponseNoBandpass = [];

  _calibrateSoundBackgroundSecs;

  _calibrateSoundSmoothOctaves;

  background_noise = {};

  numSuccessfulBackgroundCaptured;

  _calibrateSoundBurstDb;

  _calibrateSoundBurstFilteredExtraDb;

  _calibrateSoundBurstLevelReTBool;

  SDofFilteredRange = {
    mls: undefined,
    component: undefined,
    system: undefined,
  };

  transducerType = 'Loudspeaker';

  componentIRPhase = [];

  systemIRPhase = [];

  webAudioDeviceNames = {loudspeaker: '', microphone: '', loudspeakerText: '', microphoneText: ''};

  waveforms = {
    volume: {},
  };

  recordingChecks = {
    volume: {},
    unfiltered: [],
    system: [],
    component: [],
    warnings:[]
  };

  inDB;

  soundCheck = '';

  filteredMLSRange = {
    component: {
      Min: null,
      Max: null,
    },
    system: {
      Min: null,
      Max: null,
    },
  };

  /** @private */
  timeStamp = [];

  restartCalibration = false;

  calibrateSoundLimit = 1;

  filteredMLSAttenuation = {
    component: 1,
    system: 1,
    maxAbsSystem: 1,
    maxAbsComponent: 1,
  };

  //parameter result from volume calibration
  T = 0;
  //gainDBSPL result from volume calibration
  gainDBSPL = 0;
  //not always just using _calibrateSoundBurstDb for MLS so created a new parameter
  power_dB = 0;

  //system
  systemAttenuatorGainDB = 0;
  systemFMaxHz = 0;

  //component
  componentAttentuatorGainDB = 0;
  componentFMaxHz = 0;

  dL_n;
  L_new_n;
  fs2;
  icapture = 0;

  /**generate string template that gets reevaluated as variable increases */
  generateTemplate = (status) => {
    if (this.isCalibrating) {
      return '';
    }
    if (this.percent_complete > 100) {
      this.percent_complete = 100;
    }
    let MLSsd = '';
    let componentSD = '';
    let systemSD = '';
    let flags = '';
    const reportWebAudioNames = `${this.webAudioDeviceNames.loudspeakerText} <br> ${this.webAudioDeviceNames.microphoneText}`;
    const samplingParamText =  phrases.RC_SamplingHzBits[this.language].replace('111', this.sourceSamplingRate).replace('222',this.sinkSamplingRate).replace('333', this.calibrateSoundSamplingDesiredBits);
    const reportParameters = `<br> ${samplingParamText}`;
    if (this.flags) {
      flags = `<br> autoGainControl: ${this.flags.autoGainControl}; 
      echoCancellation: ${this.flags.echoCancellation};
      noiseSuppression: ${this.flags.noiseSuppression}`;
    }
    if (this.SDofFilteredRange['mls']) {
      MLSsd = `<br> Recorded MLS power SD: ${this.SDofFilteredRange['mls']} dB`;
    }
    if (this.SDofFilteredRange['system']) {
      systemSD = `<br> Loudspeaker+Microphone  correction SD: ${this.SDofFilteredRange['system']} dB`;
    }
    if (this.SDofFilteredRange['component']) {
      componentSD = `<br> ${this.transducerType} correction SD: ${this.SDofFilteredRange['component']} dB`;
    }
    const template = `<div style="display: flex; justify-content: flex-start; margin-top: 0.4rem;"><div style="width: 100%; height: 20px; border: 2px solid #000; border-radius: 10px;"><div style="width: ${this.percent_complete}%; height: 100%; background-color: #00aaff; border-radius: 8px;"></div></div></div>`;
    return `
        ${reportWebAudioNames}
        ${reportParameters}
        <br>${status}
        ${MLSsd}
        ${systemSD}
        ${componentSD}
        ${flags}
        ${template }`;
  };

  /** increment numerator and percent for status bar */
  incrementStatusBar = () => {
    this.status_numerator += 1;
    this.percent_complete = (this.status_numerator / this.status_denominator) * 100;
  };

  setDeviceType = deviceType => {
    this.deviceType = deviceType;
  };

  setDeviceName = deviceName => {
    this.deviceName = deviceName;
  };

  setDeviceInfo = deviceInfo => {
    this.deviceInfo = deviceInfo;
  };

  /** .
   * .
   * .
   * Sends all the computed impulse responses to the backend server for processing
   *
   * @returns sets the resulting inverted impulse response to the class property
   * @example
   */
  sendSystemImpulseResponsesToServerForProcessing = async () => {
    this.addTimeStamp('Get system IIR');
    const computedIRs = await Promise.all(this.impulseResponses);
    const filteredComputedIRs = computedIRs.filter(element => {
      return element != undefined;
    }); //log any errors that are found in this step
    console.log('filteredComputedIRs', filteredComputedIRs);
    const mls = this.#mls[this.icapture];
    const lowHz = this.#lowHz; //gain of 1 below cutoff, need gain of 0
    const highHz = this.#highHz; //check error for anything other than 10 kHz
    const iirLength = this.iirLength;
    this.stepNum += 1;
    console.log('send impulse responses to server: ' + this.stepNum);
    this.status = this.generateTemplate(`All Hz Calibration: computing the IIR...`.toString()).toString();
    this.emit('update', {message: this.status});
    return await this.pyServerAPI
      .getSystemInverseImpulseResponseWithRetry({
        payload: filteredComputedIRs.slice(0, this.numCaptures),
        mls,
        lowHz,
        highHz,
        iirLength,
        sampleRate: this.sourceSamplingRate || 96000,
        mlsAmplitude: Math.pow(10, this.power_dB / 20),
        calibrateSoundBurstFilteredExtraDb: this._calibrateSoundBurstFilteredExtraDb,
        calibrateSoundIIRPhase: this.calibrateSoundIIRPhase,
      })
      .then(async res => {
        this.stepNum += 1;
        console.log('got impulse response ' + this.stepNum);
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the IIR...`.toString()).toString();
        this.emit('update', {message: this.status});
        this.systemInvertedImpulseResponse = res['iir'];
        this.systemIR = res['ir'];
        this.systemInvertedImpulseResponseNoBandpass = res['iirNoBandpass'];
        this.systemAttenuatorGainDB = res['attenuatorGain_dB'];
        this.systemFMaxHz = res['fMaxHz'];
        await this.pyServerAPI.checkMemory();
        await this.pyServerAPI
          .getConvolution({
            mls,
            inverse_response: this.systemInvertedImpulseResponse,
            inverse_response_no_bandpass: this.systemInvertedImpulseResponseNoBandpass,
            attenuatorGain_dB: this.systemAttenuatorGainDB,
            mls_amplitude: Math.pow(10, this.power_dB / 20),
          })
          .then(result => {
            console.log(result);
            this.systemConvolution = result['convolution'];
            this.systemConvolutionNoBandpass = result['convolution_no_bandpass'];
          });

        // attenuate the system convolution if the amplitude is greater than this.calibrateSoundLimit
        // find max of absolute value of system convolution

        const max = findMaxValue(this.systemConvolution);
        this.filteredMLSAttenuation.system =
          this.systemConvolution.reduce((a, b) => a + b ** 2, 0) / this.systemConvolution.length;
        this.filteredMLSAttenuation.maxAbsSystem = max;
      })
      .catch(err => {
        console.error(err);
      });
  };

  /** .
   * .
   * .
   * Sends all the computed impulse responses to the backend server for processing
   *
   * @returns sets the resulting inverted impulse response to the class property
   * @example
   */
  sendComponentImpulseResponsesToServerForProcessing = async () => {
    this.addTimeStamp('Get component IIR');
    const computedIRs = await Promise.all(this.impulseResponses);
    const filteredComputedIRs = computedIRs.filter(element => {
      return element != undefined;
    });
    let componentIRGains = this.componentIR['Gain'];
    const componentIRFreqs = this.componentIR['Freq'];
    //normalize the component IR gains
    componentIRGains = componentIRGains.map(value => {
      return value + this._calibrateSoundBurstScalarDB - this._calibrateSoundBurstDb;
    });
    if (this._calibrateSoundBurstNormalizeBy1000HzGainBool) {
      const sineGainAt1000Hz_dB = this.gainDBSPL;
      componentIRGains = componentIRGains.map(value => {
        return value - sineGainAt1000Hz_dB;
      });
    }
    const mls = this.#mls[this.icapture];
    const lowHz = this.#lowHz;
    const iirLength = this.iirLength;
    const irLength = this.irLength;
    const highHz = this.#highHz;
    this.stepNum += 1;
    console.log('send impulse responses to server: ' + this.stepNum);
    this.status = this.generateTemplate(`All Hz Calibration: computing the IIR...`.toString()).toString();
    this.emit('update', {message: this.status});
    console.log()
    return this.pyServerAPI
      .getComponentInverseImpulseResponseWithRetry({
        payload: filteredComputedIRs.slice(0, this.numCaptures),
        mls,
        lowHz,
        highHz,
        iirLength,
        componentIRGains,
        componentIRFreqs,
        sampleRate: this.sourceSamplingRate || 96000,
        mlsAmplitude: Math.pow(10, this.power_dB / 20),
        irLength,
        calibrateSoundSmoothOctaves: this._calibrateSoundSmoothOctaves,
        calibrateSoundSmoothMinBandwidthHz: this._calibrateSoundSmoothMinBandwidthHz,
        calibrateSoundBurstFilteredExtraDb: this._calibrateSoundBurstFilteredExtraDb,
        calibrateSoundIIRPhase: this.calibrateSoundIIRPhase,
      })
      .then(async res => {
        this.stepNum += 1;
        console.log('got impulse response ' + this.stepNum);
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the IIR...`.toString()).toString();
        this.emit('update', {message: this.status});
        this.componentInvertedImpulseResponse = res['iir'];
        this.componentInvertedImpulseResponseNoBandpass = res['iirNoBandpass'];
        this.componentIR['Gain'] = res['ir'];
        this.componentIR['Freq'] = res['frequencies'];
        this.componentIRPhase = res['component_angle'];
        this.systemIRPhase = res['system_angle'];
        this.componentIROrigin['Freq'] = res['frequencies'];
        this.componentIROrigin['Gain'] = res['irOrigin'];
        this.componentIRInTimeDomain = res['irTime'];
        this.componentAttenuatorGainDB = res['attenuatorGain_dB'];
        this.componentFMaxHz = res['fMaxHz'];
        await this.pyServerAPI.checkMemory();
        await this.pyServerAPI
          .getConvolution({
            mls,
            inverse_response: this.componentInvertedImpulseResponse,
            inverse_response_no_bandpass: this.componentInvertedImpulseResponseNoBandpass,
            attenuatorGain_dB: this.componentAttenuatorGainDB,
            mls_amplitude: Math.pow(10, this.power_dB / 20),
          })
          .then(result => {
            console.log(result);
            this.componentConvolution = result['convolution'];
            this.componentConvolutionNoBandpass = result['convolution_no_bandpass'];
          });
        // attenuate the component convolution if the amplitude is greater than this.calibrateSoundLimit
        // find max of absolute value of component convolution
        const max = findMaxValue(this.componentConvolution);
        // if (max > this.calibrateSoundLimit) {
        //   const gain = this.calibrateSoundLimit / max;
        //   // apply gain to component convolution
        //   this.componentConvolution = this.componentConvolution.map(value => value * gain);
        //   this.filteredMLSAttenuation.component = gain;
        // }
        this.filteredMLSAttenuation.component =
          this.componentConvolution.reduce((a, b) => a + b ** 2, 0) /
          this.componentConvolution.length;
        this.filteredMLSAttenuation.maxAbsComponent = max;
      })
      .catch(err => {
        // this.emit('InvertedImpulseResponse', {res: false});
        console.error(err);
      });
  };

  sendBackgroundRecording = () => {
    const allSignals = this.getAllBackgroundRecordings();
    const numSignals = allSignals.length;
    const background_rec_whole = allSignals[numSignals - 1];
    const fraction = 0.5 / (this._calibrateSoundBackgroundSecs + 0.5);
    // Calculate the starting index for slicing the array
    const startIndex = Math.round(fraction * background_rec_whole.length);
    // Slice the array from the calculated start index to the end of the array
    const background_rec = background_rec_whole.slice(startIndex);
    console.log('Sending background recording to server for processing');
    this.addTimeStamp('Compute background PSD');
    this.pyServerAPI
      .getBackgroundNoisePSDWithRetry({
        background_rec,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        if (this.numSuccessfulBackgroundCaptured < 1) {
          this.numSuccessfulBackgroundCaptured += 1;
          //storing all background data in background_psd object
          this.background_noise['x_background'] = res['x_background'];
          this.background_noise['y_background'] = res['y_background'];
          this.background_noise['recording'] = background_rec;
        }
      })
      .catch(err => {
        console.error(err);
      });
  };

  /** .
   * .
   * .
   * Sends the recorded signal, or a given csv string of a signal, to the back end server for processing
   *
   * @param {<array>String} signalCsv - Optional csv string of a previously recorded signal, if given, this signal will be processed
   * @example
   */
  sendRecordingToServerForProcessing = async signalCsv => {
    const allSignals = this.getAllUnfilteredRecordedSignals();
    console.log(
      'Obtaining last all hz unfiltered recording from #allHzUnfilteredRecordings to send to server for processing'
    );
    const numSignals = allSignals.length;
    const mls = this.#mlsBufferView[this.icapture];
    const payload =
      signalCsv && signalCsv.length > 0 ? csvToArray(signalCsv) : allSignals[numSignals - 1];
    console.log('sending rec');
    this.stepNum += 1;
    console.log('send rec ' + this.stepNum);
    this.status = this.generateTemplate(`All Hz Calibration Step: computing the IR of the last recording...`.toString()).toString();
    this.emit('update', {message: this.status});
    if (this.isCalibrating) return null;
    await this.pyServerAPI
      .allHzPowerCheck({
        payload,
        sampleRate: this.sourceSamplingRate || 96000,
        binDesiredSec: this._calibrateSoundPowerBinDesiredSec,
        burstSec: this.desired_time_per_mls,
        repeats: this.numMLSPerCapture - this.num_mls_to_skip,
        warmUp: this.num_mls_to_skip 
      })
      .then(async result => {
        if (result) {
          if (result['sd'] > this._calibrateSoundBurstMaxSD_dB && 
            this.numSuccessfulCaptured == 0) {
              console.log('SD: ' + result['sd'] + ', greater than _calibrateSoundBurstMaxSD_dB: ' + this._calibrateSoundBurstMaxSD_dB);
            this.recordingChecks['unfiltered'].push(result);
            this.clearLastUnfilteredRecordedSignals();
            this.numSuccessfulCaptured +=1;
          } else {
            if (result['sd'] <= this._calibrateSoundBurstMaxSD_dB) {
              console.log('SD: ' + result['sd'] + ', less than _calibrateSoundBurstMaxSD_dB: ' + this._calibrateSoundBurstMaxSD_dB);
            } else {
              console.log('SD: ' + result['sd'] + ', greater than _calibrateSoundBurstMaxSD_dB: ' + this._calibrateSoundBurstMaxSD_dB);
              this.recordingChecks['warnings'].push(`Redo all Hz recording because SD ${result['sd']} dB> ${this._calibrateSoundBurstMaxSD_dB} dB`);
              this.status = this.generateTemplate(`Redoing all Hz recording because SD ${result['sd']} dB> ${this._calibrateSoundBurstMaxSD_dB} dB`.toString()).toString();
              this.emit('update', {
                message: this.status,
              });
            }
            if (this.numSuccessfulCaptured == 1) {
              console.log('pop last unfiltered mls volume check');
              this.recordingChecks['unfiltered'].pop();
            }
            this.recordingChecks['unfiltered'].push(result);
            // let start = new Date().getTime() / 1000;
            //   const payloadT = tf.tensor1d(payload);
            //   payloadT.print();
            //   const xfft = payloadT.rfft();  // tf.spe
            //   xfft.array().then(array => {
            //     console.log("fft:", array);
            //     let setItem = new Set(array);
            //     console.log("all zero", setItem.size === 1 && setItem.has(0));
            // });
            // console.log("dimention:", xfft.shape);
            // let end = new Date().getTime() / 1000;
            // console.log("Time taken:", end - start, "seconds");
            console.log('start calculate impulse response');
            const usedPeriodStart = this.num_mls_to_skip  * this.sourceSamplingRate;
            const payload_skipped_warmUp = payload.slice(usedPeriodStart);
            await this.pyServerAPI
              .getAutocorrelation({
                mls:mls,
                payload: payload_skipped_warmUp,
                sampleRate: this.sourceSamplingRate || 96000,
                numPeriods: this.numMLSPerCapture - this.num_mls_to_skip,
              })
              .then(async res => {
                this.autocorrelations.push(res['autocorrelation']);
                this.fs2 = res['fs2'];
                this.L_new_n = res['L_new_n'];
                this.dL_n = res['dL_n'];
                this.impulseResponses.push(
                  await this.pyServerAPI
                    .getImpulseResponse({
                      mls,
                      sampleRate: this.sourceSamplingRate || 96000,
                      numPeriods: this.numMLSPerCapture - this.num_mls_to_skip,
                      sig: payload_skipped_warmUp,
                      fs2: this.fs2,
                      L_new_n: this.L_new_n,
                      dL_n: this.dL_n,
                    })
                    .then(res => {
                        this.numSuccessfulCaptured += 2;
                        this.stepNum += 1;
                        console.log('got impulse response ' + this.stepNum);
                        this.incrementStatusBar();
                        this.status = this.generateTemplate(`All Hz Calibration: ${this.numSuccessfulCaptured}/${this.numCaptures} IRs computed...`.toString()).toString();
                        this.emit('update', {
                          message: this.status,
                        });
                        return res['ir'];
                    })
                    .catch(err => {
                      console.error(err);
                    })
                );
              });
          }
          console.log('number of unfiltered recording checks:' +  this.recordingChecks['unfiltered'].length);
        }
      })
      .catch(err => {
        console.error(err);
      });
  };

  /**
   * Passed to the calibration steps function, awaits the desired amount of seconds to capture the desired number
   * of MLS periods defined in the constructor.
   *
   * @example
   */
  #awaitDesiredMLSLength = async () => {
    // seconds per MLS = P / SR
    // await N * P / SR
    this.stepNum += 1;
    console.log('await desired length ' + this.stepNum);
    this.status = this.generateTemplate(`All Hz Calibration: sampling the calibration signal...`.toString() +
      `\niteration ${this.stepNum}`);
    this.emit('update', {
      message: this.status,
    });
    let time_to_wait = 0;
    if (this.mode === 'unfiltered') {
      //unfiltered
      time_to_wait = (this.#mls[0].length / this.sourceSamplingRate) * this.numMLSPerCapture;
      time_to_wait = time_to_wait + this._calibrateSoundBurstPostSec;
    } else if (this.mode === 'filtered') {
      //filtered
      // time_to_wait =
      //   (this.#currentConvolution.length / this.sourceSamplingRate) *
      //   (this.numMLSPerCapture / (this.num_mls_to_skip + this.numMLSPerCapture));
      time_to_wait =
        (this.#currentConvolution.length / this.sourceSamplingRate) * this.numMLSPerCapture;
      time_to_wait = time_to_wait + this._calibrateSoundBurstPostSec;
    } else {
      throw new Error('Mode broke in awaitDesiredMLSLength');
    }

    await sleep(time_to_wait);
  };

  /**
   * Passed to the background noise recording function, awaits the desired amount of seconds to capture the desired number
   * of seconds of background noise
   *
   * @example
   */
  #awaitBackgroundNoiseRecording = async () => {
    console.log(
      'Waiting ' + this._calibrateSoundBackgroundSecs + ' second(s) to record background noise'
    );
    let time_to_wait = this._calibrateSoundBackgroundSecs + 0.5;
    this.addTimeStamp(`Record ${time_to_wait.toFixed(1)} s of background.`)
    await sleep(time_to_wait);
  };

  /** .
   * .
   * .
   * Passed to the calibration steps function, awaits the onset of the signal to ensure a steady state
   *
   * @example
   */
  #awaitSignalOnset = async () => {
    this.stepNum += 1;
    console.log('await signal onset ' + this.stepNum);
    this.status = this.generateTemplate(`All Hz Calibration: waiting for the signal to stabilize...`.toString());
    this.emit('update', {
      message: this.status,
    });
    let number_of_bursts_to_skip = 0;
    let time_to_sleep = 0;
    if (this.mode === 'unfiltered') {
      time_to_sleep = (this.#mls[0].length / this.sourceSamplingRate) * number_of_bursts_to_skip;
    } else if (this.mode === 'filtered') {
      console.log(this.#currentConvolution.length);
      // time_to_sleep =
      //   (this.#currentConvolution.length / this.sourceSamplingRate) *
      //   (number_of_bursts_to_skip / (number_of_bursts_to_skip + this.numMLSPerCapture));
      time_to_sleep =
        (this.#currentConvolution.length / this.sourceSamplingRate) * number_of_bursts_to_skip;
    } else {
      throw new Error('Mode broke in awaitSignalOnset');
    }
    await sleep(time_to_sleep);
  };

  /**
   * Called immediately after a recording is captured. Used to process the resulting signal
   * whether by sending the result to a server or by computing a result locally.
   *
   * @example
   */
  #afterMLSRecord = async () => {
    console.log('after record');
    this.addTimeStamp(`After record unfiltered MLS version ${this.icapture}`);
    await this.sendRecordingToServerForProcessing();
  };

  #afterMLSwIIRRecord = async () => {
    await this.checkPowerVariation();
  };

  /** .
   * .
   * .
   * Created an S Curver Buffer to taper the signal onset
   *
   * @param {*} onSetBool
   * @returns
   * @example
   */
  createSCurveBuffer = (onSetBool = true) => {
    const curve = new Float32Array(this.TAPER_SECS * this.sourceSamplingRate + 1);
    const frequency = 1 / (4 * this.TAPER_SECS);
    let j = 0;
    for (let i = 0; i < this.TAPER_SECS * this.sourceSamplingRate + 1; i += 1) {
      const phase = 2 * Math.PI * frequency * j;
      const onsetTaper = Math.pow(Math.sin(phase), 2);
      const offsetTaper = Math.pow(Math.cos(phase), 2);
      curve[i] = onSetBool ? onsetTaper : offsetTaper;
      j += 1 / this.sourceSamplingRate;
    }
    return curve;
  };

  static createInverseSCurveBuffer = (length, phase) => {
    const curve = new Float32Array(length);
    let i;
    let j = length - 1;
    for (i = 0; i < length; i += 1) {
      // scale the curve to be between 0-1
      curve[i] = Math.sin((Math.PI * j) / length - phase) / 2 + 0.5;
      j -= 1;
    }
    return curve;
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   *
   * @param dataBuffer
   * @private
   * @example
   */
  #createCalibrationNodeFromBuffer = dataBuffer => {
    console.log('length databuffer');
    console.log(dataBuffer.length);
    if (!this.sourceAudioContext) {
      this.makeNewSourceAudioContext();
    }

    const buffer = this.sourceAudioContext.createBuffer(
      1, // number of channels
      dataBuffer.length,
      this.sourceAudioContext.sampleRate // sample rate
    );

    const data = buffer.getChannelData(0); // get data

    // fill the buffer with our data
    try {
      for (let i = 0; i < dataBuffer.length; i += 1) {
        data[i] = dataBuffer[i];
      }
    } catch (error) {
      console.error(error);
    }

    this.sourceNode = this.sourceAudioContext.createBufferSource();

    this.sourceNode.buffer = buffer;

    if (this.mode === 'filtered') {
      //used to not loop filtered
      this.sourceNode.loop = true;
    } else {
      this.sourceNode.loop = true;
    }

    this.sourceNode.connect(this.sourceAudioContext.destination);

    this.addCalibrationNode(this.sourceNode);
  };

  /**
   * Given a data buffer, creates the required calibration node
   *
   * @param {*} dataBufferArray
   * @example
   */
  #setCalibrationNodesFromBuffer = (dataBufferArray = [this.#mlsBufferView[this.icapture]]) => {
    if (dataBufferArray.length === 1) {
      this.#createCalibrationNodeFromBuffer(dataBufferArray[0]);
    } else {
      throw new Error('The length of the data buffer array must be 1');
    }
  };

  /**
   * Creates an audio context and plays it for a few seconds.
   *
   * @private
   * @returns - Resolves when the audio is done playing.
   * @example
   */
  #playCalibrationAudio = () => {
    this.calibrationNodes[0].start(0);
    this.status = ``;
    if (this.mode === 'unfiltered') {
      console.log('play calibration audio ' + this.stepNum);
      this.addTimeStamp(`Play MLS version ${this.icapture}`);
      this.status = this.generateTemplate(`All Hz Calibration: playing the calibration tone...`.toString()).toString();
    } else if (this.mode === 'filtered') {
      console.log('play convolved audio ' + this.stepNum);
      this.status = this.generateTemplate().toString( `All Hz Calibration: playing the convolved calibration tone...`.toString());
    } else {
      throw new Error('Mode is incorrect');
    }
    this.emit('update', {message: this.status});
    this.stepNum += 1;
    console.log('sink sampling rate');
    console.log(this.sinkSamplingRate);
    console.log('source sampling rate');
    console.log(this.sourceSamplingRate);
    console.log('sample size');
    console.log(this.sampleSize);
  };

  /** .
   * .
   * .
   * Stops the audio with tapered offset
   *
   * @example
   */
  stopCalibrationAudio = () => {
    if (this.calibrationNodes.length === 0) {
      return;
    }
    this.calibrationNodes[0].stop(0);
    this.calibrationNodes = [];
    if (this.sourceNode) this.sourceNode.disconnect();
    this.stepNum += 1;
    console.log('stop calibration audio ' + this.stepNum);
    this.status = this.generateTemplate(`All Hz Calibration: stopping the calibration tone...`.toString()).toString();
    this.emit('update', {message: this.status});
  };

  playMLSwithIIR = async (stream, convolution) => {
    let checkRec = false;
    this.mode = 'filtered';
    console.log('play mls with iir');
    //this.invertedImpulseResponse = iir

    await this.calibrationSteps(
      stream,
      this.#playCalibrationAudio, // play audio func (required)
      this.#createCalibrationNodeFromBuffer(convolution), // before play func
      this.#awaitSignalOnset, // before record
      () => this.numSuccessfulCaptured < 2,
      this.#awaitDesiredMLSLength, // during record
      this.#afterMLSwIIRRecord, // after record
      this.mode,
      checkRec
    );
  };

  bothSoundCheck = async stream => {
    let iir_ir_and_plots;
    this.#currentConvolution = this.componentConvolution;
    this.filteredMLSRange.component.Min = findMinValue(this.#currentConvolution);
    this.filteredMLSRange.component.Max = findMaxValue(this.#currentConvolution);
    this.addTimeStamp('Play MLS with component IIR');
    this.soundCheck = 'component';
    if (this.isCalibrating) return null;
    await this.playMLSwithIIR(stream, this.#currentConvolution);
    this.stopCalibrationAudio();
    let component_conv_recs = this.getAllFilteredRecordedSignals();

    if (this.componentAttentuatorGainDB != 0) {
      let linearScaleAttenuation = Math.pow(10, this.componentAttentuatorGainDB / 20);
      component_conv_recs = component_conv_recs.map(rec => {
        return rec.map(value => value / this.linearScaleAttenuation);
      });
    }

    let return_component_conv_rec = component_conv_recs[component_conv_recs.length - 1];
    this.clearAllFilteredRecordedSignals();

    this.numSuccessfulCaptured = 0;
    this.#currentConvolution = this.systemConvolution;
    this.filteredMLSRange.system.Min = findMinValue(this.#currentConvolution);
    this.filteredMLSRange.system.Max = findMaxValue(this.#currentConvolution);
    this.soundCheck = 'system';
    this.addTimeStamp('Play MLS with system IIR');
    if (this.isCalibrating) return null;
    await this.playMLSwithIIR(stream, this.#currentConvolution);

    this.stopCalibrationAudio();

    let system_conv_recs = this.getAllFilteredRecordedSignals();

    if (this.systemAttenuatorGainDB != 0) {
      let linearScaleAttenuation = Math.pow(10, this.systemAttenuatorGainDB / 20);
      system_conv_recs = system_conv_recs.map(rec => {
        return rec.map(value => value / linearScaleAttenuation);
      });
    }

    let return_system_conv_rec = system_conv_recs[system_conv_recs.length - 1];
    // await this.checkPowerVariation(return_system_conv_rec);

    this.clearAllFilteredRecordedSignals();

    this.sourceAudioContext.close();
    let recs = this.getAllUnfilteredRecordedSignals();
    if (this.componentAttentuatorGainDB != 0) {
      let linearScaleAttenuation = Math.pow(10, this.componentAttentuatorGainDB / 20);
      recs = recs.map(rec => {
        return rec.map(value => value / this.linearScaleAttenuation);
      });
    }
    let unconv_rec = recs[0];
    let return_unconv_rec = unconv_rec;
    let conv_rec = component_conv_recs[component_conv_recs.length - 1];

    //psd of component
    let knownGain = this.oldComponentIR.Gain;
    let knownFreq = this.oldComponentIR.Freq;
    let sampleRate = this.sourceSamplingRate || 96000;
    this.addTimeStamp('Get PSD of MLS recording');
    if (this.isCalibrating) return null;
    let component_unconv_rec_psd = await this.pyServerAPI
      .getSubtractedPSDWithRetry(unconv_rec, knownGain, knownFreq, sampleRate)
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    this.addTimeStamp('Get PSD of filtered recording (component)');
    if (this.isCalibrating) return null;
    let component_conv_rec_psd = await this.pyServerAPI
      .getSubtractedPSDWithRetry(conv_rec, knownGain, knownFreq, sampleRate)
      .then(res => {
        let interpolatedGain = res.x.map((freq, index) => {
          let i = 0;
          while (i < knownFreq.length && knownFreq[i] < freq) {
            i++;
          }
          if (i === 0 || i === knownFreq.length) {
            return knownGain[i];
          }
          return interpolate(freq, knownFreq[i - 1], knownFreq[i], knownGain[i - 1], knownGain[i]);
        });

        let correctedGain = res.y.map(
          (gain, index) => 10 * Math.log10(gain) - interpolatedGain[index]
        );

        let filtered_psd = correctedGain.filter(
          (value, index) => res.x[index] >= this.#lowHz && res.x[index] <= this.componentFMaxHz
        );

        this.SDofFilteredRange['component'] = standardDeviation(filtered_psd);
        this.incrementStatusBar();
        this.status =this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    conv_rec = system_conv_recs[system_conv_recs.length - 1];
    //psd of system
    this.addTimeStamp('Get PSD of filtered recording (system) and unfiltered recording');
    if (this.isCalibrating) return null;
    let system_recs_psd = await this.pyServerAPI
      .getPSDWithRetry({
        unconv_rec,
        conv_rec,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        let filtered_psd = res.y_conv
          .filter(
            (value, index) => res.x_conv[index] >= this.#lowHz && res.x_conv[index] <= this.#highHz
          )
          .map(value => 10 * Math.log10(value));

        let mls_psd = res.y_unconv
          .filter(
            (value, index) =>
              res.x_unconv[index] >= this.#lowHz && res.x_conv[index] <= this.#highHz
          )
          .map(value => 10 * Math.log10(value));

        this.SDofFilteredRange['mls'] = standardDeviation(mls_psd);
        console.log('mls_psd', this.SDofFilteredRange['mls']);
        this.SDofFilteredRange['system'] = standardDeviation(filtered_psd);
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    //iir w/ and without bandpass psd. done
    unconv_rec = this.componentInvertedImpulseResponseNoBandpass;
    conv_rec = this.componentInvertedImpulseResponse;
    this.addTimeStamp('Get PSD of component IIR and component IIR no band pass');
    if (this.isCalibrating) return null;
    let component_iir_psd = await this.pyServerAPI
      .getPSDWithRetry({
        unconv_rec,
        conv_rec,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });
    unconv_rec = this.systemInvertedImpulseResponseNoBandpass;
    conv_rec = this.systemInvertedImpulseResponse;
    this.addTimeStamp('Get PSD of system IIR and system IIR no band pass');
    if (this.isCalibrating) return null;
    let system_iir_psd = await this.pyServerAPI
      .getPSDWithRetry({
        unconv_rec,
        conv_rec,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString() ).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    this.addTimeStamp('Get PSD of MLS sequence');
    if (this.isCalibrating) return null;
    let mls_psd = await this.pyServerAPI
      .getMLSPSDWithRetry({
        mls: this.#mlsBufferView[0],
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    this.addTimeStamp('Get PSD of filtered MLS (system)');
    if (this.isCalibrating) return null;
    let system_filtered_mls_psd = await this.pyServerAPI
      .getMLSPSDWithRetry({
        mls: this.systemConvolution,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString() ).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    let system_no_bandpass_filtered_mls_psd = await this.pyServerAPI
      .getMLSPSDWithRetry({
        mls: this.systemConvolution,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status =this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    this.addTimeStamp('Get PSD of filtered MLS (component)');
    if (this.isCalibrating) return null;
    let component_filtered_mls_psd = await this.pyServerAPI
      .getMLSPSDWithRetry({
        mls: this.componentConvolution,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString() ).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    let component_no_bandpass_filtered_mls_psd = await this.pyServerAPI
      .getMLSPSDWithRetry({
        mls: this.componentConvolutionNoBandpass,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        this.incrementStatusBar();
        this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString() ).toString();
        this.emit('update', {message: this.status});
        return res;
      })
      .catch(err => {
        console.error(err);
      });

    let gainValue = this.getGainDBSPL();

    iir_ir_and_plots = {
      filtered_recording: {
        component: return_component_conv_rec,
        system: return_system_conv_rec,
      },
      unfiltered_recording: this.getAllUnfilteredRecordedSignals()[0],
      system: {
        iir: this.systemInvertedImpulseResponse,
        iir_no_bandpass: this.systemInvertedImpulseResponseNoBandpass,
        ir: this.systemIR,
        iir_psd: {
          y: system_iir_psd['y_conv'],
          x: system_iir_psd['x_conv'],
          y_no_bandpass: system_iir_psd['y_unconv'],
          x_no_bandpass: system_iir_psd['x_unconv'],
        },
        filtered_mls_psd: {
          x: system_filtered_mls_psd['x_mls'],
          y: system_filtered_mls_psd['y_mls'],
        },
        filtered_no_bandpass_mls_psd: {
          x: system_no_bandpass_filtered_mls_psd['x_mls'],
          y: system_no_bandpass_filtered_mls_psd['y_mls'],
        },
        convolution: this.systemConvolution,
        convolutionNoBandpass: this.systemConvolutionNoBandpass,
        psd: {
          unconv: {
            x: system_recs_psd['x_unconv'],
            y: system_recs_psd['y_unconv'],
          },
          conv: {
            x: system_recs_psd['x_conv'],
            y: system_recs_psd['y_conv'],
          },
        },
      },
      component: {
        iir: this.componentInvertedImpulseResponse,
        iir_no_bandpass: this.componentInvertedImpulseResponseNoBandpass,
        ir: this.componentIR,
        ir_origin: this.componentIROrigin,
        ir_in_time_domain: this.componentIRInTimeDomain,
        iir_psd: {
          y: component_iir_psd['y_conv'],
          x: component_iir_psd['x_conv'],
          y_no_bandpass: component_iir_psd['y_unconv'],
          x_no_bandpass: component_iir_psd['x_unconv'],
        },
        filtered_mls_psd: {
          x: component_filtered_mls_psd['x_mls'],
          y: component_filtered_mls_psd['y_mls'],
        },
        filtered_no_bandpass_mls_psd: {
          x: component_no_bandpass_filtered_mls_psd['x_mls'],
          y: component_no_bandpass_filtered_mls_psd['y_mls'],
        },
        convolution: this.componentConvolution,
        convolutionNoBandpass: this.componentConvolutionNoBandpass,
        psd: {
          unconv: {
            x: component_unconv_rec_psd['x'],
            y: component_unconv_rec_psd['y'],
          },
          conv: {
            x: component_conv_rec_psd['x'],
            y: component_conv_rec_psd['y'],
          },
        },
        gainDBSPL: gainValue,
      },
      mls: this.#mlsBufferView,
      mls_psd: {
        x: mls_psd['x_mls'],
        y: mls_psd['y_mls'],
      },
      autocorrelations: this.autocorrelations,
      impulseResponses: [],
    };

    return iir_ir_and_plots;
  };

  singleSoundCheck = async stream => {
    let iir_ir_and_plots;
    if (this._calibrateSoundCheck != 'system') {
      this.#currentConvolution = this.componentConvolution;
      this.filteredMLSRange.component.Min = findMinValue(this.#currentConvolution);
      this.filteredMLSRange.component.Max = findMaxValue(this.#currentConvolution);
      this.addTimeStamp('Play MLS with component IIR');
      this.soundCheck = 'component';
      if (this.isCalibrating) return null;
      await this.playMLSwithIIR(stream, this.#currentConvolution);
      this.stopCalibrationAudio();
    } else {
      this.#currentConvolution = this.systemConvolution;
      this.filteredMLSRange.system.Min = findMinValue(this.#currentConvolution);
      this.filteredMLSRange.system.Max = findMaxValue(this.#currentConvolution);
      this.addTimeStamp('Play MLS with system IIR');
      this.soundCheck = 'system';
      if (this.isCalibrating) return null;
      await this.playMLSwithIIR(stream, this.#currentConvolution);
      this.stopCalibrationAudio();
    }
    let conv_recs = this.getAllFilteredRecordedSignals();
    if (this._calibrateSoundCheck == 'goal') {
      if (this.componentAttentuatorGainDB != 0) {
        let linearScaleAttenuation = Math.pow(10, this.componentAttentuatorGainDB / 20);
        conv_recs = conv_recs.map(rec => {
          return rec.map(value => value / this.linearScaleAttenuation);
        });
      }
    } else if (this._calibrateSoundCheck == 'system') {
      if (this.systemAttentuatorGainDB != 0) {
        let linearScaleAttenuation = Math.pow(10, this.systemAttentuatorGainDB / 20);
        conv_recs = conv_recs.map(rec => {
          return rec.map(value => value / this.linearScaleAttenuation);
        });
      }
    }

    //remove the filteredMLSAttenuation from the recorded signals
    // conv_recs = conv_recs.map(rec => {
    //   if (this.soundCheck === 'component') {
    //     return rec.map(value => value / this.filteredMLSAttenuation.component);
    //   }
    //   return rec.map(value => value / this.filteredMLSAttenuation.system);
    // });

    let recs = this.getAllUnfilteredRecordedSignals();
    if (this._calibrateSoundCheck == 'goal') {
      if (this.componentAttentuatorGainDB != 0) {
        let linearScaleAttenuation = Math.pow(10, this.componentAttentuatorGainDB / 20);
        recs = recs.map(rec => {
          return rec.map(value => value / this.linearScaleAttenuation);
        });
      }
    } else if (this._calibrateSoundCheck == 'system') {
      if (this.systemAttentuatorGainDB != 0) {
        let linearScaleAttenuation = Math.pow(10, this.systemAttentuatorGainDB / 20);
        recs = recs.map(rec => {
          return rec.map(value => value / this.linearScaleAttenuation);
        });
      }
    }
    this.clearAllFilteredRecordedSignals();
    console.log('Obtaining unfiltered recording from #allHzUnfilteredRecordings to calculate PSD');
    console.log('Obtaining filtered recording from #allHzFilteredRecordings to calculate PSD');
    let unconv_rec = recs[0];
    let return_unconv_rec = unconv_rec;
    let conv_rec = conv_recs[conv_recs.length - 1];
    let return_conv_rec = conv_rec;
    this.sourceAudioContext.close();
    if (this._calibrateSoundCheck != 'system') {
      let knownGain = this.oldComponentIR.Gain;
      let knownFreq = this.oldComponentIR.Freq;
      let sampleRate = this.sourceSamplingRate || 96000;
      this.addTimeStamp('Get PSD of MLS recording');
      if (this.isCalibrating) return null;
      let unconv_results = await this.pyServerAPI
        .getSubtractedPSDWithRetry(unconv_rec, knownGain, knownFreq, sampleRate)
        .then(res => {
          console.log(res);
          let mls_psd = res.y
            .filter(
              (value, index) => res.x[index] >= this.#lowHz && res.x[index] <= this.systemFMaxHz
            )
            .map(value => 10 * Math.log10(value));
          this.SDofFilteredRange['mls'] = standardDeviation(mls_psd);
          console.log('mls sd', this.SDofFilteredRange['mls']);
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      this.addTimeStamp('Get PSD recording of filtered recording (component)');
      if (this.isCalibrating) return null;
      let conv_results = await this.pyServerAPI
        .getSubtractedPSDWithRetry(conv_rec, knownGain, knownFreq, sampleRate)
        .then(res => {
          let interpolatedGain = res.x.map((freq, index) => {
            let i = 0;
            while (i < knownFreq.length && knownFreq[i] < freq) {
              i++;
            }
            if (i === 0 || i === knownFreq.length) {
              return knownGain[i];
            }
            return interpolate(
              freq,
              knownFreq[i - 1],
              knownFreq[i],
              knownGain[i - 1],
              knownGain[i]
            );
          });

          let correctedGain = res.y.map(
            (gain, index) => 10 * Math.log10(gain) - interpolatedGain[index]
          );
          let filtered_psd = correctedGain.filter(
            (value, index) => res.x[index] >= this.#lowHz && res.x[index] <= this.#highHz
          );

          this.SDofFilteredRange['component'] = standardDeviation(filtered_psd);
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      unconv_rec = this.componentInvertedImpulseResponseNoBandpass;
      conv_rec = this.componentInvertedImpulseResponse;
      this.addTimeStamp('Get PSD of component IIR and component IIR no bandpass');
      if (this.isCalibrating) return null;
      let component_iir_psd = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });
      unconv_rec = this.systemInvertedImpulseResponseNoBandpass;
      conv_rec = this.systemInvertedImpulseResponse;
      this.addTimeStamp('Get PSD of system IIR and system IIR no bandpass');
      if (this.isCalibrating) return null;
      let system_iir_psd = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      this.addTimeStamp('Get PSD of MLS sequence');
      if (this.isCalibrating) return null;
      let mls_psd = await this.pyServerAPI
        .getMLSPSDWithRetry({
          mls: this.#mlsBufferView[this.icapture],
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      this.addTimeStamp('Get PSD of filtered MLS (component)');
      if (this.isCalibrating) return null;
      let filtered_mls_psd = await this.pyServerAPI
        .getMLSPSDWithRetry({
          mls: this.componentConvolution,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      let filtered_no_bandpass_mls_psd = await this.pyServerAPI
        .getMLSPSDWithRetry({
          mls: this.componentConvolutionNoBandpass,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      let gainValue = this.getGainDBSPL();
      iir_ir_and_plots = {
        unfiltered_recording: return_unconv_rec,
        filtered_recording: return_conv_rec,
        system: {
          iir: this.systemInvertedImpulseResponse,
          iir_no_bandpass: this.systemInvertedImpulseResponseNoBandpass,
          ir: this.systemIR,
          iir_psd: {
            y: system_iir_psd['y_conv'],
            x: system_iir_psd['y_conv'],
            y_no_bandpass: system_iir_psd['y_unconv'],
            x_no_bandpass: system_iir_psd['x_unconv'],
          },
          filtered_recording: [],
          filtered_mls_psd: {},
          filtered_no_bandpass_mls_psd: {},
          convolution: this.systemConvolution,
          convolutionNoBandpass: this.systemConvolutionNoBandpass,
          psd: {
            unconv: {
              x: [],
              y: [],
            },
            conv: {
              x: [],
              y: [],
            },
          },
        },
        component: {
          iir: this.componentInvertedImpulseResponse,
          iir_no_bandpass: this.componentInvertedImpulseResponseNoBandpass,
          ir: this.componentIR,
          ir_origin: this.componentIROrigin,
          ir_in_time_domain: this.componentIRInTimeDomain,
          iir_psd: {
            y: component_iir_psd['y_conv'],
            x: component_iir_psd['x_conv'],
            y_no_bandpass: component_iir_psd['y_unconv'],
            x_no_bandpass: component_iir_psd['x_unconv'],
          },
          filtered_mls_psd: {
            x: filtered_mls_psd['x_mls'],
            y: filtered_mls_psd['y_mls'],
          },
          filtered_no_bandpass_mls_psd: {
            x: filtered_no_bandpass_mls_psd['x_mls'],
            y: filtered_no_bandpass_mls_psd['y_mls'],
          },
          convolution: this.componentConvolution,
          convolutionNoBandpass: this.componentConvolutionNoBandpass,
          psd: {
            unconv: {
              x: unconv_results['x'],
              y: unconv_results['y'],
            },
            conv: {
              x: conv_results['x'],
              y: conv_results['y'],
            },
          },
          gainDBSPL: gainValue,
        },
        mls: this.#mlsBufferView,
        mls_psd: {
          x: mls_psd['x_mls'],
          y: mls_psd['y_mls'],
        },
        autocorrelations: this.autocorrelations,
        impulseResponses: [],
      };
    } else {
      this.addTimeStamp('Get PSD of filtered recording (system) and unfiltered recording');
      if (this.isCalibrating) return null;
      let results = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          let filtered_psd = res.y_conv
            .filter(
              (value, index) =>
                res.x_conv[index] >= this.#lowHz && res.x_conv[index] <= this.systemFMaxHz
            )
            .map(value => 10 * Math.log10(value));

          let mls_psd = res.y_unconv
            .filter(
              (value, index) =>
                res.x_unconv[index] >= this.#lowHz && res.x_conv[index] <= this.systemFMaxHz
            )
            .map(value => 10 * Math.log10(value));
          this.SDofFilteredRange['mls'] = standardDeviation(mls_psd);
          this.SDofFilteredRange['system'] = standardDeviation(filtered_psd);
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      //iir w/ and without bandpass psd
      unconv_rec = this.componentInvertedImpulseResponseNoBandpass;
      conv_rec = this.componentInvertedImpulseResponse;
      this.addTimeStamp('Get PSD of component IIR and component IIR no band pass');
      if (this.isCalibrating) return null;
      let component_iir_psd = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });
      unconv_rec = this.systemInvertedImpulseResponseNoBandpass;
      conv_rec = this.systemInvertedImpulseResponse;
      this.addTimeStamp('Get PSD of system IIR and system IIR no band pass');
      if (this.isCalibrating) return null;
      let system_iir_psd = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate( `All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      this.addTimeStamp('Get PSD of MLS sequence');
      if (this.isCalibrating) return null;
      let mls_psd = await this.pyServerAPI
        .getMLSPSDWithRetry({
          mls: this.#mlsBufferView[this.icapture],
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      this.addTimeStamp('Get PSD of filtered MLS (system)');
      if (this.isCalibrating) return null;
      let filtered_mls_psd = await this.pyServerAPI
        .getMLSPSDWithRetry({
          mls: this.systemConvolution,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      let filtered_no_bandpass_mls_psd = await this.pyServerAPI
        .getMLSPSDWithRetry({
          mls: this.systemConvolutionNoBandpass,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      let gainValue = this.getGainDBSPL();
      iir_ir_and_plots = {
        unfiltered_recording: return_unconv_rec,
        filtered_recording: return_conv_rec,
        system: {
          iir: this.systemInvertedImpulseResponse,
          iir_no_bandpass: this.systemInvertedImpulseResponseNoBandpass,
          ir: this.systemIR,
          iir_psd: {
            y: system_iir_psd['y_conv'],
            x: system_iir_psd['y_conv'],
            y_no_bandpass: system_iir_psd['y_unconv'],
            x_no_bandpass: system_iir_psd['x_unconv'],
          },
          filtered_recording: [],
          filtered_mls_psd: {
            x: filtered_mls_psd['x_mls'],
            y: filtered_mls_psd['y_mls'],
          },
          filtered_no_bandpass_mls_psd: {
            x: filtered_no_bandpass_mls_psd['x_mls'],
            y: filtered_no_bandpass_mls_psd['y_mls'],
          },
          convolution: this.systemConvolution,
          convolutionNoBandpass: this.systemConvolutionNoBandpass,
          psd: {
            unconv: {
              x: results['x_unconv'],
              y: results['y_unconv'],
            },
            conv: {
              x: results['x_conv'],
              y: results['y_conv'],
            },
          },
        },
        component: {
          iir: this.componentInvertedImpulseResponse,
          iir_no_bandpass: this.componentInvertedImpulseResponseNoBandpass,
          ir: this.componentIR,
          ir_origin: this.componentIROrigin,
          ir_in_time_domain: this.componentIRInTimeDomain,
          iir_psd: {
            y: component_iir_psd['y_conv'],
            x: component_iir_psd['x_conv'],
            y_no_bandpass: component_iir_psd['y_unconv'],
            x_no_bandpass: component_iir_psd['x_unconv'],
          },
          filtered_mls_psd: {},
          filtered_no_bandpass_mls_psd: {},
          convolution: this.componentConvolution,
          convolutionNoBandpass: this.componentConvolutionNoBandpass,
          psd: {
            unconv: {
              x: [],
              y: [],
            },
            conv: {
              x: [],
              y: [],
            },
          },
          gainDBSPL: gainValue,
        },
        mls: this.#mlsBufferView,
        mls_psd: {
          x: mls_psd['x_mls'],
          y: mls_psd['y_mls'],
        },
        autocorrelations: this.autocorrelations,
        impulseResponses: [],
      };
    }
    if (this.isCalibrating) return null;
    await Promise.all(this.impulseResponses).then(res => {
      for (let i = 0; i < res.length; i++) {
        if (res[i] != undefined) {
          iir_ir_and_plots['impulseResponses'].push(res[i]);
        }
      }
    });

    if (this.#download) {
      this.downloadSingleUnfilteredRecording();
      this.downloadSingleFilteredRecording();
      saveToCSV(this.#mls, 'MLS.csv');
      saveToCSV(this.componentConvolution, 'python_component_convolution_mls_iir.csv');
      saveToCSV(this.systemConvolution, 'python_system_convolution_mls_iir.csv');
      saveToCSV(this.componentInvertedImpulseResponse, 'componentIIR.csv');
      saveToCSV(this.systemInvertedImpulseResponse, 'systemIIR.csv');
      for (let i = 0; i < this.autocorrelations.length; i++) {
        saveToCSV(this.autocorrelations[i], `autocorrelation_${i}`);
      }
      const computedIRagain = await Promise.all(this.impulseResponses).then(res => {
        for (let i = 0; i < res.length; i++) {
          if (res[i] != undefined) {
            saveToCSV(res[i], `IR_${i}`);
          }
        }
      });
    }

    return iir_ir_and_plots;
  };

  /**
   * Public method to start the calibration process. Objects intialized from webassembly allocate new memory
   * and must be manually freed. This function is responsible for intializing the MlsGenInterface,
   * and wrapping the calibration steps with a garbage collection safe gaurd.
   *
   * @public
   * @param stream - The stream of audio from the Listener.
   * @example
   */
  startCalibrationImpulseResponse = async stream => {
    console.log('JS used memory:', performance.memory.usedJSHeapSize / 1024 / 1024, 'mb');
    let desired_time = this.desired_time_per_mls;
    let checkRec = 'allhz';

    console.log('MLS sequence should be of length: ' + this.sourceSamplingRate * desired_time);

    length = this.sourceSamplingRate * desired_time;
    //get mls here
    // const calibrateSoundBurstDb = Math.pow(10, this._calibrateSoundBurstDb / 20);

    this.power_dB = 0;

    if (!this._calibrateSoundBurstLevelReTBool) {
      this.power_dB = this._calibrateSoundBurstDb;
    } else {
      this.power_dB = this._calibrateSoundBurstDb + (this.T - this.gainDBSPL);
    }

    const amplitude = Math.pow(10, this.power_dB / 20);
    //MLSpower = Math.pow(10,this.power_dB/20);
    this.addTimeStamp('Compute MLS sequence');
    if (this.isCalibrating) return null;
    await this.pyServerAPI
      .getMLSWithRetry({
        length,
        amplitude,
        calibrateSoundBurstMLSVersions: this.numCaptures,
      })
      .then(res => {
        console.log(res);
        this.#mlsBufferView = res['mls'];
        this.#mls = res['unscaledMLS'];
      })
      .catch(err => {
        // this.emit('InvertedImpulseResponse', {res: false});
        console.error(err);
      });
    this.numSuccessfulBackgroundCaptured = 0;
    if (this._calibrateSoundBackgroundSecs > 0) {
      this.mode = 'background';
      this.status = this.generateTemplate(`All Hz Calibration: sampling the background noise...`.toString()).toString();
      this.emit('update', {message: this.status});
      if (this.isCalibrating) return null;
      await this.recordBackground(
        stream, //stream
        () => this.numSuccessfulBackgroundCaptured < 1, //loop condition
        this.#awaitBackgroundNoiseRecording, //sleep to record
        this.sendBackgroundRecording, //send to get PSD
        this.mode,
        checkRec
      );
      this.incrementStatusBar();
    }
    this.mode = 'unfiltered';
    this.numSuccessfulCaptured = 0;

    if (this.isCalibrating) return null;
    for (var i = 0; i < this.numCaptures; i++) {
      this.icapture = i;
      await this.calibrationSteps(
        stream,
        this.#playCalibrationAudio, // play audio func (required)
        this.#createCalibrationNodeFromBuffer(this.#mlsBufferView[this.icapture]), // before play func
        this.#awaitSignalOnset, // before record
        () => this.numSuccessfulCaptured < 2, // loop while true
        this.#awaitDesiredMLSLength, // during record
        this.#afterMLSRecord, // after record
        this.mode,
        checkRec
      );
      this.stopCalibrationAudio();
    }
    checkRec = false;

    // at this stage we've captured all the required signals,
    // and have received IRs for each one
    // so let's send all the IRs to the server to be converted to a single IIR
    if (this.isCalibrating) return null;
    await this.sendSystemImpulseResponsesToServerForProcessing();
    await this.pyServerAPI.checkMemory();
    if (this.isCalibrating) return null;
    await this.sendComponentImpulseResponsesToServerForProcessing();

    this.numSuccessfulCaptured = 0;

    let iir_ir_and_plots;
    if (this._calibrateSoundCheck != 'none') {
      //do single check
      if (this._calibrateSoundCheck == 'goal' || this._calibrateSoundCheck == 'system') {
        if (this.isCalibrating) return null;
        iir_ir_and_plots = await this.singleSoundCheck(stream);
        if (this.isCalibrating) return null;
      } else {
        //both
        if (this.isCalibrating) return null;
        iir_ir_and_plots = await this.bothSoundCheck(stream);
        if (this.isCalibrating) return null;
      }
    } else {
      let unconv_rec = this.componentInvertedImpulseResponseNoBandpass;
      let conv_rec = this.componentInvertedImpulseResponse;
      if (this.isCalibrating) return null;
      let component_iir_psd = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });
      unconv_rec = this.systemInvertedImpulseResponseNoBandpass;
      conv_rec = this.systemInvertedImpulseResponse;
      if (this.isCalibrating) return null;
      let system_iir_psd = await this.pyServerAPI
        .getPSDWithRetry({
          unconv_rec,
          conv_rec,
          sampleRate: this.sourceSamplingRate || 96000,
        })
        .then(res => {
          this.incrementStatusBar();
          this.status = this.generateTemplate(`All Hz Calibration: done computing the PSD graphs...`.toString()).toString();
          this.emit('update', {message: this.status});
          return res;
        })
        .catch(err => {
          console.error(err);
        });

      let gainValue = this.getGainDBSPL();
      iir_ir_and_plots = {
        unfiltered_recording: return_unconv_rec,
        filtered_recording: return_conv_rec,
        system: {
          iir: this.systemInvertedImpulseResponse,
          iir_no_bandpass: this.systemInvertedImpulseResponseNoBandpass,
          ir: this.systemIR,
          iir_psd: {
            y: system_iir_psd['y_conv'],
            x: system_iir_psd['y_conv'],
            y_no_bandpass: system_iir_psd['y_unconv'],
            x_no_bandpass: system_iir_psd['x_unconv'],
          },
          filtered_recording: [],
          convolution: this.systemConvolution,
          convolutionNoBandpass: this.systemConvolutionNoBandpass,
          psd: {
            unconv: {
              x: [],
              y: [],
            },
            conv: {
              x: [],
              y: [],
            },
          },
        },
        component: {
          iir: this.componentInvertedImpulseResponse,
          iir_no_bandpass: this.componentInvertedImpulseResponseNoBandpass,
          ir: this.componentIR,
          ir_in_time_domain: this.componentIRInTimeDomain,
          iir_psd: {
            y: component_iir_psd['y_conv'],
            x: component_iir_psd['x_conv'],
            y_no_bandpass: component_iir_psd['y_unconv'],
            x_no_bandpass: component_iir_psd['x_unconv'],
          },
          convolution: this.componentConvolution,
          convolutionNoBandpass: this.componentConvolutionNoBandpass,
          psd: {
            unconv: {
              x: [],
              y: [],
            },
            conv: {
              x: [],
              y: [],
            },
          },
          gainDBSPL: gainValue,
        },
        mls: this.#mlsBufferView,
        autocorrelations: this.autocorrelations,
        impulseResponses: [],
      };
      if (this.isCalibrating) return null;
      await Promise.all(this.impulseResponses).then(res => {
        for (let i = 0; i < res.length; i++) {
          if (res[i] != undefined) {
            iir_ir_and_plots['impulseResponses'].push(res[i]);
          }
        }
      });

      if (this.#download) {
        saveToCSV(this.#mls, 'MLS.csv');
        saveToCSV(this.componentConvolution, 'python_component_convolution_mls_iir.csv');
        saveToCSV(this.systemConvolution, 'python_system_convolution_mls_iir.csv');
        saveToCSV(this.componentInvertedImpulseResponse, 'componentIIR.csv');
        saveToCSV(this.systemInvertedImpulseResponse, 'systemIIR.csv');
        for (let i = 0; i < this.autocorrelations.length; i++) {
          saveToCSV(this.autocorrelations[i], `autocorrelation_${i}`);
        }
        const computedIRagain = await Promise.all(this.impulseResponses).then(res => {
          for (let i = 0; i < res.length; i++) {
            if (res[i] != undefined) {
              saveToCSV(res[i], `IR_${i}`);
            }
          }
        });
      }
    }
    if (this.isCalibrating) return null;
    this.percent_complete = 100;
    this.status =  this.generateTemplate(`All Hz Calibration: Finished`.toString()).toString();
    this.emit('update', {message: this.status});

    //here after calibration we have the component calibration (either loudspeaker or microphone) in the same form as the componentIR
    //that was used to calibrate
    // saveToJSON(iir_ir_and_plots);
    return iir_ir_and_plots;
  };

  //////////////////////volume

  handleIncomingData = data => {
    console.log('Received data: ', data);
    if (data.type === 'soundGainDBSPL') {
      this.soundGainDBSPL = data.value;
    } else {
      throw new Error(`Unknown data type: ${data.type}`);
    }
  };

  #getTruncatedSignal = (left = 3.5, right = 4.5) => {
    const start = Math.floor(left * this.sourceSamplingRate);
    const end = Math.floor(right * this.sourceSamplingRate);
    const result = Array.from(this.getLastVolumeRecordedSignal().slice(start, end));
    console.log(
      'Obtaining last 1000 hz recording from #allVolumeRecordings to send for processing'
    );
    /**
     * function to check that capture was properly made
     * @param {*} list
     */
    const checkResult = list => {
      const setItem = new Set(list);
      if (setItem.size === 1 && setItem.has(0)) {
        console.warn(
          'The last capture failed, all recorded signal is zero',
          this.getAllVolumeRecordedSignals()
        );
        this.stopCalibrationAudio();
        this.isCalibrating = true;
        // restartButton.style.display = 'none';
        this.emit('update', {message: 'Connection failed, hit restart button to reconnect'});
      }
      if (setItem.size === 0) {
        console.warn('The last capture failed, no recorded signal');
        this.stopCalibrationAudio();
        this.isCalibrating = true;
        // restartButton.style.display = 'none';
        this.emit('update', {message: 'Connection failed, hit restart button to reconnect'});
      }
    };
    checkResult(result);
    return result;
  };

  /** 
   * 
   * 
    Construct a calibration Node with the calibration parameters and given gain value
   * @param {*} gainValue
   * */
  #createCalibrationToneWithGainValue = gainValue => {
    const audioContext = this.makeNewSourceAudioContext();
    const oscilator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const taperGainNode = audioContext.createGain();
    const offsetGainNode = audioContext.createGain();
    const totalDuration = this.CALIBRATION_TONE_DURATION * 1.2;

    oscilator.frequency.value = this.#CALIBRATION_TONE_FREQUENCY;
    oscilator.type = this.#CALIBRATION_TONE_TYPE;
    gainNode.gain.value = gainValue;

    oscilator.connect(gainNode);
    gainNode.connect(taperGainNode);
    const onsetCurve = this.createSCurveBuffer();
    taperGainNode.gain.setValueCurveAtTime(onsetCurve, 0, this.TAPER_SECS);
    taperGainNode.connect(offsetGainNode);
    const offsetCurve = this.createSCurveBuffer(false);
    offsetGainNode.gain.setValueCurveAtTime(
      offsetCurve,
      totalDuration - this.TAPER_SECS,
      this.TAPER_SECS
    );
    offsetGainNode.connect(audioContext.destination);

    const gainValuesOverTime = [];
    const sampleRate = this.#CALIBRATION_TONE_FREQUENCY; // Number of samples per second
    const interval = 1 / sampleRate; // Time between samples

    for (let t = 0; t <= totalDuration; t += interval) {
      let gainValueAtTime = gainValue;

      // Apply the onset curve
      if (t < this.TAPER_SECS) {
        const onsetIndex = Math.floor((t / this.TAPER_SECS) * onsetCurve.length);
        gainValueAtTime *= onsetCurve[onsetIndex];
      }

      // Apply the offset curve
      if (t > totalDuration - this.TAPER_SECS) {
        const offsetTime = t - (totalDuration - this.TAPER_SECS);
        const offsetIndex = Math.floor((offsetTime / this.TAPER_SECS) * offsetCurve.length);
        gainValueAtTime *= offsetCurve[offsetIndex];
      }

      gainValuesOverTime.push(gainValueAtTime);
    }

    this.waveforms['volume'][this.inDB] = gainValuesOverTime;

    this.addCalibrationNode(oscilator);
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   *
   * @private
   * @example
   */
  #createCalibrationNode = () => {
    const audioContext = this.makeNewSourceAudioContext();
    const oscilator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscilator.frequency.value = this.#CALIBRATION_TONE_FREQUENCY;
    oscilator.type = this.#CALIBRATION_TONE_TYPE;
    gainNode.gain.value = 0.04;

    oscilator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    this.addCalibrationNode(oscilator);
  };

  #playCalibrationAudioVolume = async () => {
    if (this.numCalibratingRoundsCompleted==1) {
      this.recordingChecks['warnings'].push(`Redo 1000 Hz, ${this.inDB} dB, recording because SD ${(this.recordingChecks['volume'][this.inDB]['sd'])} dB> ${this.calibrateSound1000HzMaxSD_dB} dB`);
      const currentStatus =  `Redoing 1000 Hz recording because SD 
      ${this.recordingChecks['volume'][this.inDB]['sd']} dB> 
      ${this.calibrateSound1000HzMaxSD_dB} dB`.toString();
      this.status = this.generateTemplate(currentStatus).toString();
      this.emit('update', {
        message: this.status,
      });
    }
    const totalDuration = this.CALIBRATION_TONE_DURATION * 1.2;

    this.calibrationNodes[0].start(0);
    this.calibrationNodes[0].stop(totalDuration);
    console.log(`Playing a buffer of ${this.CALIBRATION_TONE_DURATION} seconds of audio`);
    console.log(`Waiting a total of ${totalDuration} seconds`);
    await sleep(totalDuration);
  };

  stopCalibrationAudioVolume = () => {
    if (this.calibrationNodes.length > 0) {
      this.calibrationNodes[0].stop();
    }
  };

  #sendToServerForProcessing = async lCalib => {
    console.log('Sending data to server');
    const total_dur = this.calibrateSound1000HzPreSec + this.calibrateSound1000HzSec + this.calibrateSound1000HzPostSec;
    this.addTimeStamp("Record " + total_dur.toFixed(1) + " s of 1000 Hz at " + this.inDB + 
      " dB. (" + this.calibrateSound1000HzPreSec.toFixed(1) + 
      " s pre + " + this.calibrateSound1000HzSec.toFixed(1) + 
      " s used + " + this.calibrateSound1000HzPostSec.toFixed(1) + 
      " s post)"
    );
    let left = this.calibrateSound1000HzPreSec;
    let right = this.calibrateSound1000HzPreSec + this.calibrateSound1000HzSec;
    if (this.isCalibrating) return null;
    this.pyServerAPI
      .getVolumeCalibration({
        sampleRate: this.sourceSamplingRate,
        payload: this.#getTruncatedSignal(left, right),
        lCalib: lCalib,
      })
      .then(res => {
        if (this.outDBSPL === null) {
          this.incrementStatusBar();
          this.outDBSPL = res['outDbSPL'];
          this.outDBSPL1000 = res['outDbSPL1000'];
          this.THD = res['thd'];
        }
      })
      .catch(err => {
        console.warn(err);
      });
      const rec = this.getLastVolumeRecordedSignal();
      console.log('pre period power: ', getPower(rec.slice(0,this.calibrateSound1000HzPreSec * this.sourceSamplingRate)).toFixed(1));
      console.log('pre period power: ', 
        getPower(rec.slice(
          this.calibrateSound1000HzPreSec * this.sourceSamplingRate,
          (this.calibrateSound1000HzPreSec + this.calibrateSound1000HzSec)* this.sourceSamplingRate)).toFixed(1));
      console.log('pre period power: ', getPower(rec.slice(
        (this.calibrateSound1000HzPreSec + this.calibrateSound1000HzSec)* this.sourceSamplingRate)).toFixed(1));
     const res =  volumePowerCheck(
      rec,
      this.sourceSamplingRate || 96000,
      this.calibrateSound1000HzPreSec,
      this.calibrateSound1000HzSec, 
      this._calibrateSoundPowerBinDesiredSec);
     console.log(res);
     this.recordingChecks['volume'][this.inDB] = res;
  };

  startCalibrationVolume = async (stream, gainValues, lCalib, componentGainDBSPL) => {
    if (this.isCalibrating) return null;
    const trialIterations = gainValues.length;
    this.status_denominator += trialIterations;
    const thdValues = [];
    const inDBValues = [];
    let inDB = 0;
    const outDBSPLValues = [];
    const outDBSPL1000Values = [];
    let checkRec = 'loudest';
    // do one calibration that will be discarded
    const soundLevelToDiscard = -60;
    const gainToDiscard = Math.pow(10, soundLevelToDiscard / 20);
    this.inDB = soundLevelToDiscard;
    this.status = this.generateTemplate(`1000 Hz Calibration: Sound Level ${soundLevelToDiscard} dB`.toString()).toString();
    //this.emit('update', {message: `1000 Hz Calibration: Sound Level ${soundLevelToDiscard} dB`});
    this.emit('update', {message: this.status});
    this.startTime = new Date().getTime();

    do {
      console.log('while loop');
      if (this.isCalibrating) {
        console.log('restart calibration');
        return null;
      }
      // eslint-disable-next-line no-await-in-loop
      await this.volumeCalibrationSteps(
        stream,
        this.#playCalibrationAudioVolume,
        this.#createCalibrationToneWithGainValue,
        this.#sendToServerForProcessing,
        gainToDiscard,
        lCalib, //todo make this a class parameter
        checkRec,
        () => {return this.recordingChecks['volume'][this.inDB]['sd']},
        this.calibrateSound1000HzMaxSD_dB
      );
    } while (this.outDBSPL === null);
    //reset the values
    //this.incrementStatusBar();

    this.outDBSPL = null;
    this.outDBSPL = null;
    this.outDBSPL1000 = null;
    this.THD = null;

    // run the calibration at different gain values provided by the user
    for (let i = 0; i < trialIterations; i++) {
      //convert gain to DB and add to inDB
      if (i == trialIterations - 1) {
        checkRec = 'loudest';
      }
      inDB = Math.log10(gainValues[i]) * 20;
      // precision to 1 decimal place
      inDB = Math.round(inDB * 10) / 10;
      this.inDB = inDB;
      inDBValues.push(inDB);
      console.log('next update');
      this.status = this.generateTemplate(`1000 Hz Calibration: Sound Level ${inDB} dB`.toString()).toString();
      this.emit('update', {message: this.status});
      do {
        if (this.isCalibrating) {
          console.log('restart calibration');
          return null;
        }
        // eslint-disable-next-line no-await-in-loop
        await this.volumeCalibrationSteps(
          stream,
          this.#playCalibrationAudioVolume,
          this.#createCalibrationToneWithGainValue,
          this.#sendToServerForProcessing,
          gainValues[i],
          lCalib, //todo make this a class parameter
          checkRec,
          () => {return this.recordingChecks?.['volume']?.[this.inDB]?.['sd'] || 0},
          this.calibrateSound1000HzMaxSD_dB
        );
      } while (this.outDBSPL === null);
      outDBSPL1000Values.push(this.outDBSPL1000);
      thdValues.push(this.THD);
      outDBSPLValues.push(this.outDBSPL);

      this.outDBSPL = null;
      this.outDBSPL1000 = null;
      this.THD = null;
    }
    if (this.isCalibrating) return null;
    // get the volume calibration parameters from the server
    this.addTimeStamp('Get sound calibration parameters');

    const parameters = await this.pyServerAPI
      .getVolumeCalibrationParameters({
        inDBValues: inDBValues,
        outDBSPLValues: outDBSPL1000Values,
        lCalib: lCalib,
        componentGainDBSPL,
      })
      .then(res => {
        this.incrementStatusBar();
        return res;
      });
    if (this.isCalibrating) return null;
    const result = {
      parameters: parameters,
      inDBValues: inDBValues,
      outDBSPLValues: outDBSPLValues,
      outDBSPL1000Values: outDBSPL1000Values,
      thdValues: thdValues,
    };

    return result;
  };

  writeFrqGainToFirestore = async (speakerID, frq, gain, OEM, documentID) => {
    // freq and gain are too large to take samples 1 in every 100 samples
    // const sampledFrq = [];
    // const sampledGain = [];
    // for (let i = 0; i < frq.length; i += 100) {
    //   sampledFrq.push(frq[i]);
    //   sampledGain.push(gain[i]);
    // }

    const data = {Freq: frq, Gain: gain};

    const docRef = doc(database, 'Microphones', documentID);
    await updateDoc(docRef, {
      linear: data,
    });

    // divide frq and gain into smaller chunks and write to firestore one chunk at a time
    // use arrayUnion to append to the array
    // const chunkSize = 600;
    // const chunkedFrq = [];
    // const chunkedGain = [];
    // for (let i = 0; i < frq.length; i += chunkSize) {
    //   chunkedFrq.push(frq.slice(i, i + chunkSize));
    //   chunkedGain.push(gain.slice(i, i + chunkSize));
    // }
    // const docRef = doc(database, 'Microphones', documentID);
    // for (let i = 0; i < chunkedFrq.length; i++) {
    //   await updateDoc(docRef, {
    //     linear: {
    //       Freq: arrayUnion(...chunkedFrq[i]),
    //       Gain: arrayUnion(...chunkedGain[i]),
    //     },
    //   });
    // }
  };
  // function to write frq and gain to firebase database given speakerID
  writeFrqGain = async (speakerID, frq, gain, OEM) => {
    // freq and gain are too large to take samples 1 in every 100 samples

    const sampledFrq = [];
    const sampledGain = [];
    for (let i = 0; i < frq.length; i += 100) {
      sampledFrq.push(frq[i]);
      sampledGain.push(gain[i]);
    }

    const data = {Freq: sampledFrq, Gain: sampledGain};

    await set(ref(database, `Microphone2/${OEM}/${speakerID}/linear`), data);
  };

  // Function to Read frq and gain from firebase database given speakerID
  // returns an array of frq and gain if speakerID exists, returns null otherwise
  readFrqGainFromFirestore = async (speakerID, OEM, isDefault) => {
    const collectionRef = collection(database, 'Microphones');
    const q = query(
      collectionRef,
      where('ID', '==', speakerID),
      where('lowercaseOEM', '==', OEM),
      where('isDefault', '==', isDefault)
    );
    const querySnapshot = await getDocs(q);
    // if exists return the linear field of the first document
    if (querySnapshot.size > 0) {
      const timestamp = new Timestamp(
        querySnapshot.docs[0].data().createDate.seconds,
        querySnapshot.docs[0].data().createDate.nanoseconds
      );
      return {
        ir: querySnapshot.docs[0].data().linear,
        createDate: timestamp.toDate(),
        jsonFileName: querySnapshot.docs[0].data().jsonFileName,
      };
    }
    return null;
  };
  readFrqGain = async (speakerID, OEM) => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `Microphone2/${OEM}/${speakerID}/linear`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  };
  readGainat1000HzFromFirestore = async (speakerID, OEM, isDefault) => {
    const collectionRef = collection(database, 'Microphones');
    const q = query(
      collectionRef,
      where('ID', '==', speakerID),
      where('lowercaseOEM', '==', OEM),
      where('isDefault', '==', isDefault)
    );
    const querySnapshot = await getDocs(q);
    // if exists return the Gain1000 field of the first document
    if (querySnapshot.size > 0) {
      return querySnapshot.docs[0].data().Gain1000;
    }
    return null;
  };

  readGainat1000Hz = async (speakerID, OEM) => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `Microphone2/${OEM}/${speakerID}/Gain1000`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  };

  writeGainat1000HzToFirestore = async (speakerID, gain, OEM, documentID) => {
    const docRef = doc(database, 'Microphones', documentID);
    await updateDoc(docRef, {
      Gain1000: gain,
    });
  };

  writeGainat1000Hz = async (speakerID, gain, OEM) => {
    await set(ref(database, `Microphone2/${OEM}/${speakerID}/Gain1000`), gain);
  };

  writeIsSmartPhoneToFirestore = async (speakerID, isSmartPhone, OEM) => {
    const collectionRef = collection(database, 'Microphones');
    const q = query(
      collectionRef,
      where('ID', '==', speakerID),
      where('lowercaseOEM', '==', OEM),
      where('isDefault', '==', true)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.size > 0) {
      const docRef = await addDoc(collectionRef, {isSmartPhone: isSmartPhone, isDefault: false});
      return docRef.id;
    } else {
      const docRef = await addDoc(collectionRef, {isSmartPhone: isSmartPhone, isDefault: true});
      return docRef.id;
    }
  };

  writeIsSmartPhone = async (speakerID, isSmartPhone, OEM) => {
    const data = {isSmartPhone: isSmartPhone};
    await set(ref(database, `Microphone2/${OEM}/${speakerID}/isSmartPhone`), isSmartPhone);
  };

  writeMicrophoneInfoToFirestore = async (speakerID, micInfo, OEM, documentID) => {
    const docRef = doc(database, 'Microphones', documentID);
    await setDoc(docRef, micInfo, {merge: true});
  };

  doesMicrophoneExistInFirestore = async (speakerID, OEM, documentID) => {
    const docRef = doc(database, 'Microphone', OEM, speakerID, documentID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return true;
    }
    return false;
  };

  doesMicrophoneExist = async (speakerID, OEM) => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `Microphone2/${OEM}/${speakerID}`));
    if (snapshot.exists()) {
      return true;
    }
    return false;
  };

  addMicrophoneInfo = async (speakerID, OEM, micInfo) => {
    // add to database if /info does not exist
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `Microphone2/${OEM}/${speakerID}/info`));
    if (!snapshot.exists()) {
      await set(ref(database, `Microphone2/${OEM}/${speakerID}/info`), micInfo);
    }
  };

  convertToDB = gain => {
    return Math.log10(gain) * 20;
  };

  // Function to perform linear interpolation between two points
  interpolate(x, x0, y0, x1, y1) {
    return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }

  findGainatFrequency = (frequencies, gains, targetFrequency) => {
    // Find the index of the first frequency in the array greater than the target frequency
    let index = 0;
    while (index < frequencies.length && frequencies[index] < targetFrequency) {
      index++;
    }

    // Handle cases when the target frequency is outside the range of the given data
    if (index === 0) {
      return gains[0];
    } else if (index === frequencies.length) {
      return gains[gains.length - 1];
    } else {
      // Interpolate the gain based on the surrounding frequencies
      const x0 = frequencies[index - 1];
      const y0 = gains[index - 1];
      const x1 = frequencies[index];
      const y1 = gains[index];
      return this.interpolate(targetFrequency, x0, y0, x1, y1);
    }
  };

  checkPowerVariation = async () => {
    let recordings = this.getAllFilteredRecordedSignals();
    // remove filteredMLSAttenuation from the recordings

    // recordings = recordings.map(recording => {
    //   if (this.soundCheck == 'component') {
    //     return recording.map(value => value / this.filteredMLSAttenuation.component);
    //   }
    //   return recording.map(value => value / this.filteredMLSAttenuation.system);
    // });

    const rec = recordings[recordings.length - 1];

    await this.pyServerAPI
      .allHzPowerCheck({
        payload: rec,
        sampleRate: this.sourceSamplingRate || 96000,
        binDesiredSec: this._calibrateSoundPowerBinDesiredSec,
        burstSec: this.desired_time_per_mls,
        repeats: this.numMLSPerCapture - this.num_mls_to_skip ,
        warmUp: this.num_mls_to_skip 
      })
      .then(result => {
        if (result) {
          if (result['sd'] > this._calibrateSoundBurstMaxSD_dB && this.numSuccessfulCaptured == 0) {
            console.log('filtered recording sd too high');
            this.recordingChecks['warnings'].push(`Redo all Hz recording because SD ${result['sd']} dB> ${this._calibrateSoundBurstMaxSD_dB} dB`);
            this.status = this.generateTemplate(`Redoing all Hz recording because SD ${result['sd']} dB> ${this._calibrateSoundBurstMaxSD_dB} dB`.toString()).toString();
            this.emit('update', {
              message: this.status,
            });
            // numSuccessfulCaptured no longer to count number of successful capture but count attemps
            // is sd below _calibrateSoundBurstMaxSD_dB then count two attemps
            // else count one attemp
            this.numSuccessfulCaptured += 1;
          } else {
            this.recordingChecks[this.soundCheck].push(result);
            // Now we do at most 2 attempts if sd > _calibrateSoundBurstMaxSD_dB
            // Second attempt is the final
            if (this.numSuccessfulCaptured < 2) {
              this.numSuccessfulCaptured += 2;
              this.stepNum += 1;
              this.incrementStatusBar();
              console.log(
                'after mls w iir record for some reason add numSucc capt ' + this.stepNum
              );
              this.status = this.generateTemplate(`All Hz Calibration: ${this.numSuccessfulCaptured} recording of convolved MLS captured`.toString()).toString();
              this.emit('update', {
                message: this.status,
              });
            }
          }
        }
      });
  };

  getGainDBSPL = () => {
    var freqIndex = this.componentIR.Freq.indexOf(1000);

    // If freqIndex is not -1 (meaning 1000 is found in the freq array)
    if (freqIndex !== -1) {
      // Get the corresponding gain value using the index
      var gainValue = this.componentIR.Gain[freqIndex];
      return gainValue;
    } else {
      console.log('Freq 1000 not found in the array.');
      return null;
    }
  };
  // Example of how to use the writeFrqGain and readFrqGain functions
  // writeFrqGain('speaker1', [1, 2, 3], [4, 5, 6]);
  // Speaker1 is the speakerID  you want to write to in the database
  // readFrqGain('MiniDSPUMIK_1').then(data => console.log(data));
  // MiniDSPUMIK_1 is the speakerID with some Data in the database
  //adding gainDBSPL
  startCalibration = async (
    stream,
    gainValues,
    lCalib = 104.92978421490648,
    componentIR = null,
    microphoneName = 'MiniDSP-UMIK1-711-4754-vertical',
    _calibrateSoundCheck = 'goal', //GOAL PASSed in by default
    isSmartPhone = false,
    _calibrateSoundBurstDb = -18,
    _calibrateSoundBurstFilteredExtraDb = 6,
    _calibrateSoundBurstLevelReTBool = false,
    _calibrateSoundBurstUses1000HzGainBool = false,
    _calibrateSoundBurstRepeats = 3,
    _calibrateSoundBurstSec = 1,
    _calibrateSoundBurstPreSec = 1,
    _calibrateSoundBurstPostSec = 1,
    _calibrateSoundHz = 48000,
    _calibrateSoundIRSec = 0.2,
    _calibrateSoundIIRSec = 0.2,
    _calibrateSoundIIRPhase = 'linear',
    calibrateSound1000HzPreSec = 0.5,
    calibrateSound1000HzSec = 0.5,
    calibrateSound1000HzPostSec = 0.5,
    _calibrateSoundBackgroundSecs = 0,
    _calibrateSoundSmoothOctaves = 0.33,
    _calibrateSoundSmoothMinBandwidthHz = 200,
    _calibrateSoundPowerBinDesiredSec = 0.2,
    _calibrateSoundPowerDbSDToleratedDb = 1,
    _calibrateSoundTaperSec = 0.01,
    micManufacturer = '',
    micSerialNumber = '',
    micModelNumber = '',
    micModelName = '',
    calibrateMicrophonesBool,
    authorEmails,
    webAudioDeviceNames = {
      loudspeaker: 'loudspeaker',
      microphone: 'microphone',
      microphoneText: 'xxx XXX',
    },
    userIDs,
    restartButton,
    reminder,
    calibrateSoundLimit,
    _calibrateSoundBurstNormalizeBy1000HzGainBool = false,
    _calibrateSoundBurstScalarDB = 71,
    calibrateSound1000HzMaxSD_dB = 4,
    _calibrateSoundBurstMaxSD_dB = 4,
    calibrateSoundSamplingDesiredBits = 24,
    language,
    loudspeakerModelName='',

  ) => {
    this.micModelName = micModelName,
    this.loudspeakerModelName = loudspeakerModelName;
    this.language = language;
    this.TAPER_SECS = _calibrateSoundTaperSec;
    this.calibrateSoundLimit = calibrateSoundLimit;
    this._calibrateSoundBurstDb = _calibrateSoundBurstDb;
    this._calibrateSoundBurstFilteredExtraDb = _calibrateSoundBurstFilteredExtraDb;
    this._calibrateSoundBurstLevelReTBool = _calibrateSoundBurstLevelReTBool;
    this.CALIBRATION_TONE_DURATION =
      calibrateSound1000HzPreSec + calibrateSound1000HzSec + calibrateSound1000HzPostSec;
    this.calibrateSound1000HzPreSec = calibrateSound1000HzPreSec;
    this.calibrateSound1000HzSec = calibrateSound1000HzSec;
    this.calibrateSound1000HzPostSec = calibrateSound1000HzPostSec;
    this.iirLength = Math.floor(_calibrateSoundIIRSec * this.sourceSamplingRate);
    this.irLength = Math.floor(_calibrateSoundIRSec * this.sourceSamplingRate);
    this.calibrateSoundIIRPhase = _calibrateSoundIIRPhase;
    this.num_mls_to_skip = Math.ceil(_calibrateSoundBurstPreSec / _calibrateSoundBurstSec);
    this._calibrateSoundBurstPostSec = _calibrateSoundBurstPostSec;
    this.numMLSPerCapture = _calibrateSoundBurstRepeats + this.num_mls_to_skip;
    this.desired_time_per_mls = _calibrateSoundBurstSec;
    this.desired_sampling_rate = _calibrateSoundHz;
    this._calibrateSoundBackgroundSecs = _calibrateSoundBackgroundSecs;
    this._calibrateSoundSmoothOctaves = _calibrateSoundSmoothOctaves;
    this._calibrateSoundSmoothMinBandwidthHz = _calibrateSoundSmoothMinBandwidthHz;
    this._calibrateSoundPowerBinDesiredSec = _calibrateSoundPowerBinDesiredSec;
    this._calibrateSoundBurstUses1000HzGainBool = _calibrateSoundBurstUses1000HzGainBool;
    this._calibrateSoundPowerDbSDToleratedDb = _calibrateSoundPowerDbSDToleratedDb;
    this._calibrateSoundBurstNormalizeBy1000HzGainBool =
      _calibrateSoundBurstNormalizeBy1000HzGainBool;
    this._calibrateSoundBurstScalarDB = _calibrateSoundBurstScalarDB;
    this.webAudioDeviceNames = webAudioDeviceNames;
    this.calibrateSoundSamplingDesiredBits = calibrateSoundSamplingDesiredBits;
    if (isSmartPhone) this.webAudioDeviceNames.microphone = this.deviceInfo.microphoneFromAPI;
    // this.webAudioDeviceNames.microphoneText = this.webAudioDeviceNames.microphoneText
    //   .replace('xxx', this.webAudioDeviceNames.microphone)
    //   .replace('XXX', this.webAudioDeviceNames.microphone);
    //feed calibration goal here
    this._calibrateSoundCheck = _calibrateSoundCheck;
    this.calibrateSound1000HzMaxSD_dB = calibrateSound1000HzMaxSD_dB;
    this._calibrateSoundBurstMaxSD_dB = _calibrateSoundBurstMaxSD_dB;
    //check if a componentIR was given to the system, if it isn't check for the microphone. using dummy data here bc we need to
    //check the db based on the microphone currently connected

    //new lCalib found at top of calibration files *1000hz, make sure to correct
    //based on zeroing of 1000hz, search for "*1000Hz"
    const ID = isSmartPhone ? micModelNumber : micSerialNumber;
    const OEM = isSmartPhone
      ? micModelName === 'UMIK-1' || micModelName === 'UMIK-2'
        ? 'minidsp'
        : this.deviceInfo.OEM.toLowerCase().split(' ').join('')
      : micManufacturer.toLowerCase().split(' ').join('');
    // const ID = "712-5669";
    // const OEM = "minidsp";
    const micInfo = {
      micModelName: isSmartPhone ? micModelName : microphoneName,
      OEM: isSmartPhone
        ? micModelName === 'UMIK-1' || micModelName === 'UMIK-2'
          ? 'miniDSP'
          : this.deviceInfo.OEM
        : micManufacturer,
      ID: ID,
      createDate: new Date(),
      DateText: getCurrentTimeString(),
      HardwareName: isSmartPhone ? this.deviceInfo.hardwarename : microphoneName,
      hardwareFamily: isSmartPhone ? this.deviceInfo.hardwarefamily : microphoneName,
      HardwareModel: isSmartPhone ? this.deviceInfo.hardwaremodel : microphoneName,
      PlatformName: isSmartPhone ? this.deviceInfo.platformname : 'N/A',
      PlatformVersion: isSmartPhone ? this.deviceInfo.platformversion : 'N/A',
      DeviceType: isSmartPhone ? this.deviceInfo.devicetype : 'N/A',
      ID_from_51Degrees: isSmartPhone ? this.deviceInfo.DeviceId : 'N/A',
      calibrateMicrophonesBool: calibrateMicrophonesBool,
      screenHeight: this.deviceInfo.screenHeight,
      screenWidth: this.deviceInfo.screenWidth,
      webAudioDeviceNames: {
        loudspeaker: this.webAudioDeviceNames.loudspeaker,
        microphone: this.webAudioDeviceNames.microphone,
      },
      userIDs: userIDs,
      lowercaseOEM: OEM.toLowerCase().split(' ').join(''),
    };
    if (calibrateMicrophonesBool) {
      micInfo['authorEmails'] = authorEmails;
    }
    // if undefined in micInfo, set to empty string
    for (const [key, value] of Object.entries(micInfo)) {
      if (value === undefined) {
        micInfo[key] = '';
      }
    }

    // this.writeMicrophoneInfoToFirestore(ID, micInfo, OEM, 'default');
    // this.addMicrophoneInfo(ID, OEM, micInfo);
    if (componentIR == null) {
      //mode 'ir'
      //global variable this.componentIR must be set
      await this.readFrqGainFromFirestore(ID, OEM, true).then(data => {
        if (data !== null) {
          this.componentIR = data.ir;
          micInfo['parentTimestamp'] = data.createDate ? data.createDate : new Date();
          micInfo['parentFilenameJSON'] = data.jsonFileName ? data.jsonFileName : '';
        }
      });

      // await this.readFrqGain(ID, OEM).then(data => {
      //   return data;
      // });

      // lCalib = await this.readGainat1000Hz(ID, OEM);
      lCalib = await this.readGainat1000HzFromFirestore(ID, OEM, true);
      micInfo['gainDBSPL'] = lCalib;
      // this.componentGainDBSPL = this.convertToDB(lCalib);
      this.componentGainDBSPL = lCalib;
      //TODO: if this call to database is unknown, cannot perform experiment => return false
      if (this.componentIR == null) {
        this.status =
          `Microphone (${OEM},${ID}) is not found in the database. Please add it to the database.`.toString();
        this.emit('update', {message: this.status});
        return false;
      }
    } else {
      this.transducerType = 'Microphone';
      this.componentIR = componentIR;
      lCalib = this.findGainatFrequency(this.componentIR.Freq, this.componentIR.Gain, 1000);
      // this.componentGainDBSPL = this.convertToDB(lCalib);
      this.componentGainDBSPL = lCalib;
      // await this.writeIsSmartPhone(ID, isSmartPhone, OEM);
    }

    this.oldComponentIR = JSON.parse(JSON.stringify(this.componentIR));

    return await new Promise(async (resolve, reject) => {
      // add event listner to params.restartButton to resolve the promise with a string: 'restart'

      if (reminder) {
        reminder.style.display = '';
      }
      if (restartButton) {
        restartButton.style.display = '';
        restartButton.addEventListener('click', () => {
          this.stopCalibrationAudio();
          this.isCalibrating = true;
          restartButton.style.display = 'none';
          if (reminder) {
            reminder.style.display = 'none';
          }
          this.emit('update', {message: 'Restarting calibration...'});
          resolve('restart');
        });
      }
      await this.pyServerAPI.checkMemory();
      // calibrate volume

      let volumeResults = await this.startCalibrationVolume(
        stream,
        gainValues,
        lCalib,
        this.componentGainDBSPL
      );
      if (!volumeResults) return;
      this.T = volumeResults['parameters']['T'];
      this.gainDBSPL = volumeResults['parameters']['gainDBSPL'];

      // end calibrate volume

      let impulseResponseResults = await this.startCalibrationImpulseResponse(stream);
      if (!impulseResponseResults) return;
      impulseResponseResults['background_noise'] = this.background_noise;
      impulseResponseResults['system']['background_noise'] = this.background_noise;
      impulseResponseResults['component']['background_noise'] = this.background_noise;

      //attenuate system background noise
      if (this.systemAttenuatorGainDB != 0) {
        let linearScaleAttenuation = Math.pow(10, this.systemAttenuatorGainDB / 20);
        let linearScalePowerAttenuation = Math.pow(10, this.systemAttenuatorGainDB / 10);
        impulseResponseResults['system']['background_noise']['recording'] = impulseResponseResults[
          'background_noise'
        ]['recording'].map(value => value / linearScaleAttenuation);
        impulseResponseResults['system']['background_noise']['x_background'] =
          impulseResponseResults['background_noise']['x_background'];
        impulseResponseResults['system']['background_noise']['y_background'] =
          impulseResponseResults['background_noise']['y_background'].map(
            value => value / linearScalePowerAttenuation
          );
      }
      //attenuate component background noise
      if (this.componentAttentuatorGainDB != 0) {
        let linearScaleAttenuation = Math.pow(10, this.componentAttenuatorGainDB / 20);
        let linearScalePowerAttenuation = Math.pow(10, this.componentAttenuatorGainDB / 10);
        impulseResponseResults['component']['background_noise']['recording'] =
          impulseResponseResults['background_noise']['recording'].map(
            value => value / linearScaleAttenuation
          );
        impulseResponseResults['component']['background_noise']['x_background'] =
          impulseResponseResults['background_noise']['x_background'];
        impulseResponseResults['component']['background_noise']['y_background'] =
          impulseResponseResults['background_noise']['y_background'].map(
            value => value / linearScalePowerAttenuation
          );
      }
      impulseResponseResults['system']['attenuatorGainDB'] = this.systemAttenuatorGainDB;
      impulseResponseResults['component']['attenuatorGainDB'] = this.componentAttenuatorGainDB;
      impulseResponseResults['system']['fMaxHz'] = this.systemFMaxHz;
      impulseResponseResults['component']['fMaxHz'] = this.componentFMaxHz;
      impulseResponseResults['L_new_n'] = this.L_new_n;
      impulseResponseResults['fs2'] = this.fs2;

      if (componentIR != null) {
        // I corrected microphone/loudpeaker IR scale in easyeyes,
        // but since we write microphone IR to firestore here
        // we need to correct microphone IR here
        let correctGain =
          Math.round((volumeResults.parameters.gainDBSPL - this.componentGainDBSPL) * 10) / 10;

        let IrFreq = impulseResponseResults?.component.ir.Freq.map(freq => Math.round(freq));
        let IrGain = impulseResponseResults?.component?.ir.Gain;
        const IrGainAt1000Hz = IrGain[IrFreq.findIndex(freq => freq === 1000)];
        const difference = Math.round(10 * (IrGainAt1000Hz - correctGain)) / 10;
        IrGain = IrGain.map(gain => gain - difference);
        micInfo['mls'] = Number(this.SDofFilteredRange['mls']);
        micInfo['systemCorrectionSD'] = Number(this.SDofFilteredRange['system']);
        micInfo['componentCorrectionSD'] = Number(this.SDofFilteredRange['component']);
        console.log(typeof micInfo['componentCorrectionSD']);
        // const id = await this.writeIsSmartPhoneToFirestore(ID, isSmartPhone, OEM);
        // await this.writeMicrophoneInfoToFirestore(ID, micInfo, OEM, id);
        // await this.writeFrqGainToFirestore(ID, IrFreq, IrGain, OEM, id);
        // micInfo['gainDBSPL'] = impulseResponseResults.component.gainDBSPL;
        // await this.writeGainat1000HzToFirestore(ID, micInfo['gainDBSPL'], OEM, id);
        // await this.writeGainat1000Hz(ID, micInfo['gainDBSPL'], OEM);
      }
      const total_results = {...volumeResults, ...impulseResponseResults};
      total_results['filteredMLSRange'] = this.filteredMLSRange;
      total_results['filteredMLSAttenuation'] = this.filteredMLSAttenuation;
      total_results['micInfo'] = micInfo;
      total_results['audioInfo'] = {};
      total_results['audioInfo']['sinkSampleRate'] = this.sinkSamplingRate;
      total_results['audioInfo']['sourceSampleRate'] = this.sourceSamplingRate;
      total_results['audioInfo']['bitsPerSample'] = this.sampleSize;
      const timeStampresult = [...this.timeStamp].join('\n');
      total_results['timeStamps'] = timeStampresult;
      total_results['recordingChecks'] = this.recordingChecks;
      total_results['waveforms'] = this.waveforms;
      total_results['component']['phase'] = this.componentIRPhase;
      total_results['system']['phase'] = this.systemIRPhase;
      total_results['qualityMetrics'] = this.SDofFilteredRange;
      total_results['flags'] = this.flags;
      console.log('total results');
      console.log(total_results);
      console.log('Time Stamps');
      console.log(timeStampresult);

      resolve(total_results);
    });
  };
}

export default Combination;