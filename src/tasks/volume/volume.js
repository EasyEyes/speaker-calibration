import AudioCalibrator from '../audioCalibrator';
import axios from 'axios';
import {sleep} from '../../utils';

/**
 *
 */
class Volume extends AudioCalibrator {
  /**
   *
   * @param root0
   * @param root0.download
   * @param root0.numCalibrationRounds
   * @param root0.numCalibrationNodes
   * @example
   */

  /** @private */
  #CALIBRATION_TONE_FREQUENCY = 1000; // Hz

  /** @private */
  #CALIBRATION_TONE_TYPE = 'sine';

  /** @private */
  #CALIBRATION_TONE_DURATION = 5; // seconds

  /** @private */
  soundGainDBSPL = null;
  outDBSPL = null;

  handleIncomingData = data => {
    console.log('Received data: ', data);
    if (data.type === 'soundGainDBSPL') {
      this.soundGainDBSPL = data.value;
    } else {
      throw new Error(`Unknown data type: ${data.type}`);
    }
  };

  #getTruncatedSignal = (left = 3.5, right = 4.5) => {
    const start = Math.floor(left * this.sourceSamplingRate);
    const end = Math.floor(right * this.sourceSamplingRate);
    const result = Array.from(this.getLastRecordedSignal().slice(start, end));

    /**
     * function to check that capture was properly made
     * @param {*} list
     */
    const checkResult = list => {
      const setItem = new Set(list);
      if (setItem.size === 1 && setItem.has(0)) {
        console.warn(
          'The last capture failed, all recorded signal is zero',
          this.getAllRecordedSignals()
        );
      }
      if (setItem.size === 0) {
        console.warn('The last capture failed, no recorded signal');
      }
    };
    checkResult(result);
    return result;
  };

  /** 
   * 
   * 
    Construct a calibration Node with the calibration parameters and given gain value
   * @param {*} gainValue
   * */
  #createCalibrationToneWithGainValue = gainValue => {
    const audioContext = this.makeNewSourceAudioContext();
    const oscilator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscilator.frequency.value = this.#CALIBRATION_TONE_FREQUENCY;
    oscilator.type = this.#CALIBRATION_TONE_TYPE;
    gainNode.gain.value = gainValue;

    oscilator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    this.addCalibrationNode(oscilator);
  };

  /**
   * Construct a Calibration Node with the calibration parameters.
   *
   * @private
   * @example
   */
  #createCalibrationNode = () => {
    const audioContext = this.makeNewSourceAudioContext();
    const oscilator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscilator.frequency.value = this.#CALIBRATION_TONE_FREQUENCY;
    oscilator.type = this.#CALIBRATION_TONE_TYPE;
    gainNode.gain.value = 0.04;

    oscilator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    this.addCalibrationNode(oscilator);
  };

  #playCalibrationAudio = async () => {
    const totalDuration = this.#CALIBRATION_TONE_DURATION * 1.2;

    this.calibrationNodes[0].start(0);
    this.calibrationNodes[0].stop(totalDuration);
    console.log(`Playing a buffer of ${this.#CALIBRATION_TONE_DURATION} seconds of audio`);
    console.log(`Waiting a total of ${totalDuration} seconds`);
    await sleep(totalDuration);
  };

  #sendToServerForProcessing = () => {
    console.log('Sending data to server');
    this.pyServerAPI
      .getVolumeCalibration({
        sampleRate: this.sourceSamplingRate,
        payload: this.#getTruncatedSignal(),
      })
      .then(res => {
        if (this.outDBSPL === null) {
          this.outDBSPL = res;
        }
      })
      .catch(err => {
        console.warn(err);
      });
  };

  startCalibration = async (stream, gainValues) => {
    const trialIterations = gainValues.length;
    const soundGainDBSPLValues = [];
    const inDBValues = [];
    let inDB = 0;
    const outDBSPLValues = [];

    // run the calibration at different gain values provided by the user
    for (let i = 0; i < trialIterations; i++) {
      //convert gain to DB and add to inDB
      inDB = Math.log10(gainValues[i]) * 20;
      inDBValues.push(inDB);

      do {
        // eslint-disable-next-line no-await-in-loop
        await this.volumeCalibrationSteps(
          stream,
          this.#playCalibrationAudio,
          this.#createCalibrationToneWithGainValue,
          this.#sendToServerForProcessing,
          gainValues[i]
        );
      } while (this.outDBSPL === null);
      outDBSPLValues.push(this.outDBSPL);
      this.outDBSPL = null;
    }

    // get the volume calibration parameters from the server
    const parameters = await this.pyServerAPI
      .getVolumeCalibrationParameters({inDBValues: inDBValues, outDBSPLValues: outDBSPLValues})
      .then(res => {
        // console.log(res);
        return res;
      });
    console.log('Parameters: ', parameters);
    // return soundGainDBSPLValues;
    return parameters;
  };
}

export default Volume;
