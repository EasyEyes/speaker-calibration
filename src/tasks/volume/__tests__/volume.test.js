import Volume from '../volume.js';

describe('the Volume class', () => {
  let vm;
  beforeEach(() => {
    vm = new Volume();
  });

  it('should return a Promise', () => {
    const calibrationResp = vm.startCalibration();
    expect(calibrationResp).toBeInstanceOf(Promise);
  });
});
