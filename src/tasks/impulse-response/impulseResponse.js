import AudioCalibrator from '../audioCalibrator';
import MlsGenInterface from './mlsGen/mlsGenInterface';

import {sleep, csvToArray, saveToCSV} from '../../utils';

/**
 *
 */
class ImpulseResponse extends AudioCalibrator {
  /**
   * Default constructor. Creates an instance with any number of paramters passed or the default parameters defined here.
   *
   * @param {Object<boolean, number, number, number>} calibratorParams  - paramter object
   * @param {boolean} [calibratorParams.download = false]  - boolean flag to download captures
   * @param {number} [calibratorParams.mlsOrder = 18] - order of the MLS to be generated
   * @param {number} [calibratorParams.numCaptures = 5] - number of captures to perform
   * @param {number} [calibratorParams.numMLSPerCapture = 4] - number of bursts of MLS per capture
   */
  constructor({download = false, mlsOrder = 18, numCaptures = 5, numMLSPerCapture = 1}) {
    super(numCaptures, numMLSPerCapture);
    this.#mlsOrder = parseInt(mlsOrder, 10);
    this.#P = 2 ** mlsOrder - 1; // 2 ** mlsOrder - 1
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
  impulseResponses = [];

  /** @private */
  #mlsOrder;

  /** @private */
  #P;

  /** @private */
  TAPER_SECS = 0; // was 5

  /** @private */
  offsetGainNode;

  MLS;

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
    //computedIRs = this.getAllRecordedSignals();
    //console.log("computed IRs");
    //console.log(computedIRs)
    //JSON_IRs = JSON.parse(computedIRs);
    //console.log(JSON_IRs)
    //++saveToCSV(computedIRs, `computedIRs_0.csv`);
    //for (let i = 0; i < computedIRs.length; i++){
      
    //  saveToCSV(computedIRs[i], `computedIRs_${i}.csv`);
    //}
    this.emit('update', {message: `computing the IIR...`});
    return this.pyServerAPI
      .getInverseImpulseResponse({
        payload: computedIRs.slice(0, this.numCaptures),
      })
      .then(res => {
        this.emit('update', {message: `done computing the IIR...`});
        this.invertedImpulseResponse = res;
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
    const payload =
      signalCsv && signalCsv.length > 0 ? csvToArray(signalCsv) : allSignals[numSignals - 1];

    this.emit('update', {message: `computing the IR of the last recording...`});
    this.impulseResponses.push(
      this.pyServerAPI
        .getImpulseResponse({
          sampleRate: this.sourceSamplingRate || 96000,
          payload,
          P: this.#P,
          MLS: this.MLS,
        })
        .then(res => {
          if (this.numSuccessfulCaptured < this.numCaptures) {
            this.numSuccessfulCaptured += 1;
            this.emit('update', {
              message: `${this.numSuccessfulCaptured}/${this.numCaptures} IRs computed...`,
            });
          }
          return res;
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
    this.emit('update', {
      message: `sampling the calibration signal...`,
    });
    console.log("await lenght...sample rate: " + this.sourceSamplingRate)
    console.log("what is P: " + this.#P);
    const t_0 = performance.now();

    console.log("time start");
    console.log(t_0);

    await sleep((this.#P / this.sourceSamplingRate) * this.numMLSPerCapture);
    const t_1 = performance.now();
    console.log("time for recording");
    console.log(t_1);
    console.log(t_1-t_0);
  };

  /** .
   * .
   * .
   * Passed to the calibration steps function, awaits the onset of the signal to ensure a steady state
   *
   * @example
   */
  #awaitSignalOnset = async () => {
    this.emit('update', {
      message: `waiting for the signal to stabalize...`,
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
    if (this.#download) {
      this.downloadData();
    }
    this.sendRecordingToServerForProcessing();
  };

  #afterMLSwIIRRecord = () => {
    if (this.#download) {
      this.downloadData();
    }
    this.#stopCalibrationAudio();
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
    console.log("sample rate");
    console.log(audioContext.sampleRate);
    const buffer = audioContext.createBuffer(
      1, // number of channels
      dataBuffer.length,
      audioContext.sampleRate // sample rate
    );

    const data = buffer.getChannelData(0); // get data
    //const fs = 512;
    //const dt = 1/fs;
    //const F = 60;
    // fill the buffer with our data
    const A = 1;
    let fs = 48000;
    let f0 = 0;
    let f1 = 20000;
    let T_sweep = 5.5; // 5.5
    let phi = 0;
    let f = f0;
    let delta = 2* Math.PI * f/fs;
    let f_delta = (f1-f0)/(fs*T_sweep);
    let cos = [];
    const freqs = [];
    try {
      for (let i = 0; i < dataBuffer.length; i += 1) {
        //data[i] = dataBuffer[i]*.025;
        data[i] = dataBuffer[i];


        //data[i] = A*Math.sin(phi);
        //cos.push(A*Math.cos(phi))
        //phi = phi + delta;
        //f = f + f_delta;
        //delta = 2*Math.PI*f/fs;
      
        //  console.log("final freq + " + f);
        //freqs.push(f);
        //data[i] = dataBuffer[i]*0;
       // }
      }
    } catch (error) {
      console.error(error);
    }
    //saveToCSV(cos,'sweep_cos.csv')
    //saveToCSV(freqs, 'MLS_freqs.csv')
    const onsetGainNode = audioContext.createGain();
    this.offsetGainNode = audioContext.createGain();
    const source = audioContext.createBufferSource();

    source.buffer = buffer;
    source.loop = true;
    source.connect(onsetGainNode);
    onsetGainNode.connect(this.offsetGainNode);
    this.offsetGainNode.connect(audioContext.destination);
    console.log("other sampling rate");
    console.log(this.sourceSamplingRate);
    //const onsetCurve = ImpulseResponse.createSCurveBuffer(this.sourceSamplingRate, Math.PI / 2);
    //onsetGainNode.gain.setValueCurveAtTime(onsetCurve, 0, this.TAPER_SECS);
    console.log("source")
    console.log(source)

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
      this.#createCalibrationNodeFromBuffer(dataBufferArray[0]);
    } else {
      throw new Error('The length of the data buffer array must be 1');
    }
  };

  #createImpulseResponseFilterGraph = (calibrationSignal, iir) => {
    const audioCtx = this.makeNewSourceAudioContext();

    // -------------------------------------------------------- IIR
    const iirBuffer = audioCtx.createBuffer(
      1,
      // TODO: quality check this
      iir.length - 1,
      audioCtx.sampleRate
    );

    // Fill the buffer with the inverted impulse response
    const iirChannelZeroBuffer = iirBuffer.getChannelData(0);
    for (let i = 0; i < iirBuffer.length; i += 1) {
      // audio needs to be in [-1.0; 1.0]
      iirChannelZeroBuffer[i] = iir[i];
    }

    const convolverNode = audioCtx.createConvolver();

    convolverNode.normalize = false;
    convolverNode.channelCount = 1;
    convolverNode.buffer = iirBuffer;

    // ------------------------------------------------------ MLS
    const calibrationSignalBuffer = audioCtx.createBuffer(
      1, // number of channels
      calibrationSignal.length,
      audioCtx.sampleRate // sample rate
    );

    const mlsChannelZeroBuffer = calibrationSignalBuffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < calibrationSignal.length; i += 1) {
        mlsChannelZeroBuffer[i] = calibrationSignal[i];
      }
    } catch (error) {
      console.error(error);
    }

    const sourceNode = audioCtx.createBufferSource();

    sourceNode.buffer = calibrationSignalBuffer;
    sourceNode.loop = true;
    sourceNode.connect(convolverNode);

    convolverNode.connect(audioCtx.destination);

    console.log({convolverNode, sourceNode});

    this.addCalibrationNode(sourceNode);
  };

  #createIIRwMLSGraph = () => {
    console.log("buffer view");
    console.log(this.#mlsBufferView[0]);
    this.#createImpulseResponseFilterGraph(this.impulseResponses, [this.#mlsBufferView][0]);
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
    console.log("calibration node?");
    console.log(this.calibrationNodes[0].buffer)
    //MLS SIGNAL
    console.log(this.calibrationNodes[0].buffer.getChannelData(0))
    saveToCSV(this.calibrationNodes[0].buffer.getChannelData(0), 'MLS_iphone_6_bursts_96k.csv')
    this.MLS = this.calibrationNodes[0].buffer.getChannelData(0)
    this.emit('update', {message: 'playing the calibration tone...'});
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
    this.emit('update', {message: 'stopping the calibration tone...'});
  };

  playMLSwithIIR = async (stream, iir) => {
    this.invertedImpulseResponse = iir;
    // initialize the MLSGenInterface object with it's factory method
    await MlsGenInterface.factory(
      this.#mlsOrder,
      this.sinkSamplingRate,
      this.sourceSamplingRate
    ).then(mlsGenInterface => {
      this.#mlsGenInterface = mlsGenInterface;
      this.#mlsBufferView = this.#mlsGenInterface.getMLS();
      console.log(this.#mlsBufferView);
    });

    // after intializating, start the calibration steps with garbage collection
    await this.#mlsGenInterface.withGarbageCollection([
      [
        this.calibrationSteps,
        [
          stream,
          this.#playCalibrationAudio, // play audio func (required)
          this.#createImpulseResponseFilterGraph, // before play func
          null, // before record
          this.#awaitDesiredMLSLength, // during record
          this.#afterMLSwIIRRecord, // after record
        ],
      ],
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
  startCalibration = async stream => {
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
          this.#afterMLSRecord // after record
        ),
    ]);

    this.#stopCalibrationAudio();

    // at this stage we've captured all the required signals,
    // and have received IRs for each one
    // so let's send all the IRs to the server to be converted to a single IIR
    await this.sendImpulseResponsesToServerForProcessing();

    // debugging function, use to test the result of the IIR
    // await this.playMLSwithIIR(stream, this.invertedImpulseResponse);
    console.log("inverse impulse");
    saveToCSV(this.invertedImpulseResponse, `invertedImpulse_iphone_neg_32.csv`);
    return this.invertedImpulseResponse;
  };
}

export default ImpulseResponse;
