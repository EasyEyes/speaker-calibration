import AudioRecorder from './audioRecorder';
import {sleep, visualize} from './utils';
import MlsGenInterface from './mlsGen/mlsGenInterface';

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

  /**
   * Creates an instance of AudioCalibrator
   * Makes a call to the super constructor, and initializes MLSGenInterface
   */
  constructor() {
    super();
  }

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
   * Converts a Float32Array to a correct Buffer
   * @param {Float32Array} array
   * @returns
   */
  #typedArrayToBuffer = array =>
    array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);

  /**
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = async () => {
    this.#sourceAudioContext = new AudioContext();

    const duration = this.#mlsBufferView.length;
    const bufferSize = duration; // duration * this.#sourceAudioContext.sampleRate; // use function above //new ArrayBuffer(this.#mlsData.length);
    // console.log({'mlsBufferView': this.#mlsBufferView, duration, bufferSize, 'sampleRate': this.#sourceAudioContext.sampleRate});
    const buffer = this.#sourceAudioContext.createBuffer(
      1,
      bufferSize,
      this.#sourceAudioContext.sampleRate
    );
    const data = buffer.getChannelData(0); // get data
    // fill the buffer with our data
    try {
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = this.#mlsBufferView[i];
      }
    } catch (error) {
      console.error(error);
    }

    console.log(buffer.getChannelData(0));

    const source = this.#sourceAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#sourceAudioContext.destination);
    source.start(0);

    // let's return a promise so we can await the end of each track
    await sleep(5);
    await this.#sourceAudioContext.suspend();
    return this.#sourceAudioContext.close();
  };

  /**
   * Getter for the isCalibrating property.
   * @public
   * @returns {Boolean} - True if the audio is being calibrated, false otherwise.
   */
  getCalibrationStatus = () => this.#isCalibrating;

  setSinkAudio = stream => {
    this.#sinkAudioContext = new AudioContext();
    this.#sinkAudioAnalyser = this.#sinkAudioContext.createAnalyser();
    const source = this.#sinkAudioContext.createMediaStreamSource(stream);
    source.connect(this.#sinkAudioAnalyser);
    visualize(this.#sinkAudioAnalyser);
  };

  /**
   * Method to start the calibration process.
   * @public
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  startCalibration = async stream => {
    this.setSinkAudio(stream);

    await MlsGenInterface.factory().then(async mlsGenInterface => {
      this.#mlsGenInterface = mlsGenInterface;
      console.assert(this.#mlsGenInterface instanceof MlsGenInterface);
      this.#mlsBufferView = this.#mlsGenInterface.getMls();

      let numRounds = 0;

      while (!this.#isCalibrating && numRounds <= 2) {
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
    });
  };
}

export default AudioCalibrator;
