import MyEventEmitter from '../myEventEmitter';

/**
 * @class provides a simple interface for recording audio from a microphone
 * using the Media Recorder API.
 */
class AudioRecorder extends MyEventEmitter {
  /** @private */
  #mediaRecorder;

  /** @private */
  #recordedChunks = [];

  /** @private */
  #audioBlob;

  /** @private */
  #audioContext;

  /** @private */
  #recordedSignals = [];

  /** @private */
  sinkSamplingRate;

  /**
   * Decode the audio data from the recorded audio blob.
   *
   * @private
   * @example
   */
  #saveRecording = async () => {
    const arrayBuffer = await this.#audioBlob.arrayBuffer();
    const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);

    console.log(`Decoded audio buffer with ${data.length} samples`);
    this.#recordedSignals.push(Array.from(data));
  };

  /**
   * Event listener triggered when data is available in the media recorder.
   *
   * @private
   * @param e - The event object.
   * @example
   */
  #onRecorderDataAvailable = e => {
    if (e.data && e.data.size > 0) this.#recordedChunks.push(e.data);
  };

  /**
   * Method to create a media recorder object and set up event listeners.
   *
   * @private
   * @param stream - The stream of audio from the Listener.
   * @example
   */
  #setMediaRecorder = stream => {
    // Create a new MediaRecorder object
    this.#mediaRecorder = new MediaRecorder(stream);

    // Add event listeners
    this.#mediaRecorder.ondataavailable = e => this.#onRecorderDataAvailable(e);
  };

  #setAudioContext = () => {
    this.#audioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)({
      sampleRate: this.sinkSamplingRate,
      //sampleRate: 96000
    });
  };

  /**
   * Public method to start the recording process.
   *
   * @param stream - The stream of audio from the Listener.
   * @example
   */
  startRecording = async stream => {
    // Create a fresh audio context
    this.#setAudioContext();
    // Set up media recorder if needed
    if (!this.#mediaRecorder) this.#setMediaRecorder(stream);
    // clear recorded chunks
    this.#recordedChunks = [];
    // start recording
    this.#mediaRecorder.start();
  };

  /**
   * Method to stop the recording process.
   *
   * @public
   * @example
   */
  stopRecording = async () => {
    // Stop the media recorder, and wait for the data to be available
    await new Promise(resolve => {
      this.#mediaRecorder.onstop = () => {
        // when the stop event is triggered, resolve the promise
        this.#audioBlob = new Blob(this.#recordedChunks, {
          type: 'audio/wav; codecs=opus',
        });
        resolve(this.#audioBlob);
      };
      // call stop
      this.#mediaRecorder.stop();
    });
    // Now that we have data, save it
    await this.#saveRecording();
  };

  /** .
   * .
   * .
   * Public method to get the last recorded audio signal
   *
   * @returns
   * @example
   */
  getLastRecordedSignal = () => this.#recordedSignals[this.#recordedSignals.length - 1];

  /** .
   * .
   * .
   * Public method to get all the recorded audio signals
   *
   * @returns
   * @example
   */
  getAllRecordedSignals = () => this.#recordedSignals;

  /** .
   * .
   * .
   * Public method to set the sampling rate used by the capture device
   *
   * @param {Number} sinkSamplingRate - The sampling rate of the capture device
   * @example
   */
  setSinkSamplingRate = sinkSamplingRate => {
    this.sinkSamplingRate = sinkSamplingRate;
  };
}

export default AudioRecorder;
