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
  constructor({download = false, mlsOrder = 18, numCaptures = 3, numMLSPerCapture = 4, lowHz = 20, highHz = 10000}) {
    super(numCaptures, numMLSPerCapture);
    this.#mlsOrder = parseInt(mlsOrder, 10);
    this.#P = 2 ** mlsOrder - 1;
    this.#download = download;
    this.#mls = [];
    this.#lowHz = lowHz;
    this.#highHz = highHz;
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
    const mls = this.#mls;
    const lowHz = this.#lowHz;
    const highHz = this.#highHz;
    this.emit('update', {message: `computing the IIR...`});
    return this.pyServerAPI
      .getInverseImpulseResponse({
        payload: computedIRs.slice(0, this.numCaptures),
        mls,
        lowHz,
        highHz
      })
      .then(res => {
        console.log(res);
        this.emit('update', {message: `done computing the IIR...`});
        this.invertedImpulseResponse = res["iir"];
        this.convolution = res["convolution"];
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

    this.emit('update', {message: `computing the IR of the last recording...`});
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
            console.log("num succ capt: " + this.numSuccessfulCaptured);
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
      this.downloadConvolvedData();
    }
    if (this.numSuccessfulCaptured < this.numCaptures) {
      this.numSuccessfulCaptured += 1;
      this.emit('update', {
        message: `${this.numSuccessfulCaptured}/${this.numCaptures} IRs computed...`,
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
        data[i] = dataBuffer[i]*.5;
      }
    } catch (error) {
      console.error(error);
    }
    console.log("mls second, same?");
    console.log(data);
    const onsetGainNode = audioContext.createGain();
    this.offsetGainNode = audioContext.createGain();
    const source = audioContext.createBufferSource();

    source.buffer = buffer;
    source.loop = true;
    source.connect(onsetGainNode);
    onsetGainNode.connect(this.offsetGainNode);
    this.offsetGainNode.connect(audioContext.destination);

    const onsetCurve = ImpulseResponse.createSCurveBuffer(this.sourceSamplingRate, Math.PI / 2);
    onsetGainNode.gain.setValueCurveAtTime(onsetCurve, 0, this.TAPER_SECS);
    console.log("first mls source node");
    console.log(source);
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

  #putInPythonConv = () => {
    const audioCtx = this.makeNewSourceAudioContextConvolved();
    const buffer = audioCtx.createBuffer(
      1, // number of channels
      this.convolution.length,
      audioCtx.sampleRate // sample rate
    );
    //console.log("convolution");
    //console.log(this.convolution);
    console.log("convolution length");
    console.log(this.convolution.length);
    const data = buffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < this.convolution.length; i += 1) {
        //data[i] = dataBuffer[i];
        if (this.convolution[i] > 1){
          console.log(this.convolution[i]);
        }
        data[i] = this.convolution[i];
        //data[i] = this.#mls[i];
      }
    } catch (error) {
      console.error(error);
    }
    console.log(buffer.getChannelData(0));
    const source = audioCtx.createBufferSource();

    source.buffer = buffer;
    source.loop = true;
    console.log("buffer");
    console.log(source.buffer);
    console.log("convolved");
    console.log(this.convolution);
    source.connect(audioCtx.destination);

    this.addCalibrationNodeConvolved(source);


  }
  #createImpulseResponseFilterGraph = () => {
    //console.log(calibrationSignal);
    const audioCtx = this.makeNewSourceAudioContextConvolved();
    const iir = this.invertedImpulseResponse;
    // -------------------------------------------------------- IIR
    const iirBuffer = audioCtx.createBuffer(
      1,
      iir.length,
      audioCtx.sampleRate
    );
    console.log("iir before buffer: ");
    console.log(iir);
    // Fill the buffer with the inverted impulse response
    const iirChannelZeroBuffer = iirBuffer.getChannelData(0);
    console.log("iir buffer lenght: " + iirBuffer.length);
    for (let i = 0; i < iirBuffer.length; i++) {
      iirChannelZeroBuffer[i] = iir[i];
    }
    console.log("after irr buffer filled: " + iirBuffer.getChannelData(0));

    const convolverNode = audioCtx.createConvolver();

    convolverNode.normalize = false;
    convolverNode.channelCount = 1;
    convolverNode.loop = true;
    convolverNode.buffer = iirBuffer;

    // ------------------------------------------------------ MLS
    const calibrationSignalBuffer = audioCtx.createBuffer(
      1, // number of channels
      this.#mls.length,
      audioCtx.sampleRate // sample rate
    );

    const mlsChannelZeroBuffer = calibrationSignalBuffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < this.#mls.length; i += 1) {
        mlsChannelZeroBuffer[i] = this.#mls[i];
        //if (i == 0){
        //  mlsChannelZeroBuffer[i] = 1;
        //}else{
        //  mlsChannelZeroBuffer[i] = 0;
       // }
      }
    } catch (error) {
      console.error(error);
    }

    const sourceNode = audioCtx.createBufferSource();
    const sourceGain = audioCtx.createGain();
    const convolverGain = audioCtx.createGain();
    sourceNode.buffer = calibrationSignalBuffer;
    sourceNode.loop = true;
    convolverNode.connect(convolverGain);
    sourceNode.connect(sourceGain);
    sourceNode.connect(convolverNode);


    convolverNode.connect(audioCtx.destination);

    console.log({convolverNode, sourceNode});
    
    this.addCalibrationNodeConvolved(sourceNode);
  };

  #createIIRwMLSGraph = () => {
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
    this.#mls = this.calibrationNodes[0].buffer.getChannelData(0);
    console.log(this.#mls);
    this.emit('update', {message: 'playing the calibration tone...'});
  }; 

  #playCalibrationAudioConvolved = () => {
    this.calibrationNodesConvolved[0].start(0);
    this.emit('update',{message: 'playing the convolved calibration tone...'})
  }

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
    this.emit('update', {message: 'stopping the calibration tone...'});
  };

  #stopCalibrationAudioConvolved = () => {
    this.offsetGainNode.gain.setValueAtTime(
      this.offsetGainNode.gain.value,
      this.sourceAudioContextConvolved.currentTime
    );

    this.offsetGainNode.gain.setTargetAtTime(0, this.sourceAudioContextConvolved.currentTime, 0.5);
    //this.calibrationNodesConvolved[0].stop(0);
    console.log("right before closing volved audio context");
    this.sourceAudioContextConvolved.close();
    this.emit('update', {message: 'stopping the convolved calibration tone...'});

  }

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
          () => this.numSuccessfulCaptured < this.numCaptures,
          this.#awaitDesiredMLSLength, // during record
          this.#afterMLSwIIRRecord, // after record
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
    saveToCSV(this.invertedImpulseResponse,'IIR_dirac.csv');
    const computedIRagain = await Promise.all(this.impulseResponses)
      .then(res => {
        for (let i = 0; i < res.length; i++){
          saveToCSV(res[i], `computed_IRs_${i}_dirac`);
        }
      })
    console.log('before mls');
    saveToCSV(this.#mls,"MLS.csv");
    saveToCSV(this.convolution,'python_convolution_mls_iir.csv');
    this.numSuccessfulCaptured = 0;
    // debugging function, use to test the result of the IIR
    await this.playMLSwithIIR(stream, this.invertedImpulseResponse);
    this.#stopCalibrationAudioConvolved();

    return this.invertedImpulseResponse;
  };
}

export default ImpulseResponse;
