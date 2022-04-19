import PythonServerInterface from '../PythonServerInterface';
import {io} from 'socket.io-client';

const mockData = {
  data: 'soundGainDBSL:124253.23535464,P:312.342,L:12343.45,vectorDb:1353.354',
};

jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(url => {
      return {
        on: jest.fn(),
        emit: jest.fn((eventName, data) => {
          return Promise.resolve({data: mockData});
        }),
      };
    }),
  };
});

describe('the PythonServerInterface class', () => {
  it('should construct properly', () => {
    const pythonServerInterface = new PythonServerInterface();
    expect(io).toBeCalledWith(pythonServerInterface.PYTHON_SERVER_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 99999,
    });
  });

  describe('the getImpulseResponse function', () => {
    it('should return a Promise', () => {
      expect(pythonServerInterface.getImpulseResponse()).toBeInstanceOf(Promise);
    });
  });

  describe('the getVolumeCalibration function', () => {
    it('should make a call to the socket server and handle results', () => {
      expect(pythonServerInterface.getVolumeCalibration('test-url')).toBeInstanceOf(Promise);
      expect(io.emit).toBeCalledTimes(1);
      expect(io.emit).toBeCalledWith('test-url');
    });
  });
});
