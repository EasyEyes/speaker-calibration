import AudioRecorder from './audioRecorder';
import {sleep, saveToCSV} from './utils';
import MlsGenInterface from './mlsGen/mlsGenInterface';
import {GeneratedSignalChart, RecordedSignalChart} from './myCharts';

/**
 * Provides methods for calibrating the user's speakers
 * @extends AudioRecorder
 */
class AudioCalibrator extends AudioRecorder {
  /** @private */
  #isCalibrating = false;

  /** @private */
  #plot = true;

  /** @private */
  #download = true;

  /** @private */
  #sourceAudioContext;

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

  /** @private */
  #calibrationNodes = [];

  /**
   * Called when a call is received.
   * Creates a local audio DOM element and attaches it to the page.
   */
  createLocalAudio = targetElement => {
    const localAudio = document.createElement('audio');
    localAudio.setAttribute('id', 'localAudio');
    targetElement.appendChild(localAudio);
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   * @private
   */
  #addCalibrationNode = () => {
    const options = {
      sampleRate: this.#sourceSamplingRate,
    };
    this.#sourceAudioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)(options);

    const buffer = this.#sourceAudioContext.createBuffer(
      1, // number of channels
      this.#mlsBufferView.length, // length
      this.#sourceAudioContext.sampleRate // sample rate
    );
    const data = buffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < this.#mlsBufferView.length; i += 1) {
        // fill the array with the MLS buffer
        data[i] = this.#mlsBufferView[i];
      }
    } catch (error) {
      console.error(error);
    }

    const source = this.#sourceAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#sourceAudioContext.destination);

    this.#calibrationNodes.push(source);
  };

  /**
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = async () => {
    // workaround, let's create and play 2 nodes in sequence
    // TODO: fix the MLS generation so that it's order p^19 which equates to 5 seconds of audio
    while (this.#calibrationNodes.length < 2) {
      this.#addCalibrationNode();
    }
    this.#calibrationNodes[0].start(0);
    this.#calibrationNodes[1].start(this.#calibrationNodes[0].buffer.duration);
    return sleep(this.#calibrationNodes[0].buffer.duration * 2.2);
  };

  /**
   * Getter for the isCalibrating property.
   * @public
   * @returns {Boolean} - True if the audio is being calibrated, false otherwise.
   */
  getCalibrationStatus = () => this.#isCalibrating;

  /**
   * Set the sink audio sampling rate to the given value
   * @param {*} sinkSamplingRate
   */
  setSinkSamplingRate = sinkSamplingRate => {
    this.#sinkSamplingRate = sinkSamplingRate;
    console.log('sink sampling rate', this.#sinkSamplingRate);
  };

  /**
   *
   * @param {*} stream
   */
  #calibrationSteps = async stream => {
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

    // if download set, download the CSV file
    if (this.#download) {
      saveToCSV(this.getRecordedSignals(0));
    }

    // if plot set, plot the signals
    if (this.#plot) {
      // this.generatedMLSChart = new GeneratedSignalChart(
      //   'generated-signal-chart',
      //   this.#mlsBufferView,
      //   this.#sourceSamplingRate
      // );

      this.caputuredMLSChart = new RecordedSignalChart(
        'captured-signal-chart',
        this.getRecordedSignals(0),
        this.#sinkSamplingRate
      );
    }
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
    await MlsGenInterface.factory(this.#sinkSamplingRate, this.#sourceSamplingRate).then(
      mlsGenInterface => {
        this.#mlsGenInterface = mlsGenInterface;
        this.#mlsBufferView = this.#mlsGenInterface.getMLS();
      }
    );
    // after intializating, start the calibration steps with garbage collection
    this.#mlsGenInterface.withGarbageCollection(this.#calibrationSteps, [stream]);
  };
}

export default AudioCalibrator;
