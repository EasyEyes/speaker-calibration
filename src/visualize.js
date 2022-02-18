const targetElementId = "display";

export function visualize(analyser) {
    // if (!sourceAudioCtx) {
    //   sourceAudioCtx = new AudioContext();
    // }

    // if (!canvas) {
    //   canvas = document.createElement("canvas");
    //   canvasCtx = canvas.getContext("2d");
    //   document.getElementById(targetElement).appendChild(canvas);
    // }

    // const source = sourceAudioCtx.createMediaStreamSource(stream);
    // const analyser = sourceAudioCtx.createAnalyser();

    const canvas = document.createElement("canvas");
    const canvasCtx = canvas.getContext("2d");
    document.getElementById(targetElementId).appendChild(canvas);


    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    //source.connect(analyser);
    //analyser.connect(audioCtx.destination);

    const draw = () => {
      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = "rgb(200, 200, 200)";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "rgb(0, 0, 0)";

      canvasCtx.beginPath();

      let sliceWidth = (WIDTH * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        let v = dataArray[i] / 128.0;
        let y = (v * HEIGHT) / 2;

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
  }