import PythonServerInterface from '../PythonServerInterface';
import {io} from 'socket.io-client';

const mockVolumeCalibrationResponse = {
  data: 'soundGainDBSL:124253.23535464,P:312.342,L:12343.45,vectorDb:1353.354',
};

const mockImpulseResponseResponse = {
  data: '',
};

jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(url => {
      return {
        on: jest.fn(),
        emit: jest.fn((eventName, data) => {
          if (eventName == 'volume-calibration') {
            return Promise.resolve({data: mockVolumeCalibrationResponse});
          } else if (eventName == 'impulse-response') {
            return Promise.resolve({data: mockImpulseResponseResponse});
          }
        }),
      };
    }),
  };
});

describe('the PythonServerInterface class', () => {
  let pyServer;
  beforeEach(() => {
    pyServer = new PythonServerInterface('test-url');
  });
  it('should get the impulse response calibration result', () => {
    expect(pyServer.getImpulseResponse()).toBeInstanceOf(Promise);
  });

  it('should get the volume calibration result', async () => {
    const mockSocket = pyServer.socket;
    const volumeCalibrationExpectedParams = [
      'data',
      {data: {test: 'data'}, task: 'volume-calibration'},
    ];
    const mockData = {test: 'data'};
    const mockVolumeCalibrationCall = pyServer.getVolumeCalibration(mockData);

    expect(mockVolumeCalibrationCall).toBeInstanceOf(Promise);
    expect(mockSocket.emit).toBeCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledWith(...volumeCalibrationExpectedParams);
    // await mockVolumeCalibrationCall;
    expect(mockVolumeCalibrationCall).resolves.toBe(mockVolumeCalibrationResponse);
  });
});
