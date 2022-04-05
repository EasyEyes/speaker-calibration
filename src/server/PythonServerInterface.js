import {io} from 'socket.io-client';

/**
 *
 */
class PythonServerInterface {
  static PYTHON_SERVER_URL = 'https://easyeyes-python-server.herokuapp.com';

  /**
   *
   * @param {string} url
   */
  constructor(url = PythonServerInterface.PYTHON_SERVER_URL) {
    // 'http://localhost:3001/'
    this.socket = io(url);
  }

  getImpulseResponse = async data => {
    this.asyncEmit('data', {
      task: 'impulse-response',
      data,
    });
  };

  getVolumeCalibration = async data => {
    const result = await this.asyncEmit('data', {
      task: 'volume-calibration',
      data,
    });
    const tokens = result.data.split(',');
    console.log({tokens});
    return parseFloat(tokens[0]);
  };

  asyncEmit = (eventName, data) =>
    new Promise((resolve, reject) => {
      console.log({eventName, data});
      this.socket.emit(eventName, data);
      console.log('Awaiting response from Python server...');
      this.socket.on(eventName, result => {
        resolve(result);
      });
      setTimeout(reject, 20000);
    });
}

export default PythonServerInterface;
