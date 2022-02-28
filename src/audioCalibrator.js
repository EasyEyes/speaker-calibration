import AudioRecorder from "./audioRecorder";
import visualize from "./visualize";
import MlsGenInterface from "./mlsGen/mlsGenInterface";

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
  #mlsData;

  // the class constructor
  constructor() {
    super();
    this.#mlsGenInterface = new MlsGenInterface();
  }

  /**
   * Called when a call is received.
   * Creates a local audio DOM element and attaches it to the page.
   */
  createLocalAudio = (targetElement) => {
    const localAudio = document.createElement("audio");
    localAudio.setAttribute("id", "localAudio");
    targetElement.appendChild(localAudio);
  };

  /**
   * Converts a Uint8Array to a correct Buffer
   * @param {Uint8Array} array
   * @returns
   */
  #typedArrayToBuffer = (array) =>
    array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);

  /**
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = () => {
    const buffer = new ArrayBuffer(this.#mlsData.length);
    const view = new Uint8Array(buffer);
    const duration = 2000;
    // const buffer = this.#typedArrayToBuffer(this.#mlsData);

    // console.log({ buffer });

    for (let i; i < this.#mlsData.length; i += 1) {
      view[i] = this.#mlsData[i];
    }

    this.#sourceAudioContext = new AudioContext();

    // TODO: Uncaught (in promise) DOMException: Unable to decode audio data
    // Possibly to do with the type of audio data being passed in.
    this.#sourceAudioContext.decodeAudioData(buffer).then((buf) => {
      // Create a source node from the buffer
      this.#sourceAudio = this.#sourceAudioContext.createBufferSource();
      this.#sourceAudio.buffer = buf;
      // Connect to the final output node (the speakers)
      this.#sourceAudio.connect(this.#sourceAudioContext.destination);
      // Play immediately
      this.#sourceAudio.start(0);
    });

    // let's return a promise so we can await the end of each track
    return new Promise((resolve) => {
      setTimeout(resolve, duration * 2);
    });
  };

  /**
   * Getter for the isCalibrating property.
   * @public
   * @returns {Boolean} - True if the audio is being calibrated, false otherwise.
   */
  getCalibrationStatus = () => this.#isCalibrating;

  setSinkAudio = (stream) => {
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
  startCalibration = async (stream) => {
    this.setSinkAudio(stream);
    this.#mlsData = this.#mlsGenInterface.getMls();

    let numRounds = 0;

    while (!this.#isCalibrating && numRounds <= 2) {
      // start recording
      this.startRecording(stream);
      // play calibration audio
      // eslint-disable-next-line no-await-in-loop
      await this.#playCalibrationAudio().then(() => {
        // when done, stop recording
        this.stopRecording();
      });
      numRounds += 1;
    }
  };
}

export default AudioCalibrator;
