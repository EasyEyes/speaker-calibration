class UnsupportedDeviceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedDeviceError';
    this.message = message;
  }
}

class MissingSpeakerIdError extends Error {
  constructor(message) {
    super(message);
    this.name = 'missingSpeakerIdError';
    this.message = message;
  }
}

class CalibrationTimedOutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'calibrationTimedOutError';
    this.message = message;
  }
}

export {UnsupportedDeviceError, MissingSpeakerIdError, CalibrationTimedOutError};
