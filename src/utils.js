const targetElementId = 'viz';

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

/**
 * Uiltity function to create and save a CSV file from a buffer
 * @param {*} data
 * @param {*} filename
 */
const saveToCSV = (data, filename = 'recordedMLSignal.csv') => {
  // console.log(data)
  let csvContent = 'data:text/csv;charset=utf-8,';

  data.forEach((val, idx) => {
    csvContent += `${idx},${val}\r\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
};

/**
 * Resamples the given buffer to the given sampling rate
 * @param {*} audioBuffer 
 * @param {*} targetSampleRate 
 * @param {*} onComplete 
 */
function reSample(audioBuffer, targetSampleRate, onComplete) {
  const channel = audioBuffer.numberOfChannels;
  const samples = audioBuffer.length * targetSampleRate / audioBuffer.sampleRate;

  const offlineContext = new OfflineAudioContext(channel, samples, targetSampleRate);
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;

  bufferSource.connect(offlineContext.destination);
  bufferSource.start(0);
  offlineContext.startRendering().then((renderedBuffer)=> {
      onComplete(renderedBuffer);
  })
}

export {sleep, visualize, saveToCSV, reSample};
