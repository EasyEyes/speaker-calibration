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
  power = null;
  power1000 = null;
  RMS = null;
  THD = null;
  outDBSPL1000 = null;
  soundGainDBSPL1000 = null;

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
          this.outDBSPL = res['outDbSPL'];
          this.soundGainDBSPL = res['soundGainDbSPL'];
          this.outDBSPL1000 = res['outDbSPL1000'];
          this.power = res['power']
          this.power1000 = res['power1000']
          this.THD = res['thd']
          this.RMS = res['rms']
          this.soundGainDBSPL1000 = res['soundGainDbSPL1000'];
        }
      })
      .catch(err => {
        console.warn(err);
      });
  };

  startCalibration = async (stream, gainValues) => {
    const trialIterations = gainValues.length;
    const soundGainDBSPLValues = [];
    const soundGainDBSPL1000Values = [];
    const power1000Values = [];
    const powerValues = [];
    const rmsValues = [];
    const thdValues = [];
    const inDBValues = [];
    let inDB = 0;
    const outDBSPLValues = [];
    const outDBSPL1000Values = [];

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
      outDBSPL1000Values.push(this.outDBSPL1000);
      power1000Values.push(this.power1000);
      powerValues.push(this.power);
      rmsValues.push(this.RMS);
      thdValues.push(this.THD);
      outDBSPLValues.push(this.outDBSPL);
      soundGainDBSPLValues.push(this.soundGainDBSPL);
      soundGainDBSPL1000Values.push(this.soundGainDBSPL1000);

      this.outDBSPL = null;
      this.soundGainDBSPL = null;
      this.power1000 = null;
      this.power = null;
      this.outDBSPL1000 = null;
      this.RMS = null;
      this.THD = null;
      this.soundGainDBSPL1000=null;
    }

    // get the volume calibration parameters from the server
    const parameters = await this.pyServerAPI
      .getVolumeCalibrationParameters({inDBValues: inDBValues, outDBSPLValues: outDBSPL1000Values})
      .then(res => {
        return res;
      });
    const result = {
      parameters: parameters,
      inDBValues: inDBValues,
      outDBSPLValues: outDBSPLValues,
      soundGainDBSPLValues: soundGainDBSPLValues,
      powerValues: powerValues,
      power1000Values: power1000Values,
      outDBSPL1000Values: outDBSPL1000Values,
      rmsValues: rmsValues,
      thdValues: thdValues,
      soundGainDBSPL1000Values: soundGainDBSPL1000Values
    };

    return result;
  };
}

export default Volume;
