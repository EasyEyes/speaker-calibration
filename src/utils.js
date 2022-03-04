const targetElementId = 'display';

/**
 * Utility function to visualize audio data
 * @param {*} targetAnalyser
 */
const visualize = targetAnalyser => {
  const analyser = targetAnalyser;
  const canvas = document.createElement('canvas');
  const canvasCtx = canvas.getContext('2d');
  document.getElementById(targetElementId).appendChild(canvas);

  analyser.fftSize = 2048;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // eslint-disable-next-line require-jsdoc
  const draw = () => {
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    const sliceWidth = (WIDTH * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i += 1) {
      const v = dataArray[i] / 128.0;
      const y = (v * HEIGHT) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  };

  draw();
};

/**
 * Utlity function to pause execution for a given time
 * @param {number} seconds
 * @returns {Promise}
 */
const sleep = seconds =>
  new Promise(resolve => {
    setTimeout(resolve, seconds * 1000);
  });

export {sleep, visualize};
