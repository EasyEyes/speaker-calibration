import {io} from 'socket.io-client';

/**
 *
 */
class PythonServerInterface {
  static PYTHON_SERVER_URL = 'https://easyeyes-python-server.herokuapp.com';
  static TEST_SERVER_URL = 'http://localhost:3001';

  /**
   *
   * @param {string} url
   */
  constructor(
    url = process.env.PY_SERVER_DEBUG
      ? PythonServerInterface.TEST_SERVER_URL
      : PythonServerInterface.PYTHON_SERVER_URL
  ) {
    // 'http://localhost:3001/'
    this.socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 99999,
    });
  }

  /**
   * @param {array} data
   * g = inverted impulse response, when convolved with the impulse
   * reponse, they cancel out.
   * @returns {Float<array>}
   */
  getImpulseResponse = async data => {
    let res = null;

    try {
      const serverResponse = await this.asyncEmit('data', {
        task: 'impulse-response',
        data,
      });

      const g = serverResponse.data
        .trim()
        .split(',')
        .map(value => parseFloat(value));

      res = g;
    } catch (error) {
      console.error(error);
    }

    return res;
  };

  getVolumeCalibration = async data => {
    let serverRep;
    let res;
    try {
      serverRep = await this.asyncEmit('data', {
        task: 'volume-calibration',
        data,
      });
      const [soundGainDbSPL, P, L, vectorDb] = serverRep.data
        .trim()
        .split(',')
        .map(resp => parseFloat(resp.split(':')[1]));
      res = soundGainDbSPL;
    } catch (e) {
      throw new Error(e);
    }
    return res;
  };

  asyncEmit = (eventName, data) =>
    new Promise((resolve, reject) => {
      this.socket.emit(eventName, data);
      this.socket.on(eventName, result => {
        resolve(result);
      });
      this.socket.on('error', error => {
        reject(error);
      });
      setTimeout(reject, 60000);
    });
}

export default PythonServerInterface;
