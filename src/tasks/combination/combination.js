import AudioCalibrator from '../audioCalibrator';

import {sleep, csvToArray, saveToCSV} from '../../utils';
import database from '../../config/firebase';
import {ref, set, get, child} from 'firebase/database';

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
   * @param {number} [calibratorParams.numMLSPerCapture = 4] - number of bursts of MLS per capture
   */
  constructor({
    download = false,
    mlsOrder = 18,
    numCaptures = 3,
    numMLSPerCapture = 4,
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
  TAPER_SECS = 5;

  /** @private */
  offsetGainNode;

  /** @private */
  componentConvolution;

  /** @private */
  systemConvolution;

  ////////////////////////volume
  /** @private */
  #CALIBRATION_TONE_FREQUENCY = 1000; // Hz

  /** @private */
  #CALIBRATION_TONE_TYPE = 'sine';

  /** @private */
  #CALIBRATION_TONE_DURATION = 5; // seconds

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

  /**generate string template that gets reevaluated as variable increases */
  generateTemplate = () => {
    if (this.percent_complete > 100) {
      this.percent_complete = 100;
    }
    const template = `<div style="display: flex; justify-content: center;"><div style="width: 800px; height: 20px; border: 2px solid #000; border-radius: 10px;"><div style="width: ${this.percent_complete}%; height: 100%; background-color: #00aaff; border-radius: 8px;"></div></div></div>`;
    return template;
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
    const computedIRs = await Promise.all(this.impulseResponses);
    const filteredComputedIRs = computedIRs.filter(element => {
      return element != undefined;
    });
    const mls = this.#mls;
    const lowHz = this.#lowHz;
    const highHz = this.#highHz;
    this.stepNum += 1;
    console.log('send impulse responses to server: ' + this.stepNum);
    this.status =
      `All Hz Calibration: computing the IIR...`.toString() + this.generateTemplate().toString();
    this.emit('update', {message: this.status});
    return this.pyServerAPI
      .getSystemInverseImpulseResponseWithRetry({
        payload: filteredComputedIRs.slice(0, this.numCaptures),
        mls,
        lowHz,
        highHz,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        console.log(res);
        this.stepNum += 1;
        console.log('got impulse response ' + this.stepNum);
        this.incrementStatusBar();
        this.status =
          `All Hz Calibration: done computing the IIR...`.toString() +
          this.generateTemplate().toString();
        this.emit('update', {message: this.status});
        this.systemInvertedImpulseResponse = res['iir'];
        this.systemIR = res['ir'];
        this.systemConvolution = res['convolution'];
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
    const computedIRs = await Promise.all(this.impulseResponses);
    const filteredComputedIRs = computedIRs.filter(element => {
      return element != undefined;
    });
    const componentIRGains = this.componentIR['Gain'];
    const componentIRFreqs = this.componentIR['Freq'];
    const mls = this.#mls;
    const lowHz = this.#lowHz;
    const highHz = this.#highHz;
    this.stepNum += 1;
    console.log('send impulse responses to server: ' + this.stepNum);
    this.status =
      `All Hz Calibration: computing the IIR...`.toString() + this.generateTemplate().toString();
    this.emit('update', {message: this.status});
    return this.pyServerAPI
      .getComponentInverseImpulseResponseWithRetry({
        payload: filteredComputedIRs.slice(0, this.numCaptures),
        mls,
        lowHz,
        highHz,
        componentIRGains,
        componentIRFreqs,
        sampleRate: this.sourceSamplingRate || 96000,
      })
      .then(res => {
        console.log(res);
        this.stepNum += 1;
        console.log('got impulse response ' + this.stepNum);
        this.incrementStatusBar();
        this.status =
          `All Hz Calibration: done computing the IIR...`.toString() +
          this.generateTemplate().toString();
        this.emit('update', {message: this.status});
        this.componentInvertedImpulseResponse = res['iir'];
        this.componentIR['Gain'] = res['ir'];
        this.componentIR['Freq'] = res['frequencies'];
        this.componentConvolution = res['convolution'];
      })
      .catch(err => {
        // this.emit('InvertedImpulseResponse', {res: false});
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
  sendRecordingToServerForProcessing = signalCsv => {
    const allSignals = this.getAllRecordedSignals();
    const numSignals = allSignals.length;
    const mls = this.#mls;
    const payload =
      signalCsv && signalCsv.length > 0 ? csvToArray(signalCsv) : allSignals[numSignals - 1];
    console.log('sending rec');
    this.stepNum += 1;
    console.log('send rec ' + this.stepNum);
    this.status =
      `All Hz Calibration Step: computing the IR of the last recording...`.toString() +
      this.generateTemplate().toString();
    this.emit('update', {message: this.status});
    this.impulseResponses.push(
      this.pyServerAPI
        .getImpulseResponse({
          sampleRate: this.sourceSamplingRate || 96000,
          payload,
          mls,
          P: this.#P,
          numPeriods: this.numMLSPerCapture,
        })
        .then(res => {
          if (this.numSuccessfulCaptured < this.numCaptures) {
            this.numSuccessfulCaptured += 1;
            console.log('num succ capt: ' + this.numSuccessfulCaptured);
            this.stepNum += 1;
            console.log('got impulse response ' + this.stepNum);
            this.incrementStatusBar();
            this.status =
              `All Hz Calibration: ${this.numSuccessfulCaptured}/${this.numCaptures} IRs computed...`.toString() +
              this.generateTemplate().toString();
            this.emit('update', {
              message: this.status,
            });
            this.autocorrelations.push(res['autocorrelation']);
            return res['ir'];
          }
        })
        .catch(err => {
          console.error(err);
        })
    );
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
    this.status =
      `All Hz Calibration: sampling the calibration signal...`.toString() +
      `\niteration ${this.stepNum}` +
      this.generateTemplate();
    this.emit('update', {
      message: this.status,
    });
    let time_to_wait = 0;
    if (this.mode === 'unfiltered') {
      time_to_wait = (this.#mls.length / this.sourceSamplingRate) * this.numMLSPerCapture;
    } else if (this.mode === 'filtered') {
      time_to_wait =
        (this.#currentConvolution.length / this.sourceSamplingRate) * this.numMLSPerCapture;
    } else {
      throw new Error('Mode broke in awaitDesiredMLSLength');
    }

    await sleep(time_to_wait * 1.1);
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
    this.status =
      `All Hz Calibration: waiting for the signal to stabilize...`.toString() +
      this.generateTemplate();
    this.emit('update', {
      message: this.status,
    });
    let number_of_bursts_to_skip = this.num_mls_to_skip;
    let time_to_sleep = 0;
    if (this.mode === 'unfiltered') {
      time_to_sleep = this.#mls.length / this.sourceSamplingRate;
    } else if (this.mode === 'filtered') {
      time_to_sleep = this.#currentConvolution.length / this.sourceSamplingRate;
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
  #afterMLSRecord = () => {
    console.log('after record');
    this.sendRecordingToServerForProcessing();
  };

  #afterMLSwIIRRecord = () => {
    if (this.numSuccessfulCaptured < 1) {
      this.numSuccessfulCaptured += 1;
      this.stepNum += 1;
      this.incrementStatusBar();
      console.log('after mls w iir record for some reason add numSucc capt ' + this.stepNum);
      this.status =
        `All Hz Calibration: ${this.numSuccessfulCaptured} recording of convolved MLS captured`.toString() +
        this.generateTemplate().toString();
      this.emit('update', {
        message: this.status,
      });
    }
  };

  /** .
   * .
   * .
   * Created an S Curver Buffer to taper the signal onset
   *
   * @param {*} length
   * @param {*} phase
   * @returns
   * @example
   */
  static createSCurveBuffer = (length, phase) => {
    const curve = new Float32Array(length);
    let i;
    for (i = 0; i < length; i += 1) {
      // scale the curve to be between 0-1
      curve[i] = Math.sin((Math.PI * i) / length - phase) / 2 + 0.5;
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
    console.log('databuffer');
    console.log(dataBuffer);
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
        data[i] = dataBuffer[i] * 0.1;
      }
    } catch (error) {
      console.error(error);
    }

    this.sourceNode = this.sourceAudioContext.createBufferSource();

    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = true;
    this.sourceNode.connect(this.sourceAudioContext.destination);

    this.addCalibrationNode(this.sourceNode);
  };

  /**
   * Given a data buffer, creates the required calibration node
   *
   * @param {*} dataBufferArray
   * @example
   */
  #setCalibrationNodesFromBuffer = (dataBufferArray = [this.#mlsBufferView]) => {
    if (dataBufferArray.length === 1) {
      this.#createCalibrationNodeFromBuffer(dataBufferArray[0]);
    } else {
      throw new Error('The length of the data buffer array must be 1');
    }
  };

  /**
   * function to put MLS filtered IIR data obtained from
   * python server into our audio buffer to be played aloud
   */
  #putInPythonConv = () => {
    const audioCtx = this.makeNewSourceAudioContextConvolved();

    //depends on goal
    if (this._calibrateSoundCheck != 'system') {
      this.#currentConvolution = this.componentConvolution;
      const buffer = audioCtx.createBuffer(
        1, // number of channels
        this.componentConvolution.length,
        audioCtx.sampleRate // sample rate
      );

      const data = buffer.getChannelData(0); // get data
      // fill the buffer with our data
      try {
        for (let i = 0; i < this.componentConvolution.length; i += 1) {
          data[i] = this.componentConvolution[i];
        }
      } catch (error) {
        console.error(error);
      }

      const source = audioCtx.createBufferSource();

      source.buffer = buffer;
      source.loop = true;
      source.connect(audioCtx.destination);

      this.addCalibrationNodeConvolved(source);
    } else {
      this.#currentConvolution = this.systemConvolution;
      const buffer = audioCtx.createBuffer(
        1, // number of channels
        this.systemConvolution.length,
        audioCtx.sampleRate // sample rate
      );
      const data = buffer.getChannelData(0); // get data
      // fill the buffer with our data
      try {
        for (let i = 0; i < this.systemConvolution.length; i += 1) {
          data[i] = this.systemConvolution[i];
        }
      } catch (error) {
        console.error(error);
      }

      const source = audioCtx.createBufferSource();

      source.buffer = buffer;
      source.loop = true;
      source.connect(audioCtx.destination);

      this.addCalibrationNodeConvolved(source);
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
    if (this.mode === 'unfiltered') {
      this.calibrationNodes[0].start(0);
      this.#mls = this.calibrationNodes[0].buffer.getChannelData(0);
      console.log('play calibration audio ' + this.stepNum);
      this.status =
        `All Hz Calibration: playing the calibration tone...`.toString() +
        this.generateTemplate().toString();
      this.emit('update', {message: this.status});
    } else if (this.mode === 'filtered') {
      this.calibrationNodes[0].start(0);
      console.log('play convolved audio ' + this.stepNum);
      this.status =
        `All Hz Calibration: playing the convolved calibration tone...`.toString() +
        this.generateTemplate().toString();
      this.emit('update', {message: this.status});
    } else {
      throw new Error('Mode is incorrect');
    }
    this.stepNum += 1;
    console.log('sink sampling rate');
    console.log(this.sinkSamplingRate);
    console.log('source sampling rate');
    console.log(this.sourceSamplingRate);
  };

  /** .
   * .
   * .
   * Stops the audio with tapered offset
   *
   * @example
   */
  #stopCalibrationAudio = () => {
    this.calibrationNodes[0].stop(0);
    this.calibrationNodes = [];
    this.sourceNode.disconnect();
    this.stepNum += 1;
    console.log('stop calibration audio ' + this.stepNum);
    this.status =
      `All Hz Calibration: stopping the calibration tone...`.toString() +
      this.generateTemplate().toString();
    this.emit('update', {message: this.status});
  };

  playMLSwithIIR = async (stream, iir) => {
    this.mode = 'filtered';
    console.log('play mls with iir');
    this.invertedImpulseResponse = iir;

    await this.calibrationSteps(
      stream,
      this.#playCalibrationAudio, // play audio func (required)
      this.#createCalibrationNodeFromBuffer(this.#currentConvolution), // before play func
      this.#awaitSignalOnset, // before record
      () => this.numSuccessfulCaptured < 1,
      this.#awaitDesiredMLSLength, // during record
      this.#afterMLSwIIRRecord, // after record
      this.mode
    );
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
    let desired_time = this.desired_time_per_mls;

    console.log('MLS sequence should be of length: ' + this.sourceSamplingRate * desired_time);

    length = this.sourceSamplingRate * desired_time;
    //get mls here
    await this.pyServerAPI
      .getMLSWithRetry(length)
      .then(res => {
        console.log(res);
        this.#mlsBufferView = res['mls'];
      })
      .catch(err => {
        // this.emit('InvertedImpulseResponse', {res: false});
        console.error(err);
      });
    await this.calibrationSteps(
      stream,
      this.#playCalibrationAudio, // play audio func (required)
      this.#createCalibrationNodeFromBuffer(this.#mlsBufferView), // before play func
      this.#awaitSignalOnset, // before record
      () => this.numSuccessfulCaptured < this.numCaptures, // loop while true
      this.#awaitDesiredMLSLength, // during record
      this.#afterMLSRecord, // after record
      this.mode
    ),
      this.#stopCalibrationAudio();

    // at this stage we've captured all the required signals,
    // and have received IRs for each one
    // so let's send all the IRs to the server to be converted to a single IIR
    await this.sendSystemImpulseResponsesToServerForProcessing();
    await this.sendComponentImpulseResponsesToServerForProcessing();

    this.numSuccessfulCaptured = 0;

    let iir_ir_and_plots;
    if (this._calibrateSoundCheck != 'none') {
      if (this._calibrateSoundCheck != 'system') {
        this.#currentConvolution = this.componentConvolution;
      } else {
        this.#currentConvolution = this.systemConvolution;
      }
      await this.playMLSwithIIR(stream, this.invertedImpulseResponse);
      this.#stopCalibrationAudio();
      this.sourceAudioContext.close();
      let conv_recs = this.getAllFilteredRecordedSignals();
      let recs = this.getAllRecordedSignals();
      let unconv_rec = recs[0];
      let conv_rec = conv_recs[0];
      if (this._calibrateSoundCheck != 'system') {
        let knownGain = this.oldComponentIR.Gain;
        let knownFreq = this.oldComponentIR.Freq;
        let sampleRate = this.sourceSamplingRate || 96000;
        let unconv_results = await this.pyServerAPI
          .getSubtractedPSDWithRetry(unconv_rec, knownGain, knownFreq, sampleRate)
          .then(res => {
            this.incrementStatusBar();
            this.status =
              `All Hz Calibration: done computing the PSD graphs...`.toString() +
              this.generateTemplate().toString();
            this.emit('update', {message: this.status});
            return res;
          })
          .catch(err => {
            console.error(err);
          });

        let conv_results = await this.pyServerAPI
          .getSubtractedPSDWithRetry(conv_rec, knownGain, knownFreq, sampleRate)
          .then(res => {
            this.incrementStatusBar();
            this.status =
              `All Hz Calibration: done computing the PSD graphs...`.toString() +
              this.generateTemplate().toString();
            this.emit('update', {message: this.status});
            return res;
          })
          .catch(err => {
            console.error(err);
          });
        iir_ir_and_plots = {
          systemIIR: this.systemInvertedImpulseResponse,
          componentIIR: this.componentInvertedImpulseResponse,
          x_unconv: unconv_results['x'],
          y_unconv: unconv_results['y'],
          x_conv: conv_results['x'],
          y_conv: conv_results['y'],
          componentIR: this.componentIR,
          systemIR: this.systemIR,
        };
      } else {
        let results = await this.pyServerAPI
          .getPSDWithRetry({
            unconv_rec,
            conv_rec,
            sampleRate: this.sourceSamplingRate || 96000,
          })
          .then(res => {
            this.incrementStatusBar();
            this.status =
              `All Hz Calibration: done computing the PSD graphs...`.toString() +
              this.generateTemplate().toString();
            this.emit('update', {message: this.status});
            return res;
          })
          .catch(err => {
            console.error(err);
          });
        iir_ir_and_plots = {
          systemIIR: this.systemInvertedImpulseResponse,
          componentIIR: this.componentInvertedImpulseResponse,
          x_unconv: results['x_unconv'],
          y_unconv: results['y_unconv'],
          x_conv: results['x_conv'],
          y_conv: results['y_conv'],
          componentIR: this.componentIR,
          systemIR: this.systemIR,
        };
      }

      if (this.#download) {
        this.downloadSingleUnfilteredRecording();
        this.downloadSingleFilteredRecording();
        saveToCSV(this.#mls, 'MLS.csv');
        saveToCSV(this.componentConvolution, 'python_component_convolution_mls_iir.csv');
        saveToCSV(this.systemConvolution, 'python_system_convolution_mls_iir.csv');
        saveToCSV(this.componentInvertedImpulseResponse, 'componentIIR.csv');
        saveToCSV(this.systemInvertedImpulseResponse, 'systemIIR.csv');
        for (let i = 0; i < this.autocorrelations.length; i++){
          saveToCSV(this.autocorrelations[i],`autocorrelation_${i}`);
        }
        const computedIRagain = await Promise.all(this.impulseResponses).then(res => {
          for (let i = 0; i < res.length; i++) {
            if (res[i] != undefined) {
              saveToCSV(res[i], `IR_${i}`);
            }
          }
        });
      }
    } else {
      iir_ir_and_plots = {
        systemIIR: this.systemInvertedImpulseResponse,
        componentIIR: this.componentInvertedImpulseResponse,
        x_unconv: [],
        y_unconv: [],
        x_conv: [],
        y_conv: [],
        componentIR: this.componentIR,
        systemIR: this.systemIR,
      };
      if (this.#download) {
        saveToCSV(this.#mls, 'MLS.csv');
        saveToCSV(this.componentConvolution, 'python_component_convolution_mls_iir.csv');
        saveToCSV(this.systemConvolution, 'python_system_convolution_mls_iir.csv');
        saveToCSV(this.componentInvertedImpulseResponse, 'componentIIR.csv');
        saveToCSV(this.systemInvertedImpulseResponse, 'systemIIR.csv');
        for (let i = 0; i < this.autocorrelations.length; i++){
          saveToCSV(this.autocorrelations[i],`autocorrelation_${i}`);
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

    this.percent_complete = 100;

    this.status = `All Hz Calibration: Finished`.toString() + this.generateTemplate().toString();
    this.emit('update', {message: this.status});

    //here after calibration we have the component calibration (either loudspeaker or microphone) in the same form as the componentIR
    //that was used to calibrate

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

  #getTruncatedSignal = (left = 3.5, right = 4.5) => {
    const start = Math.floor(left * this.sourceSamplingRate);
    const end = Math.floor(right * this.sourceSamplingRate);
    const result = Array.from(this.getLastRecordedSignal().slice(start, end));

    /**
     * function to check that capture was properly made
     * @param {*} list
     */
    const checkResult = list => {
      const setItem = new Set(list);
      if (setItem.size === 1 && setItem.has(0)) {
        console.warn(
          'The last capture failed, all recorded signal is zero',
          this.getAllRecordedSignals()
        );
      }
      if (setItem.size === 0) {
        console.warn('The last capture failed, no recorded signal');
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
    const totalDuration = this.#CALIBRATION_TONE_DURATION * 1.2;

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
    const totalDuration = this.#CALIBRATION_TONE_DURATION * 1.2;

    this.calibrationNodes[0].start(0);
    this.calibrationNodes[0].stop(totalDuration);
    console.log(`Playing a buffer of ${this.#CALIBRATION_TONE_DURATION} seconds of audio`);
    console.log(`Waiting a total of ${totalDuration} seconds`);
    await sleep(totalDuration);
  };

  #sendToServerForProcessing = lCalib => {
    console.log('Sending data to server');
    this.pyServerAPI
      .getVolumeCalibration({
        sampleRate: this.sourceSamplingRate,
        payload: this.#getTruncatedSignal(),
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
  };

  startCalibrationVolume = async (stream, gainValues, lCalib, componentGainDBSPL) => {
    const trialIterations = gainValues.length;
    this.status_denominator += trialIterations;
    const thdValues = [];
    const inDBValues = [];
    let inDB = 0;
    const outDBSPLValues = [];
    const outDBSPL1000Values = [];

    // do one calibration that will be discarded
    const soundLevelToDiscard = -60;
    const gainToDiscard = Math.pow(10, soundLevelToDiscard / 20);
    this.status =
      `1000 Hz Calibration: Sound Level ${soundLevelToDiscard} dB`.toString() +
      this.generateTemplate().toString();
    //this.emit('update', {message: `1000 Hz Calibration: Sound Level ${soundLevelToDiscard} dB`});
    this.emit('update', {message: this.status});

    do {
      // eslint-disable-next-line no-await-in-loop
      await this.volumeCalibrationSteps(
        stream,
        this.#playCalibrationAudioVolume,
        this.#createCalibrationToneWithGainValue,
        this.#sendToServerForProcessing,
        gainToDiscard,
        lCalib //todo make this a class parameter
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
      inDB = Math.log10(gainValues[i]) * 20;
      // precision to 1 decimal place
      inDB = Math.round(inDB * 10) / 10;
      inDBValues.push(inDB);
      console.log('next update');
      this.status =
        `1000 Hz Calibration: Sound Level ${inDB} dB`.toString() +
        this.generateTemplate().toString();
      this.emit('update', {message: this.status});
      do {
        // eslint-disable-next-line no-await-in-loop
        await this.volumeCalibrationSteps(
          stream,
          this.#playCalibrationAudioVolume,
          this.#createCalibrationToneWithGainValue,
          this.#sendToServerForProcessing,
          gainValues[i],
          lCalib //todo make this a class parameter
        );
      } while (this.outDBSPL === null);
      outDBSPL1000Values.push(this.outDBSPL1000);
      thdValues.push(this.THD);
      outDBSPLValues.push(this.outDBSPL);

      this.outDBSPL = null;
      this.outDBSPL1000 = null;
      this.THD = null;
    }

    // get the volume calibration parameters from the server
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
    const result = {
      parameters: parameters,
      inDBValues: inDBValues,
      outDBSPLValues: outDBSPLValues,
      outDBSPL1000Values: outDBSPL1000Values,
      thdValues: thdValues,
    };

    return result;
  };

  // function to write frq and gain to firebase database given speakerID
  writeFrqGain = async (speakerID, frq, gain) => {
    // freq and gain are too large to take samples 1 in every 100 samples

    const sampledFrq = [];
    const sampledGain = [];
    for (let i = 0; i < frq.length; i += 100) {
      sampledFrq.push(frq[i]);
      sampledGain.push(gain[i]);
    }

    const data = {Freq: sampledFrq, Gain: sampledGain};

    await set(ref(database, `Microphone/${speakerID}/linear`), data);
  };

  // Function to Read frq and gain from firebase database given speakerID
  // returns an array of frq and gain if speakerID exists, returns null otherwise

  readFrqGain = async speakerID => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `Microphone/${speakerID}/linear`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  };

  readGainat1000Hz = async speakerID => {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `Microphone/${speakerID}/Gain1000`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  };

  writeGainat1000Hz = async (speakerID, gain) => {
    const data = {Gain: gain};
    await set(ref(database, `Microphone/${speakerID}/Gain1000`), gain);
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

  writeIsSmartPhone = async (speakerID, isSmartPhone) => {
    const data = {isSmartPhone: isSmartPhone};
    await set(ref(database, `Microphone/${speakerID}/isSmartPhone`), isSmartPhone);
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
    _calibrateSoundBurstRepeats = 4,
    _calibrateSoundBurstSec = 1,
    _calibrateSoundBurstsWarmup = 1,
    _calibrateSoundHz = 48000,
    micManufacturer = '',
    micSerialNumber = '',
    micModelNumber = '',
    micModelName = ''
  ) => {
    this.numMLSPerCapture = _calibrateSoundBurstRepeats;
    this.desired_time_per_mls = _calibrateSoundBurstSec;
    this.num_mls_to_skip = _calibrateSoundBurstsWarmup;
    this.desired_sampling_rate = _calibrateSoundHz;

    //feed calibration goal here
    this._calibrateSoundCheck = _calibrateSoundCheck;
    //check if a componentIR was given to the system, if it isn't check for the microphone. using dummy data here bc we need to
    //check the db based on the microphone currently connected

    //new lCalib found at top of calibration files *1000hz, make sure to correct
    //based on zeroing of 1000hz, search for "*1000Hz"
    if (componentIR == null) {
      //mode 'ir'
      //global variable this.componentIR must be set
      this.componentIR = await this.readFrqGain(microphoneName).then(data => {
        return data;
      });

      lCalib = await this.readGainat1000Hz(microphoneName);
      // this.componentGainDBSPL = this.convertToDB(lCalib);
      this.componentGainDBSPL = lCalib;
      //TODO: if this call to database is unknown, cannot perform experiment => return false
      if (this.componentIR == null) {
        this.status =
          `Microphone ${microphoneName} is not in the database. Please add it to the database.`.toString();
        this.emit('update', {message: this.status});
        return false;
      }
    } else {
      this.componentIR = componentIR;
      lCalib = this.findGainatFrequency(this.componentIR.Freq, this.componentIR.Gain, 1000);
      // this.componentGainDBSPL = this.convertToDB(lCalib);
      this.componentGainDBSPL = lCalib;
      await this.writeGainat1000Hz(microphoneName, lCalib);
      await this.writeIsSmartPhone(microphoneName, isSmartPhone);
    }

    this.oldComponentIR = this.componentIR;

    let volumeResults = await this.startCalibrationVolume(
      stream,
      gainValues,
      lCalib,
      this.componentGainDBSPL
    );

    let impulseResponseResults = await this.startCalibrationImpulseResponse(stream);

    if (componentIR != null) {
      //insert Freq and Gain from this.componentIR into db
      await this.writeFrqGain(
        microphoneName,
        impulseResponseResults.componentIR.Freq,
        impulseResponseResults.componentIR.Gain
      );
    }

    const total_results = {...volumeResults, ...impulseResponseResults};
    console.log('total');
    console.log(total_results);
    return total_results;
  };
}

export default Combination;
