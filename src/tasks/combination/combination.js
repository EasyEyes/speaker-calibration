import AudioCalibrator from '../audioCalibrator';
import MlsGenInterface from './mlsGen/mlsGenInterface';

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
  invertedImpulseResponse = null;

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
  convolution;
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
  knownIR = null;

  deviceType = null;

  deviceName = null;

  /**generate string template that gets reevaluated as variable increases */
  generateTemplate = () => {
    if (this.percent_complete > 100) {
      this.percent_complete = 100;
    }
    const template = `<div style="display: flex; justify-content: center;"><div style="width: 200px; height: 20px; border: 2px solid #000; border-radius: 10px;"><div style="width: ${this.percent_complete}%; height: 100%; background-color: #00aaff; border-radius: 8px;"></div></div></div>`;
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

  /** .
   * .
   * .
   * Sends all the computed impulse responses to the backend server for processing
   *
   * @returns sets the resulting inverted impulse response to the class property
   * @example
   */
  sendImpulseResponsesToServerForProcessing = async () => {
    const computedIRs = await Promise.all(this.impulseResponses);
    const filteredComputedIRs = computedIRs.filter(element => {
      return element != undefined;
    });
    const knownIRGains = this.knownIR['Gain'];
    const knownIRFreqs = this.knownIR['Freq'];
    const mls = this.#mls;
    const lowHz = this.#lowHz;
    const highHz = this.#highHz;
    this.stepNum += 1;
    console.log('send impulse responses to server: ' + this.stepNum);
    this.status =
      `All Hz Calibration: computing the IIR...`.toString() + this.generateTemplate().toString();
    this.emit('update', {message: this.status});
    return this.pyServerAPI
      .getInverseImpulseResponseWithRetry({
        payload: filteredComputedIRs.slice(0, this.numCaptures),
        mls,
        lowHz,
        highHz,
        knownIRGains,
        knownIRFreqs,
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
        this.invertedImpulseResponse = res['iir'];
        this.ir = res['ir'];
        this.convolution = res['convolution'];
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
            return res;
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
      `All Hz Calibration: sampling the calibration signal...`.toString() + this.generateTemplate();
    this.emit('update', {
      message: this.status,
    });
    await sleep((this.#P / this.sourceSamplingRate) * this.numMLSPerCapture);
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
    await sleep(this.TAPER_SECS);
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
   * @param CALIBRATION_TONE_FREQUENCY
   * @private
   * @example
   */
  #createPureTonenNode = CALIBRATION_TONE_FREQUENCY => {
    const audioContext = this.makeNewSourceAudioContext();
    const oscilator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscilator.frequency.value = CALIBRATION_TONE_FREQUENCY;
    oscilator.type = 'sine';
    gainNode.gain.value = 0.04;

    oscilator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    this.addCalibrationNode(oscilator);
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   *
   * @param dataBuffer
   * @private
   * @example
   */
  #createCalibrationNodeFromBuffer = dataBuffer => {
    const audioContext = this.makeNewSourceAudioContext();
    const buffer = audioContext.createBuffer(
      1, // number of channels
      dataBuffer.length,
      audioContext.sampleRate // sample rate
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
    console.log('mls second, same?');
    console.log(data);
    const onsetGainNode = audioContext.createGain();
    this.offsetGainNode = audioContext.createGain();
    const source = audioContext.createBufferSource();

    source.buffer = buffer;
    source.loop = true;
    source.connect(onsetGainNode);
    onsetGainNode.connect(this.offsetGainNode);
    this.offsetGainNode.connect(audioContext.destination);

    const onsetCurve = Combination.createSCurveBuffer(this.sourceSamplingRate, Math.PI / 2);
    onsetGainNode.gain.setValueCurveAtTime(onsetCurve, 0, this.TAPER_SECS);
    this.addCalibrationNode(source);
  };

  /**
   * Given a data buffer, creates the required calibration node
   *
   * @param {*} dataBufferArray
   * @example
   */
  #setCalibrationNodesFromBuffer = (dataBufferArray = [this.#mlsBufferView]) => {
    if (dataBufferArray.length === 1) {
      console.log('data buffer aray');
      console.log(dataBufferArray);
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
    const buffer = audioCtx.createBuffer(
      1, // number of channels
      this.convolution.length,
      audioCtx.sampleRate // sample rate
    );

    const data = buffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < this.convolution.length; i += 1) {
        data[i] = this.convolution[i];
      }
    } catch (error) {
      console.error(error);
    }

    const source = audioCtx.createBufferSource();

    source.buffer = buffer;
    source.loop = true;
    source.connect(audioCtx.destination);

    this.addCalibrationNodeConvolved(source);
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
    this.#mls = this.calibrationNodes[0].buffer.getChannelData(0);
    this.stepNum += 1;
    console.log('play calibration audio ' + this.stepNum);
    this.status =
      `All Hz Calibration: playing the calibration tone...`.toString() +
      this.generateTemplate().toString();
    this.emit('update', {message: this.status});
  };

  #playCalibrationAudioConvolved = () => {
    this.calibrationNodesConvolved[0].start(0);
    this.stepNum += 1;
    console.log('play convolved audio ' + this.stepNum);
    this.status =
      `All Hz Calibration: playing the convolved calibration tone...`.toString() +
      this.generateTemplate().toString();
    this.emit('update', {message: this.status});
  };

  /** .
   * .
   * .
   * Stops the audio with tapered offset
   *
   * @example
   */
  #stopCalibrationAudio = () => {
    this.offsetGainNode.gain.setValueAtTime(
      this.offsetGainNode.gain.value,
      this.sourceAudioContext.currentTime
    );

    this.offsetGainNode.gain.setTargetAtTime(0, this.sourceAudioContext.currentTime, 0.5);
    this.calibrationNodes[0].stop(0);
    this.sourceAudioContext.close();
    this.stepNum += 1;
    console.log('stop calibratoin audio ' + this.stepNum);
    this.status =
      `All Hz Calibration: stopping the calibration tone...`.toString() +
      this.generateTemplate().toString();
    this.emit('update', {message: this.status});
  };

  #stopCalibrationAudioConvolved = () => {
    this.offsetGainNode.gain.setValueAtTime(
      this.offsetGainNode.gain.value,
      this.sourceAudioContextConvolved.currentTime
    );

    this.offsetGainNode.gain.setTargetAtTime(0, this.sourceAudioContextConvolved.currentTime, 0.5);
    //this.calibrationNodesConvolved[0].stop(0);
    console.log('right before closing volved audio context');
    this.sourceAudioContextConvolved.close();
    this.stepNum += 1;
    console.log('stop convolved calibration audio ' + this.stepNum);
    this.status =
      `All Hz Calibration: stopping the convolved calibration tone...`.toString() +
      this.generateTemplate().toString();
    this.emit('update', {message: this.status});
  };

  playMLSwithIIR = async (stream, iir) => {
    console.log('play mls with iir');
    this.invertedImpulseResponse = iir;
    // initialize the MLSGenInterface object with it's factory method

    await MlsGenInterface.factory(
      this.#mlsOrder,
      this.sinkSamplingRate,
      this.sourceSamplingRate
    ).then(mlsGenInterface => {
      this.#mlsGenInterface = mlsGenInterface;
      this.#mlsBufferView = this.#mlsGenInterface.getMLS();
    });

    console.log('after mls factory'); //works up to here.
    console.log(this.#mls);
    // after intializating, start the calibration steps with garbage collection
    await this.#mlsGenInterface.withGarbageCollection([
      () =>
        this.calibrationSteps(
          stream,
          this.#playCalibrationAudioConvolved, // play audio func (required)
          this.#putInPythonConv, // before play func
          this.#awaitSignalOnset, // before record
          () => this.numSuccessfulCaptured < 1,
          this.#awaitDesiredMLSLength, // during record
          this.#afterMLSwIIRRecord, // after record
          'filtered'
        ),
    ]);
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
    // initialize the MLSGenInterface object with it's factory method
    await MlsGenInterface.factory(
      this.#mlsOrder,
      this.sinkSamplingRate,
      this.sourceSamplingRate
    ).then(mlsGenInterface => {
      this.#mlsGenInterface = mlsGenInterface;
      this.#mlsBufferView = this.#mlsGenInterface.getMLS();
    });

    // after intializating, start the calibration steps with garbage collection
    await this.#mlsGenInterface.withGarbageCollection([
      () =>
        this.calibrationSteps(
          stream,
          this.#playCalibrationAudio, // play audio func (required)
          this.#setCalibrationNodesFromBuffer, // before play func
          this.#awaitSignalOnset, // before record
          () => this.numSuccessfulCaptured < this.numCaptures, // loop while true
          this.#awaitDesiredMLSLength, // during record
          this.#afterMLSRecord, // after record
          'unfiltered'
        ),
    ]);

    this.#stopCalibrationAudio();

    // at this stage we've captured all the required signals,
    // and have received IRs for each one
    // so let's send all the IRs to the server to be converted to a single IIR
    await this.sendImpulseResponsesToServerForProcessing();

    this.numSuccessfulCaptured = 0;
    // debugging function, use to test the result of the IIR
    await this.playMLSwithIIR(stream, this.invertedImpulseResponse);
    this.#stopCalibrationAudioConvolved();

    let recs = this.getAllRecordedSignals();
    let conv_recs = this.getAllFilteredRecordedSignals();
    let unconv_rec = recs[0];
    let conv_rec = conv_recs[0];

    this.status =
      `All Hz Calibration: computing PSD graphs...`.toString() + this.generateTemplate().toString();
    this.emit('update', {message: this.status});

    let results = await this.pyServerAPI
      .getPSDWithRetry({
        unconv_rec,
        conv_rec,
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

    let iir_ir_and_plots = {
      iir: this.invertedImpulseResponse,
      x_unconv: results['x_unconv'],
      y_unconv: results['y_unconv'],
      x_conv: results['x_conv'],
      y_conv: results['y_conv'],
      ir: this.ir,
    };
    if (this.#download) {
      this.downloadSingleUnfilteredRecording();
      this.downloadSingleFilteredRecording();
      saveToCSV(this.#mls, 'MLS.csv');
      saveToCSV(this.convolution, 'python_convolution_mls_iir.csv');
      saveToCSV(this.invertedImpulseResponse, 'IIR.csv');
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

  #sendToServerForProcessing = (lCalib = 104.92978421490648) => {
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

  startCalibrationVolume = async (stream, gainValues, lCalib = 104.92978421490648) => {
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
    const data = {
      frq,
      gain,
    };
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

  // Example of how to use the writeFrqGain and readFrqGain functions
  // writeFrqGain('speaker1', [1, 2, 3], [4, 5, 6]);
  // Speaker1 is the speakerID  you want to write to in the database
  // readFrqGain('MiniDSPUMIK_1').then(data => console.log(data));
  // MiniDSPUMIK_1 is the speakerID with some Data in the database

  startCalibration = async (
    stream,
    gainValues,
    lCalib = 104.92978421490648,
    knownIR = null,
    microphoneName = 'MiniDSPUMIK_1'
  ) => {
    //check if a knownIR was given to the system, if it isn't check for the microphone. using dummy data here bc we need to
    //check the db based on the microphone currently connected
    if (knownIR == null) {
      this.knownIR = await this.readFrqGain(microphoneName).then(data => {
        return data;
      });
      console.log(this.knownIR);

      // Here, I think we should check if this.knownIR is null. Because that means that the microphone is not in the database
      // so we need to return a message to end the experiment
      if (this.knownIR == null) {
        this.status =
          `Microphone ${microphoneName} is not in the database. Please add it to the database.`.toString();
        this.emit('update', {message: this.status});
        return false;
      }
    } else {
      this.knownIR = knownIR;
    }
    //haven't changed 1000 hz calibration
    let volumeResults = await this.startCalibrationVolume(
      stream,
      gainValues,
      (lCalib = 104.92978421490648)
    );
    //impulse response calibration has the infrastructure set up (sending microphone data, receiving ir) but the ir subtraction
    //is not properly implemented
    let impulseResponseResults = await this.startCalibrationImpulseResponse(stream);

    console.log(volumeResults);
    console.log(impulseResponseResults); //this result now contain the ir to be fed into next round along with
    //what it already returned, not completed yet but can be used as if completed for now
    const total_results = {...volumeResults, ...impulseResponseResults};
    console.log('total');
    console.log(total_results);
    return total_results;
  };
}

export default Combination;
