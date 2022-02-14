/**
 * AudioRecorder provides a simple interface for recording audio from a microphone using the Media Recorder API.
 */
export class AudioRecorder {
  /** @private */
  #mediaRecorder = null;
  /** @private */
  #recordedChunks = [];
  /** @private */
  #audioBlob = null;
  /** @private */
  #audioContext;
  /** @private */
  #fileReader;
  /** @private */
  #arrayBuffer = null;
  // the class constructor
  constructor() {
    this.#audioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)();
    this.#fileReader = new FileReader();
  }

  /**
   * Event listener triggered when the file reader is done loading
   * @private
   */
  #onFileReaderLoad = () => {
    // read the file as an array buffer
    this.#arrayBuffer = this.#fileReader.result;

    // Convert array buffer into audio buffer
    this.#audioContext.decodeAudioData(this.#arrayBuffer, (audioBuffer) => {
      // Do something with audioBuffer
      console.log(audioBuffer.getChannelData(0));
    });
  };

  /**
   * Event listener triggered when data is available in the media recorder.
   * @private
   * @param {*} e - The event object.
   */
  #onRecorderDataAvailable = (e) => {
    if (e.data.size > 0) this.#recordedChunks.push(e.data);
  };

  /**
   * Event listener triggered when the media recorder stops recording.
   * @private
   */
  #onRecorderStop = () => {
    // Create a blob from the recorded audio chunks
    this.#audioBlob = new Blob(this.#recordedChunks, {
      type: "audio/wav; codecs=MS_PCM",
    });

    // Set up file reader on loaded end event
    this.#fileReader.onloadend = this.#onFileReaderLoad;

    //Load blob
    this.#fileReader.readAsArrayBuffer(this.#audioBlob);
  };

  /**
   * Method to create a media recorder object and set up event listeners.
   * @private
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  #setMediaRecorder = (stream) => {
    // Create a new MediaRecorder object
    this.#mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    // Add event listeners
    this.#mediaRecorder.ondataavailable = (e) =>
      this.#onRecorderDataAvailable(e);
    this.#mediaRecorder.onstop = () => this.#onRecorderStop();
  };

  /**
   * Public method to start the recording process.
   * @param {MediaStream} stream - The stream of audio from the Listener.
   */
  startRecording = (stream) => {
    // Set up media recorder if needed
    if (this.#mediaRecorder === null) this.#setMediaRecorder(stream);
    this.#mediaRecorder.start();
  };

  /**
   * Method to stop the recording process.
   * @public
   */
  stopRecording = () => {
    this.#mediaRecorder.stop();
  };
}
