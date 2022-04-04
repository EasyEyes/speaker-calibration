import {io} from 'socket.io-client';

/**
 *
 */
class PythonServerInterface {
  static PYTHON_SERVER_URL = 'https://easyeyes-python-server.herokuapp.com';

  static SUPPORTED_TASKS = {
    'impulse-response': {

    }
    'volume-calibration: {
      
    }
  };
  /**
   *
   * @param {string} url
   */
  constructor(url = PythonServerInterface.PYTHON_SERVER_URL) {
    this.socket = io(url);
    this.socket.on('data', this.handleIncomingData);
  }

  handleIncomingData = data => {
    if (data.id === this.socket.id) console.log(data);
  };

  sendData = data => {
    this.socket.emit('data', data);
  };
}

export default PythonServerInterface;
