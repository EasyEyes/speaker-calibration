import AudioCalibrator from '../audioCalibrator';

import {sleep} from '../../utils';

/**
 *
 */
class Volume extends AudioCalibrator {
  /**
   *
   */
  constructor(numCalibrationRounds = 1, numCalibrationNodes = 1) {
    super(numCalibrationRounds, numCalibrationNodes);
  }

  /** @private */
  #CALIBRATION_TONE_FREQUENCY = 1000; // Hz

  /** @private */
  #CALIBRATION_TONE_TYPE = 'sine';

  /** @private */
  #CALIBRATION_TONE_DURATION = 5; // seconds

  /** @private */
  soundGainDBSPL = null;

  #getTruncatedSignal = (left = 3.5, right = 4.5) => {
    const start = Math.floor(left * this.sourceSamplingRate);
    const end = Math.floor(right * this.sourceSamplingRate);
    const result = Array.from(this.getLastRecordedSignal().slice(start, end));
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
   * Construct a Calibration Node with the calibration parameters.
   * @private
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
    const actualDuration = this.#CALIBRATION_TONE_DURATION * this.numCalibrationNodes;
    const totalDuration = actualDuration * 1.2;
    for (let i = 0; i < this.calibrationNodes.length; i += 1) {
      this.calibrationNodes[i].start(i * this.#CALIBRATION_TONE_DURATION);
      this.calibrationNodes[i].stop(
        i * this.#CALIBRATION_TONE_DURATION + this.#CALIBRATION_TONE_DURATION
      );
    }
    console.log(`Playing a buffer of ${actualDuration} seconds of audio`);
    console.log(`Waiting a total of ${totalDuration} seconds`);
    await sleep(totalDuration);
  };

  #sendToServerForProcessing = () => {
    console.log('Sending data to server');
    this.pyServer
      .getVolumeCalibration({
        sampleRate: this.sourceSamplingRate,
        payload: this.#getTruncatedSignal(),
      })
      .then(res => {
        if (this.soundGainDBSPL === null) {
          this.soundGainDBSPL = res;
        }
      })
      .catch(err => {
        console.warn(err);
      });
  };

  startCalibration = async stream => {
    do {
      await this.calibrationSteps([
        stream,
        [this.#playCalibrationAudio, this.#createCalibrationNode, this.#sendToServerForProcessing],
      ]);
    } while (this.soundGainDBSPL === null);

    return this.soundGainDBSPL;
  };
}

export default Volume;
