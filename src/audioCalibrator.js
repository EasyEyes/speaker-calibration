import AudioRecorder from './audioRecorder';
import {sleep, saveToCSV} from './utils';
import MlsGenInterface from './mlsGen/mlsGenInterface';
import {GeneratedSignalChart, RecordedSignalChart, IRChart} from './myCharts';

/**
 * Provides methods for calibrating the user's speakers
 * @extends AudioRecorder
 */
class AudioCalibrator extends AudioRecorder {
  /** @private */
  #isCalibrating = false;

  /** @private */
  #sourceAudio;

  /** @private */
  #sourceAudioContext;

  /** @private */
  #sourceAudioAnalyser;

  /** @private */
  #sinkAudioContext;

  /** @private */
  #sinkAudioAnalyser;

  /** @private */
  #mlsGenInterface;

  /** @private */
  #mlsBufferView;

  /** @private */
  #numCalibratingRounds = 1;

  /** @private */
  #sinkSamplingRate;

  /** @private */
  #sourceSamplingRate = 96000;

  /**
   * Called when a call is received.
   * Creates a local audio DOM element and attaches it to the page.
   */
  createLocalAudio = targetElement => {
    const localAudio = document.createElement('audio');
    localAudio.setAttribute('id', 'localAudio');
    targetElement.appendChild(localAudio);
  };

  #setSourceAudio = () => {
    const options = {
      sampleRate: this.#sourceSamplingRate,
    };
    this.#sourceAudioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)(options);
  };

  /**
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = async () => {
    const buffer = this.#sourceAudioContext.createBuffer(
      1, // number of channels
      this.#mlsBufferView.length, // length
      this.#sourceSamplingRate // sample rate
    );
    const data = buffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
        for (let i = 0; i < this.#mlsBufferView.length; i += 1) {
          // fill the buffer with 3 copies of the MLS buffer
          data[i] = this.#mlsBufferView[i];
        }
    } catch (error) {
      console.error(error);
    }

    // console.log(buffer.getChannelData(0));

    const source = this.#sourceAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#sourceAudioContext.destination);
    source.start(0);

    console.log(buffer.getChannelData(0));
    console.log(source);

    return sleep(buffer.duration * 2);
  };

  /**
   * Getter for the isCalibrating property.
   * @public
   * @returns {Boolean} - True if the audio is being calibrated, false otherwise.
   */
  getCalibrationStatus = () => this.#isCalibrating;

  /**
   * Create a sink audio context and attach it to the stream
   * @param {*} stream
   */
  #setSinkAudio = stream => {
    this.#sinkAudioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)();
    this.#sinkAudioAnalyser = this.#sinkAudioContext.createAnalyser();
    const source = this.#sinkAudioContext.createMediaStreamSource(stream);
    source.connect(this.#sinkAudioAnalyser);
  };

  /**
   * Set the sink audio sampling rate to the given value
   * @param {*} sinkSamplingRate
   */
  setSinkSamplingRate = sinkSamplingRate => {
    this.#sinkSamplingRate = parseInt(sinkSamplingRate, 10);
  };

  /**
   *
   * @param {*} stream
   */
  #calibrationSteps = async stream => {
    this.#mlsBufferView = this.#mlsGenInterface.getMLS();
    this.generatedMLSChart = new GeneratedSignalChart(
      'generated-signal-chart',
      this.#mlsBufferView,
      this.#sourceSamplingRate
    );

    let numRounds = 0;

    // calibration loop
    while (!this.#isCalibrating && numRounds < this.#numCalibratingRounds) {
      // start recording
      this.startRecording(stream);
      // play calibration audio
      console.log(`Calibration Round ${numRounds}`);
      // eslint-disable-next-line no-await-in-loop
      await this.#playCalibrationAudio().then(() => {
        // when done, stop recording
        console.log('Calibration Round Complete');
        this.stopRecording();
      });
      // eslint-disable-next-line no-await-in-loop
      await sleep(2);
      numRounds += 1;
    }

    saveToCSV(this.getRecordedSignals(0))

    // console.log('Setting Recorded Signal');

    // const recordedSignal = this.#mlsGenInterface.setRecordedSignal(this.getRecordedSignals(0));
    // console.log(recordedSignal);
    // recordedSignal = recordedSignal.slice(recordedSignal.findIndex((val) => val !== 0));

    // this.caputuredMLSChart = new RecordedSignalChart(
    //   'captured-signal-chart',
    //   recordedSignal,
    //   this.#sinkSamplingRate
    // );
    const IR = this.#mlsGenInterface.getImpulseResponse();
    this.IRChart = new IRChart('ir-chart', IR, this.#sinkSamplingRate);
    console.log('TEST IR: ', IR);
  };

  /**
   * Public method to start the calibration process. Objects intialized from webassembly allocate new memory
   * and must be manually freed. This function is responsible for intializing the MlsGenInterface,
   * and wrapping the calibration steps with a garbage collection safe gaurd.
   * @public
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  startCalibration = async stream => {
    this.#setSourceAudio();
    this.#setSinkAudio(stream);
    // initialize the MLSGenInterface object with it's factory method
    await MlsGenInterface.factory(this.#sourceSamplingRate, this.#sinkSamplingRate).then(
      mlsGenInterface => {
        this.#mlsGenInterface = mlsGenInterface;
        // console.log('mlsGenInterface', this.#mlsGenInterface);
      }
    );
    // after intializating, start the calibration steps with garbage collection
    this.#mlsGenInterface.withGarbageCollection(this.#calibrationSteps, [stream]);
  };
}

export default AudioCalibrator;
