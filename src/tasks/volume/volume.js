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
  outDBSPL = null;
  THD = null;
  outDBSPL1000 = null;

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

  #sendToServerForProcessing = (lCalib = 104.92978421490648) => {
    console.log('Sending data to server');
    this.pyServerAPI
      .getVolumeCalibration({
        sampleRate: this.sourceSamplingRate,
        payload: this.#getTruncatedSignal(),
        lCalib: lCalib,
      })
      .then(res => {
        if (this.outDBSPL === null) {
          this.outDBSPL = res['outDbSPL'];
          this.outDBSPL1000 = res['outDbSPL1000'];
          this.THD = res['thd'];
        }
      })
      .catch(err => {
        console.warn(err);
      });
  };

  startCalibration = async (stream, gainValues, lCalib = 104.92978421490648) => {
    const trialIterations = gainValues.length;
    const thdValues = [];
    const inDBValues = [];
    let inDB = 0;
    const outDBSPLValues = [];
    const outDBSPL1000Values = [];

    // do one calibration that will be discarded
    const soundLevelToDiscard = -80;
    const gainToDiscard = Math.pow(10, soundLevelToDiscard / 20);
    this.emit('update', {message: `Sound Level: ${soundLevelToDiscard} dB`});
    do {
      // eslint-disable-next-line no-await-in-loop
      await this.volumeCalibrationSteps(
        stream,
        this.#playCalibrationAudio,
        this.#createCalibrationNode,
        this.#sendToServerForProcessing,
        gainToDiscard,
        lCalib //todo make this a class parameter
      );
    } while (this.outDBSPL === null);
    //reset the values
    this.outDBSPL = null;
    this.outDBSPL = null;
    this.outDBSPL1000 = null;
    this.THD = null;

    // run the calibration at different gain values provided by the user
    for (let i = 0; i < trialIterations; i++) {
      //convert gain to DB and add to inDB
      inDB = Math.log10(gainValues[i]) * 20;
      // precision to 1 decimal place
      inDB = Math.round(inDB * 10) / 10;
      inDBValues.push(inDB);
      this.emit('update', {message: `Sound Level: ${inDB} dB`});
      do {
        // eslint-disable-next-line no-await-in-loop
        await this.volumeCalibrationSteps(
          stream,
          this.#playCalibrationAudio,
          this.#createCalibrationToneWithGainValue,
          this.#sendToServerForProcessing,
          gainValues[i],
          lCalib //todo make this a class parameter
        );
      } while (this.outDBSPL === null);
      outDBSPL1000Values.push(this.outDBSPL1000);
      thdValues.push(this.THD);
      outDBSPLValues.push(this.outDBSPL);

      this.outDBSPL = null;
      this.outDBSPL1000 = null;
      this.THD = null;
    }

    // get the volume calibration parameters from the server
    const parameters = await this.pyServerAPI
      .getVolumeCalibrationParameters({
        inDBValues: inDBValues,
        outDBSPLValues: outDBSPL1000Values,
        lCalib: lCalib,
      })
      .then(res => {
        return res;
      });
    const result = {
      parameters: parameters,
      inDBValues: inDBValues,
      outDBSPLValues: outDBSPLValues,
      outDBSPL1000Values: outDBSPL1000Values,
      thdValues: thdValues,
    };

    return result;
  };
}

export default Volume;
