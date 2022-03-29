/**
 * @class provides a simple interface for recording audio from a microphone
 * using the Media Recorder API.
 */
class AudioRecorder {
  /** @private */
  #mediaRecorder;

  /** @private */
  #recordedChunks = [];

  /** @private */
  #audioBlob;

  /** @private */
  #audioContext;

  /** @private */
  #arrayBuffer;

  /** @private */
  #recordedSignals = [];

  /** @private */
  sinkSamplingRate;

  #saveRecording = async () => {
    this.#arrayBuffer = await this.#audioBlob.arrayBuffer();

    // Convert array buffer into audio buffer
    await this.#audioContext.decodeAudioData(this.#arrayBuffer, audioBuffer => {
      const data = audioBuffer.getChannelData(0);
      console.log(`Decoded audio data: ${data.length} samples`);
      this.#recordedSignals.push(data);
    });
  };

  /**
   * Event listener triggered when data is available in the media recorder.
   * @private
   * @param {*} e - The event object.
   */
  #onRecorderDataAvailable = e => {
    if (e.data && e.data.size > 0) this.#recordedChunks.push(e.data);
  };

  /**
   * Method to create a media recorder object and set up event listeners.
   * @private
   * @param {MediaStream} stream - The stream of audio from the Listener.
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
    });

    console.log(this.#audioContext);
  };

  /**
   * Public method to start the recording process.
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  startRecording = async stream => {
    // Set up media recorder if needed
    // await this.#applyTrackContraints(stream);
    this.#setAudioContext();
    if (!this.#mediaRecorder) this.#setMediaRecorder(stream);
    this.#recordedChunks = [];
    this.#mediaRecorder.start();
  };

  /**
   * Method to stop the recording process.
   * @public
   */
  stopRecording = async () => {
    // Stop the media recorder, and wait for the data to be available
    await new Promise(resolve => {
      this.#mediaRecorder.onstop = () => {
        // when the stop event is triggered, resolve the promise
        this.#audioBlob = new Blob(this.#recordedChunks, {
          type: 'audio/ogg; codecs=opus',
        });
        resolve(this.#audioBlob);
      };
      // call stop
      this.#mediaRecorder.stop();
    });
    // Now that we have data, save it
    await this.#saveRecording();
  };

  getLastRecordedSignal = () => this.#recordedSignals[this.#recordedSignals.length - 1];

  getAllRecordedSignals = () => this.#recordedSignals;

  setSinkSamplingRate = sinkSamplingRate => {
    this.sinkSamplingRate = sinkSamplingRate;
  }
}

export default AudioRecorder;
