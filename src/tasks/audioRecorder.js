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

  /**@private */
  #allHzUnfilteredRecordings = [];

  /**@private */
  #allBackgroundRecordings = [];

  /** @private */
  #allHzFilteredRecordings = [];

  /** @private */
  sinkSamplingRate;

  /** @private */
  sampleSize;

  /** @private */
  #allVolumeRecordings = [];

  /** @private */
  flags = {};

  /**
   * Decode the audio data from the recorded audio blob.
   *
   * @private
   * @example
   */
  #saveRecording = async (mode, checkRec) => {
    const arrayBuffer = await this.#audioBlob.arrayBuffer();
    const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
    console.log(audioBuffer);
    const data = audioBuffer.getChannelData(0);
    const dataArray = Array.from(data);

    console.log(`Decoded audio buffer with ${data.length} samples`);
    console.log(`Unfiltered recording should be of length: ${data.length}`);
    if (checkRec == 'loudest') {
      const uniqueSet = new Set(dataArray);
      const numberOfUniqueValues = uniqueSet.size;
      const squaredValues = dataArray.map(value => value * value);
      const sum_of_squares = squaredValues.reduce((total, value) => total + value, 0);
      const squared_mean = sum_of_squares / dataArray.length;
      const dbLevel = 20 * Math.log10(Math.sqrt(squared_mean));
      const roundedDbLevel = Math.round(dbLevel * 10) / 10;
      console.log(
        'Loudest 1000-Hz recording: ' +
          roundedDbLevel +
          ' dB with ' +
          numberOfUniqueValues +
          ' unique values.'
      );
    } else if (checkRec == 'allhz') {
      const uniqueSet = new Set(dataArray);
      const numberOfUniqueValues = uniqueSet.size;
      const squaredValues = dataArray.map(value => value * value);
      const sum_of_squares = squaredValues.reduce((total, value) => total + value, 0);
      const squared_mean = sum_of_squares / dataArray.length;
      const dbLevel = 20 * Math.log10(Math.sqrt(squared_mean));
      const roundedDbLevel = Math.round(dbLevel * 10) / 10;
      console.log(
        'All Hz Recording: ' +
          roundedDbLevel +
          ' dB with ' +
          numberOfUniqueValues +
          ' unique values.'
      );
    }
    if (mode === 'volume') {
      console.log('Saving 1000 Hz Recording to #allVolumeRecordings');
      this.#allVolumeRecordings.push(dataArray);
    } else if (mode === 'unfiltered') {
      console.log('Saving unfiltered all Hz recording to #allHzUnfilteredRecordings');
      this.#allHzUnfilteredRecordings.push(dataArray);
    } else if (mode === 'filtered') {
      console.log('Saving filtered all hz recording to #allHzFilteredRecordings');
      this.#allHzFilteredRecordings.push(dataArray);
    } else if (mode === 'background') {
      console.log('Saving background recording to #allBackgroundRecordings');
      this.#allBackgroundRecordings.push(dataArray);
    }
  };

  saveVolumeRecording = async dataArray => {
    this.#allVolumeRecordings.push(dataArray);
  };

  #saveFilteredRecording = async () => {
    const arrayBuffer = await this.#audioBlob.arrayBuffer();
    const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);

    console.log(`Decoded audio buffer with ${data.length} samples`);
    console.log(`Filtered recording should be of length: ${data.length}`);
    this.#allHzFilteredRecordings.push(Array.from(data));
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

  #removeMediaRecorder = () => {
    this.#mediaRecorder.ondataavailable = null;
    this.#mediaRecorder = null;
  };

  #setAudioContext = () => {
    this.#audioContext = new (window.AudioContext ||
      window.webkitAudioContext ||
      window.audioContext)({
      sampleRate: this.sinkSamplingRate,
      sampleSize: this.sampleSize,
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
    try {
      // Create a fresh audio context
      this.#setAudioContext();
      // Set up media recorder if needed
      if (!this.#mediaRecorder) this.#setMediaRecorder(stream);
      // clear recorded chunks
      this.#recordedChunks = [];
      if (this.#mediaRecorder.state === 'recording') {
        this.#mediaRecorder.stop();
      }
      // start recording
      this.#mediaRecorder.start();
    } catch (error) {
      console.error('Error in startRecording:', error);
      // Handle the error as needed, e.g., throw it or perform error-specific actions
    }
  };

  /**
   * Method to stop the recording process.
   *
   * @public
   * @example
   */
  stopRecording = async (mode, checkRec) => {
    try {
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
      await this.#saveRecording(mode, checkRec);
    } catch (error) {
      console.error('Error in stopRecording:', error);
      // Handle the error as needed, e.g., throw it or perform error-specific actions
    }
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
   * Public method to get the last 1000hz recorded audio signal
   *
   * @returns
   * @example
   */
  getLastVolumeRecordedSignal = () =>
    Array.from(this.#allVolumeRecordings[this.#allVolumeRecordings.length - 1]);

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
   * Public method to get all the recorded audio signals
   *
   * @returns
   * @example
   */
  getAllVolumeRecordedSignals = () => this.#allVolumeRecordings;

  /** .
   * .
   * .
   * Public method to get all the recorded audio signals
   *
   * @returns
   * @example
   */
  getAllFilteredRecordedSignals = () => this.#allHzFilteredRecordings;

  /** .
   * .
   * .
   * Public method to get all the recorded audio signals
   *
   * @returns
   * @example
   */
  clearAllFilteredRecordedSignals = () => (this.#allHzFilteredRecordings = []);

  /** .
   * .
   * .
   * Public method to clear last the recorded audio signals
   *
   * @returns
   * @example
   */
  clearLastFilteredRecordedSignals = () => this.#allHzFilteredRecordings.pop();

  /** .
   * .
   * .
   * Public method to get all the recorded audio signals for psd
   *
   * @returns
   * @example
   */
  getAllUnfilteredRecordedSignals = () => this.#allHzUnfilteredRecordings;

  /** .
   * .
   * .
   * Public method to get all the recorded audio signals
   *
   * @returns
   * @example
   */
  clearLastUnfilteredRecordedSignals = () => this.#allHzUnfilteredRecordings.pop();

  /** .
   * .
   * .
   * Public method to save a simulated unfiltered recording directly
   *
   * @param {Array<number>} dataArray - The simulated recording data
   * @example
   */
  saveUnfilteredRecording = async dataArray => {
    this.#allHzUnfilteredRecordings.push(dataArray);
  };

  /** .
   * .
   * .
   * Public method to save a simulated filtered recording directly
   *
   * @param {Array<number>} dataArray - The simulated filtered recording data
   * @example
   */
  saveFilteredRecording = async dataArray => {
    this.#allHzFilteredRecordings.push(dataArray);
  };

  /** .
   * .
   * .
   * Public method to get all the recorded audio signals for psd
   *
   * @returns
   * @example
   */
  getAllBackgroundRecordings = () => this.#allBackgroundRecordings;

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
