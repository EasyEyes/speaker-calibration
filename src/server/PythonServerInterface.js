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
    this.socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 99999,
    });
  }

  getImpulseResponse = async data => {
    this.asyncEmit('data', {
      task: 'impulse-response',
      data,
    });
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
      setTimeout(reject, 20000);
    });
}

export default PythonServerInterface;
