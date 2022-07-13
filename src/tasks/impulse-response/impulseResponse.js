import AudioCalibrator from '../audioCalibrator';
import MlsGenInterface from './mlsGen/mlsGenInterface';

import {sleep, csvToArray} from '../../utils';

/**
 *
 */
class ImpulseResponse extends AudioCalibrator {
  constructor({download = false, mlsOrder = 18, numCaptures = 5, numMLSPerCapture = 4}) {
    super(numCaptures, numMLSPerCapture);
    this.#mlsOrder = parseInt(mlsOrder);
    this.#P = Math.pow(2, mlsOrder) - 1;
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

  #P;

  /** @private */
  TAPER_SECS = 5;

  /** @private */
  offsetGainNode;

  /**
   * Sends all the computed impulse responses to the backend server for processing
   * @returns sets the resulting inverted impulse response to the class property
   */
  sendImpulseResponsesToServerForProcessing = async () => {
    const computedIRs = await Promise.all(this.impulseResponses);
    this.emit('update', {message: `computing the IIR...`});
    return this.pyServerAPI
      .getInverseImpulseResponse({
        payload: computedIRs,
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

  /**
   * Sends the recorded signal, or a given csv string of a signal, to the back end server for processing
   * @param {<array>String} signalCsv - Optional csv string of a previously recorded signal, if given, this signal will be processed
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
   * of MLS periods defined in the constructor
   */
  #awaitDesiredMLSLength = async () => {
    // seconds per MLS = P / SR
    // await N * P / SR
    this.emit('update', {
      message: `sampling the calibration signal...`,
    });
    await sleep((this.#P / this.sourceSamplingRate) * this.numMLSPerCapture);
  };

  /**
   * Passed to the calibration steps function, awaits the onset of the signal to ensure a steady state
   */
  #awaitSignalOnset = async () => {
    this.emit('update', {
      message: `waiting for the signal to stabalize...`,
    });
    await sleep(this.TAPER_SECS);
  };

  /**
   * Called immediately after a recording is captured. Used to process the resulting signal
   * whether by sending the result to a server or by computing a result locally
   */
  #afterRecord = () => {
    if (this.#download) {
      this.downloadData();
    }
    this.#stopCalibrationAudio();
    this.sendRecordingToServerForProcessing();
  };

  /**
   * Created an S Curver Buffer to taper the signal onset
   * @param {*} length
   * @param {*} phase
   * @returns
   */
  createSCurveBuffer = (length, phase) => {
    const curve = new Float32Array(length);
    let i;
    for (i = 0; i < length; ++i) {
      //scale the curve to be between 0-1
      curve[i] = Math.sin((Math.PI * i) / length - phase) / 2 + 0.5;
    }
    return curve;
  };

  createInverseSCurveBuffer = (length, phase) => {
    const curve = new Float32Array(length);
    let i;
    let j = length - 1;
    for (i = 0; i < length; ++i) {
      //scale the curve to be between 0-1
      curve[i] = Math.sin((Math.PI * j) / length - phase) / 2 + 0.5;
      --j;
    }
    return curve;
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   * @private
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
        data[i] = dataBuffer[i];
      }
    } catch (error) {
      console.error(error);
    }

    // const onsetGainNode = audioContext.createGain();
    // this.offsetGainNode = audioContext.createGain();
    const source = audioContext.createBufferSource();

    source.buffer = buffer;
    source.loop = true;
    source.connect(audioContext.destination);
    // onsetGainNode.connect(this.offsetGainNode);
    // this.offsetGainNode.connect(audioContext.destination);

    // const onsetCurve = this.createSCurveBuffer(this.sourceSamplingRate, Math.PI / 2);
    // onsetGainNode.gain.setValueCurveAtTime(onsetCurve, 0, this.TAPER_SECS);

    this.addCalibrationNode(source);
  };

  /**
   * Given a data buffer, creates the required calibration node
   * @param {*} dataBufferArray
   */
  #setCalibrationNodesFromBuffer = (dataBufferArray = [this.#mlsBufferView]) => {
    if (dataBufferArray.length === 1) {
      this.#createCalibrationNodeFromBuffer(dataBufferArray[0]);
    } else {
      throw new Error('The length of the data buffer array must be 1');
    }
  };

  /**
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = () => {
    const {duration} = this.calibrationNodes[0].buffer;
    this.calibrationNodes[0].start(0);
    this.emit('update', {message: 'playing the calibration tone...'});
  };

  /**
   * Stops the audio with tapered offset
   */
  #stopCalibrationAudio = () => {
    this.calibrationNodes[0].stop();
    // this.offsetGainNode.gain.setValueAtTime(
    //   this.offsetGainNode.gain.value,
    //   this.sourceAudioContext.currentTime
    // );

    // this.offsetGainNode.gain.setTargetAtTime(0, this.sourceAudioContext.currentTime, 0.5);
    this.emit('update', {message: 'stopping the calibration tone...'});
  };

  /**
   * Public method to start the calibration process. Objects intialized from webassembly allocate new memory
   * and must be manually freed. This function is responsible for intializing the MlsGenInterface,
   * and wrapping the calibration steps with a garbage collection safe gaurd.
   * @public
   * @param {MediaStream} stream - The stream of audio from the Listener.
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
      [
        this.calibrationSteps,
        [
          stream,
          this.#playCalibrationAudio, // play audio func (required)
          this.#setCalibrationNodesFromBuffer, // before play func
          this.#awaitSignalOnset, // before record
          this.#awaitDesiredMLSLength, // during record
          this.#afterRecord, // after record
        ],
      ],
    ]);

    // await the server response
    await this.sendImpulseResponsesToServerForProcessing();
    return this.invertedImpulseResponse;
  };
}

export default ImpulseResponse;
