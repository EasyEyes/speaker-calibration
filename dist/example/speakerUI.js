window.onload = () => {
  const flexSwitchCheckIR = document.getElementById('flexSwitchCheckIR');
  const flexSwitchCheckVolume = document.getElementById('flexSwitchCheckVolume');
  const csvUpload = document.getElementById('csv-file');
  const sendToServerButton = document.getElementById('sendToServerButton');

  const {Speaker, VolumeCalibration, ImpulseResponseCalibration} = speakerCalibrator;

  const normalize = (min, max) => {
    var delta = max - min;
    return val => {
      return (val - min) / delta;
    };
  };

  const useIRResult = async invertedIR => {
    //invertedIRNorm = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,]
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    // invertedIRNorm = invertedIR
    invertedIRNorm = invertedIR.slice(0, invertedIR.length / audioCtx.sampleRate); // invertedIR.map(normalize(-1, 1))
    console.log({invertedIRNorm});
    const audioFile = fetch('./Queen-Bohemian_Rhapsody.wav')
      .then(response => response.arrayBuffer())
      .then(buffer => audioCtx.decodeAudioData(buffer))
      .then(async buffer => {
        buffer.channelCount = 1;
        buffer.numberOfChannels = 1;
        const track = audioCtx.createBufferSource(1, buffer.length, audioCtx.sampleRate);
        track.buffer = buffer;
        track.channelCount = 1;

        console.log({buffer});
        const myArrayBuffer = audioCtx.createBuffer(1, invertedIRNorm.length, audioCtx.sampleRate);
        console.log(invertedIRNorm.length / audioCtx.sampleRate);
        console.log({myArrayBuffer});

        // Fill the buffer with white noise;
        // just random values between -1.0 and 1.0
        // This gives us the actual ArrayBuffer that contains the data
        const nowBuffering = myArrayBuffer.getChannelData(0);
        for (let i = 0; i < myArrayBuffer.length; i++) {
          // Math.random() is in [0; 1.0]
          // audio needs to be in [-1.0; 1.0]
          nowBuffering[i] = invertedIRNorm[i];
        }
        //convolver.normalize = false
        //convolver.buffer = myArrayBuffer;
        const convolver = audioCtx.createConvolver();
        convolver.normalize = false;
        convolver.channelCount = 1;
        convolver.buffer = myArrayBuffer;

        console.log({convolver});
        console.log({track});
        //convolver.connect(track)
        track.connect(convolver);
        convolver.connect(audioCtx.destination);
        //track.connect(audioCtx.destination)
        console.log('Starting Audio');
        track.start();
      });
  };

  const handleFileUpload = e => {
    const calibratorParams = {
      numCaptures: 0,
      numMLSPerCapture: 0,
      download: false,
    };

    const f = e.target.files[0];
    if (f) {
      e.preventDefault();
      const reader = new FileReader();

      reader.onload = async e => {
        console.log('Hello World');
        const text = e.target.result;
        const testIRCalibration = new ImpulseResponseCalibration(calibratorParams);

        const handleImpulseResponsEvent = data => {
          if (data.res) {
            testIRCalibration.sendImpulseResponsesToServerForProcessing();
          }
        };

        const handleInvertedImpulseResponseEvent = async data => {
          if (data.res) {
            await useIRResult(testIRCalibration.invertedImpulseResponse);
          }
        };

        testIRCalibration.on('ImpulseResponse', handleImpulseResponsEvent);
        testIRCalibration.on('InvertedImpulseResponse', handleInvertedImpulseResponseEvent);

        testIRCalibration.sourceSamplingRate = 96000;
        testIRCalibration.sendRecordingToServerForProcessing(text);
      };

      reader.readAsText(f);
    }
  };

  csvUpload.addEventListener('change', handleFileUpload);

  flexSwitchCheckIR.onchange = () => {
    flexSwitchCheckVolume.checked = !flexSwitchCheckIR.checked;
  };

  flexSwitchCheckVolume.onchange = () => {
    flexSwitchCheckIR.checked = !flexSwitchCheckVolume.checked;
  };

  const buildIRTable = numCaptures => {
    const tableBody = document.getElementById('IRtableBody');
    const getTableRow = index =>
      `<tr id=${'irtr_' + index}>
        <th scope="row">${index}</th>
        <td><span class="circle-todo"></span></td>
        <td>${'Queued'}</td>
      </tr>`;
    const range = document.createRange();
    range.selectNodeContents(tableBody);
    const allRows = [];
    for (let i = 0; i < numCaptures; i++) {
      const node = range.createContextualFragment(getTableRow(i));
      tableBody.append(node);
    }
  };

  const buildIIRTable = () => {
    const tableBody = document.getElementById('IIRtableBody');
    const getTableRow = index =>
      `<tr id=${'iirtr_' + index}>
      <th scope="row">${index}</th>
      <td><span class="circle-todo"></span></td>
      <td>${'Queued'}</td>
    </tr>`;
    const range = document.createRange();
    range.selectNodeContents(tableBody);
    const node = range.createContextualFragment(getTableRow(0));
    tableBody.append(node);
  };

  document.getElementById('calibrationBeginButton').onclick = async () => {
    let invertedIR;
    const spinner = document.getElementById('spinner');
    const calibrationResult = document.getElementById('calibrationResult');
    const updateTarget = document.getElementById('updates');

    const speakerParameters = {
      siteUrl: window.location.href.substring(0, location.href.lastIndexOf('/')),
      targetElementId: 'display',
    };

    const calibratorParams = {
      numCaptures: document.getElementById('numCapturesInput').value,
      numMLSPerCapture: document.getElementById('numMLSPerCaptureInput').value,
      mlsOrder: document.getElementById('mlsOrder').value,
      download: document.getElementById('flexSwitchCheckDownload').checked,
    };

    const calibrator = new ImpulseResponseCalibration(calibratorParams);

    calibrator.on('update', ({message, ...rest}) => {
      updateTarget.innerHTML = message;
    });

    const runVolumeCalibration = async () => {
      try {
        const dbSPL = await Speaker.startCalibration(
          speakerParameters,
          VolumeCalibration,
          calibratorParams
        );
        calibrationResult.innerText = `Sound Gain ${dbSPL.toFixed(3)} dB SPL`;
        calibrationResult.classList.remove('d-none');
      } catch (err) {
        calibrationResult.innerText = `${err.name}: ${err.message}`;
      }
    };

    const runImpulseResponseCalibration = async () => {
      try {
        invertedIR = await Speaker.startCalibration(speakerParameters, calibrator);
        console.log({invertedIR});
        await useIRResult(invertedIR);
      } catch (err) {
        calibrationResult.innerText = `${err.name}: ${err.message}`;
      }
    };

    if (flexSwitchCheckIR.checked) {
      runImpulseResponseCalibration();
    } else {
      runVolumeCalibration();
    }
  };
};
