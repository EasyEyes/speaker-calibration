import Volume from '../volume.js';

describe('the Volume class', () => {
  const volume = new Volume();

  describe('the startCalibration function', () => {
    it('should return a Promise', () => {
      expect(volume.startCalibration()).toBeInstanceOf(Promise);
    });
  });
});
