window.onload = () => {
  const flexSwitchCheckIR = document.getElementById('flexSwitchCheckIR');
  const flexSwitchCheckVolume = document.getElementById('flexSwitchCheckVolume');
  const flexSwitchCheckCombo = document.getElementById('flexSwitchCheckCombo');
  const previousCaptureCSV = document.getElementById('previous-capture-csv');
  const iirCSV = document.getElementById('iir-csv');
  const playAndRecord = document.getElementById('flexSwitchPlayAndRecord');
  const sendToServerButton = document.getElementById('sendToServerButton');
  const wavFile = document.getElementById('wav-file');

  const {Speaker, VolumeCalibration, ImpulseResponseCalibration, CombinationCalibration} =
    speakerCalibrator;

  const normalize = (min, max) => {
    var delta = max - min;
    return val => {
      return (val - min) / delta;
    };
  };

  const useIRResult = async invertedIR => {
    // invertedIRNorm = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    const invertedIRNorm = invertedIR;
    const audioFileName = 'Queen-Bohemian_Rhapsody.wav';
    const audioFileURL = window.location.hostname.includes('localhost')
      ? '../example/' + audioFileName
      : './' + audioFileName;
    const audioFile = fetch(audioFileURL)
      .then(response => response.arrayBuffer())
      .then(buffer => audioCtx.decodeAudioData(buffer))
      .then(async buffer => {
        buffer.channelCount = 1;
        buffer.numberOfChannels = 1;

        const track = audioCtx.createBufferSource(1, buffer.length, audioCtx.sampleRate);
        track.buffer = buffer;
        track.channelCount = 1;

        const convolverBuffer = audioCtx.createBuffer(
          1,
          invertedIR.length - 1,
          audioCtx.sampleRate
        );

        // Fill the buffer with white noise;
        // just random values between -1.0 and 1.0
        // This gives us the actual ArrayBuffer that contains the data
        const nowBuffering = convolverBuffer.getChannelData(0);
        for (let i = 0; i < convolverBuffer.length; i++) {
          // Math.random() is in [0; 1.0]
          // audio needs to be in [-1.0; 1.0]
          nowBuffering[i] = invertedIRNorm[i];
        }

        const convolver = audioCtx.createConvolver();
        convolver.normalize = false;
        convolver.channelCount = 1;
        convolver.buffer = convolverBuffer;

        console.log({convolver});
        console.log({track});

        track.connect(convolver);
        convolver.connect(audioCtx.destination);
        track.start(0);
      });
  };

  const handlePreviousCaptureUpload = e => {
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

  const handleIIRUplaod = e => {
    const f = e.target.files[0];
    if (f) {
      e.preventDefault();
      const reader = new FileReader();

      reader.onload = async e => {
        const g_string = e.target.result;
        const g = g_string.split('\n').map(val => parseFloat(val));
        console.log({g});

        if (playAndRecord.checked) {
          // call SC
          useSpeakerCalibrator(1, g);
        } else {
          useIRResult(g);
        }
      };

      reader.readAsText(f);
    }
  };

  const handleWavFileUpload = e => {
    var sound = document.getElementById('sound');
    sound.src = URL.createObjectURL(e.target.files[0]);
    // not really needed in this exact case, but since it is really important in other cases,
    // don't forget to revoke the blobURI when you don't need it
    sound.onend = e => {
      URL.revokeObjectURL(e.tartget.src);
    };
  };

  previousCaptureCSV.addEventListener('change', handlePreviousCaptureUpload);

  iirCSV.addEventListener('change', handleIIRUplaod);

  wavFile.addEventListener('change', handleWavFileUpload);

  flexSwitchCheckIR.onchange = () => {
    flexSwitchCheckVolume.checked = !flexSwitchCheckIR.checked;
    flexSwitchCheckCombo.checked = !flexSwitchCheckIR.checked;
  };

  flexSwitchCheckVolume.onchange = () => {
    flexSwitchCheckIR.checked = !flexSwitchCheckVolume.checked;
    flexSwitchCheckCombo.checked = !flexSwitchCheckVolume.checked;
  };

  flexSwitchCheckCombo.onchange = () => {
    flexSwitchCheckIR.checked = !flexSwitchCheckCombo.checked;
    flexSwitchCheckVolume.checked = !flexSwitchCheckCombo.checked;
  };

  const useSpeakerCalibrator = async (calibrationLevel = 0, iir = null) => {
    let invertedIR;
    const spinner = document.getElementById('spinner');
    const calibrationResult = document.getElementById('calibrationResult');
    const updateTarget = document.getElementById('updates');

    const speakerParameters = {
      siteUrl: window.location.href.substring(0, location.href.lastIndexOf('/')),
      targetElementId: 'display',
      soundMessageId: 'speak123',
      calibrateSoundSamplingDesiredBits: document.getElementById(
        'calibrateSoundSamplingDesiredBitsBox'
      ).value,
      // gainValues: [0.1, 0.5, 0.9], // example gain values
      // gainValues: [
      //   0.6998419960022735, 0.44668359215096315, 0.31622776601683794, 0.17782794100389226, 0.1,
      //   0.03162277660168379, 0.01, 0.000009999999999999999,
      // ], //example gain values
      gainValues: [
        0.001, 0.0031622776601683794, 0.01, 0.03162277660168379, 0.1, 0.17782794100389226,
        0.31622776601683794, 0.6998419960022735,
      ],
      debug: true,
      ICalib: 31,
    };

    const runImpulseResponseCalibration = async calibrationLevel => {
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

      try {
        if (calibrationLevel == 0) {
          invertedIR = await Speaker.startCalibration(speakerParameters, calibrator);
          console.log({invertedIR});
          await useIRResult(invertedIR);
        } else {
          await Speaker.testIIR(speakerParameters, calibrator, iir);
        }
      } catch (err) {
        calibrationResult.innerText = `${err.name}: ${err.message}`;
      }
    };

    const runCombinationCalibration = async calibrationLevel => {
      const calibratorParams = {
        numCaptures: document.getElementById('numCapturesInput').value,
        numMLSPerCapture: document.getElementById('numMLSPerCaptureInput').value,
        mlsOrder: document.getElementById('mlsOrder').value,
        download: document.getElementById('flexSwitchCheckDownload').checked,
        calibrateSoundHz: document.getElementById('calibrateSoundHzBox').value,
        calibrateSoundSamplingDesiredBits: document.getElementById(
          'calibrateSoundSamplingDesiredBitsBox'
        ).value,
      };

      const calibrator = new CombinationCalibration(calibratorParams);

      calibrator.on('update', ({message, ...rest}) => {
        updateTarget.innerHTML = message;
      });

      try {
        if (calibrationLevel == 0) {
          invertedIR = await Speaker.startCalibration(speakerParameters, calibrator);
          console.log({invertedIR});
          await useIRResult(invertedIR);
        } else {
          await Speaker.testIIR(speakerParameters, calibrator, iir);
        }
      } catch (err) {
        calibrationResult.innerText = `${err.name}: ${err.message}`;
      }
    };

    const runVolumeCalibration = async () => {
      const calibrator = new VolumeCalibration({});
      calibrator.on('update', ({message, ...rest}) => {
        updateTarget.innerHTML = message;
      });

      try {
        soundGainDBSPL = await Speaker.startCalibration(speakerParameters, calibrator);
        updateTarget.innerText = `${soundGainDBSPL} DBSPL`;
      } catch (err) {
        updateTarget.innerText = `${err.name}: ${err.message}`;
      }
    };

    if (flexSwitchCheckIR.checked) {
      runImpulseResponseCalibration(calibrationLevel);
    } else if (flexSwitchCheckVolume.checked) {
      runVolumeCalibration();
    } else {
      runCombinationCalibration(calibrationLevel);
    }
  };

  document.getElementById('calibrationBeginButton').onclick = () => useSpeakerCalibrator();
};
