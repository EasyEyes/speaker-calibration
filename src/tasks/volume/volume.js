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

  handleIncomingData = data => {
    console.log('Received data: ', data);
    if (data.type === 'soundGainDBSPL') {
      this.soundGainDBSPL = data.value;
    } else {
      throw new Error(`Unknown data type: ${data.type}`);
    }
  };

  #getTruncatedSignal = () => {
    const start = Math.floor(3.5 * this.sourceSamplingRate);
    const end = Math.floor(4.5 * this.sourceSamplingRate);
    const result = Array.from(this.getLastRecordedSignal().slice(start, end));
    return result;
  };

  getSoundGainDBSPL = () => this.soundGainDBSPL;

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
    // TODO: try to ramp the sin wave up instead of playing it at max amplitude from 0
    // gainNode.gain.value = 0;
    // gainNode.gain.setValueAtTime(0, 0);
    // gainNode.gain.linearRampToValueAtTime(1, 6);

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

  startCalibration = async stream => {
    await this.calibrationSteps(stream, this.#playCalibrationAudio, this.#createCalibrationNode);
    console.log('Sending calibration data to server');

    this.soundGainDBSPL = await this.pyServer.getVolumeCalibration({
      sampleRate: this.sourceSamplingRate,
      payload: this.#getTruncatedSignal(),
    });

    console.log(`Sound gain: ${this.soundGainDBSPL}`);
    return this.soundGainDBSPL;
  };
}

export default Volume;
