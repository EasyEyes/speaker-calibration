import { AudioRecorder } from "./audioRecorder.js";

class AudioCalibrator extends AudioRecorder {
  /** @private */
  #isCalibrating = false;
  /** @private */
  #sourceAudioContext = null;
  // the class constructor
  constructor() {
    super();
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
   * Creates an audio context and plays it for a few seconds.
   * @private
   * @returns {Promise} - Resolves when the audio is done playing.
   */
  #playCalibrationAudio = () => {
    this.#sourceAudioContext = new AudioContext();
    const oscillator = this.#sourceAudioContext.createOscillator();
    const gainNode = this.#sourceAudioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.#sourceAudioContext.destination);

    const duration = 2000;

    oscillator.start(this.#sourceAudioContext.currentTime);
    oscillator.stop(this.#sourceAudioContext.currentTime + duration / 1000);

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
  getCalibrationStatus = () => {
    return this.#isCalibrating;
  }

  /**
   * Method to start the calibration process.
   * @public
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  startCalibration = async (stream) => {
    let numRounds = 0;

    while (!this.#isCalibrating && numRounds <= 2) {
      // start recording
      this.startRecording(stream);
      // play calibration audio
      await this.#playCalibrationAudio().then(() => {
        // when done, stop recording
        this.stopRecording();
        numRounds++;
      });
    }
  };
}

export { AudioCalibrator };
