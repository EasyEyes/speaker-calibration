// get element with id message
import {phrases} from '../../dist/example/i18n.js';
import Listener from '../peer-connection/listener.js';
// get url query parameters
const urlParams = new URLSearchParams(window.location.search);

// get isSmartPhone query parameter
const isSmartPhone = urlParams.get('sp'); // previous isSmartPhone

const listenerParameters = {
  targetElementId: 'display',
  microphoneFromAPI: '',
  microphoneDeviceId: '',
};

const container = document.getElementById('listenerContainer');
const recordingInProgress = phrases.RC_soundRecording['en-US'];
const backToExperimentWindow = phrases.RC_backToExperimentWindow['en-US'];
const allowMicrophone = phrases.RC_allowMicrophoneUse['en-US'];
const placeSmartphoneMicrophone = phrases.RC_placeSmartphoneMicrophone['en-US'];
const turnMeToReadBelow = phrases.RC_turnMeToReadBelow['en-US'];
const recordingInProgressElement = document.getElementById('recordingInProgress');
const allowMicrophoneElement = document.getElementById('allowMicrophone');
const turnMessageElement = document.getElementById('turnMeToReadBelow');

switch (isSmartPhone) {
  case 'true':
    //hide target element
    const targetElement = document.getElementById('display');
    targetElement.style.display = 'none';
    // Initialize Listener early
    const initializeListener = async () => {
      window.listener = new Listener(listenerParameters);
      await window.listener.initializePeer();
    };

    // Check microphone permission first
    async function checkAndRequestMicrophonePermission() {
      // Show permission request message
      allowMicrophoneElement.innerText = phrases.RC_microphonePermission['en-US'];
      container.style.display = 'block';

      // Function to request microphone access
      async function requestMicAccess(attempt = 1) {
        try {
          await navigator.mediaDevices.getUserMedia({audio: true});
          // Permission granted, proceed to normal flow
          initializeSmartPhoneDisplay();
        } catch (err) {
          if (err.name === 'NotAllowedError') {
            console.log('Permission explicitly denied');
            // Permission explicitly denied
            allowMicrophoneElement.innerText = phrases.RC_microphonePermissionDenied['en-US'];
            // Send denied status and end study
            let error = JSON.stringify(err);
            await window.listener.sendPermissionStatus({type: 'denied', error: error});
            return;
          }

          // If 10 seconds passed, try again
          if (attempt < 3) {
            console.log('Retrying microphone access');
            // Limit retries
            setTimeout(() => requestMicAccess(attempt + 1), 10000);
          } else {
            console.log('All retries failed, treating as denied');
            // After all retries failed, treat as denied
            allowMicrophoneElement.innerText = phrases.RC_microphonePermissionDenied['en-US'];
            let error = JSON.stringify(err);
            await window.listener.sendPermissionStatus({type: 'error', error: error});
          }
        }
      }

      try {
        await requestMicAccess();
      } catch (err) {
        console.error('Error requesting microphone permission:', err);
        allowMicrophoneElement.innerText = phrases.RC_microphonePermissionDenied['en-US'];
        let error = JSON.stringify(err);
        await window.listener.sendPermissionStatus({type: 'error', error: error});
      }
    }

    function initializeSmartPhoneDisplay() {
      allowMicrophoneElement.innerText = placeSmartphoneMicrophone;
      allowMicrophoneElement.style.lineHeight = '1.2rem';
      allowMicrophoneElement.style.fontSize = '14px';
      turnMessageElement.innerText = turnMeToReadBelow;
      turnMessageElement.style.lineHeight = '1.2rem';
      turnMessageElement.style.fontSize = '14px';

      // Show the html upsidedown and adjust layout
      const phrasesContainer = document.getElementById('phrases');
      phrasesContainer.classList.add('phrases');

      // Hide all elements except what's needed for calibration
      const html = document.querySelector('html');
      html.style.overflow = 'hidden';

      // Adjust the display container
      const display = document.getElementById('updateDisplay');
      display.classList.add('updateDisplay');
      display.style.position = 'absolute';
      display.style.top = '50%';
      display.style.left = '50%';
      display.style.transform = 'translate(-50%, -50%) rotate(180deg)';
      display.style.width = '100%';
      display.style.textAlign = 'center';

      container.style.display = 'block';

      // event listener for id calibrationBeginButton
      const calibrationBeginButton = document.getElementById('calibrationBeginButton');
      console.log('Waiting for proceed button click');

      calibrationBeginButton.addEventListener('click', async () => {
        console.log('Proceed button clicked');

        // Clear unnecessary elements
        calibrationBeginButton.remove();
        turnMessageElement.remove();

        // Create a header container for fixed elements
        const headerContainer = document.createElement('div');
        headerContainer.id = 'headerContainer';
        headerContainer.style.position = 'fixed';
        headerContainer.style.bottom = '0';
        headerContainer.style.left = '0';
        headerContainer.style.width = '100%';
        headerContainer.style.background = 'white';
        headerContainer.style.padding = '10px';
        headerContainer.style.zIndex = '1000';
        headerContainer.style.transform = 'rotate(180deg)';
        container.appendChild(headerContainer);

        // Set title based on screen width
        const title = document.createElement('h1');
        const titleText =
          window.innerWidth >= 1366
            ? phrases.RC_soundRecording['en-US']
            : phrases.RC_soundRecordingSmallScreen['en-US'];

        // Split small screen title into lines if needed
        if (window.innerWidth < 1366 && titleText.includes('\n')) {
          const lines = titleText.split('\n');

          // Create container for title lines
          const titleContainer = document.createElement('div');
          titleContainer.style.display = 'flex';
          titleContainer.style.flexDirection = 'column';
          titleContainer.style.alignItems = 'left';
          titleContainer.style.lineHeight = '1.2';

          // Add each line
          lines.forEach(line => {
            const lineDiv = document.createElement('p');
            lineDiv.textContent = line;
            lineDiv.style.width = 'fit-content';
            titleContainer.appendChild(lineDiv);
          });

          title.appendChild(titleContainer);
        } else {
          title.textContent = titleText;
          title.style.lineHeight = '1.2';
        }

        title.style.margin = '0';
        title.style.whiteSpace = 'pre-line'; // Preserve line breaks
        headerContainer.appendChild(title);

        // Function to adjust font size to fill width
        const adjustFontSize = (element, maxWidth) => {
          let fontSize = 20; // Start with a reasonable minimum size
          element.style.fontSize = fontSize + 'px';
          // Increase font size until text fills width (minus margins)
          while (element.scrollWidth < maxWidth - 40 && fontSize < 200) {
            fontSize++;
            element.style.fontSize = fontSize + 'px';
          }

          // Step back one to ensure we don't overflow
          fontSize--;
          element.style.fontSize = fontSize + 'px';
          return fontSize;
        };

        // For small screen, ensure all lines use same font size
        if (window.innerWidth < 1366 && titleText.includes('\n')) {
          const lines = title.querySelectorAll('p');
          let minFontSize = Infinity;

          // First pass: find the smallest font size that fits for any line
          lines.forEach(line => {
            const fontSize = adjustFontSize(line, window.innerWidth);
            minFontSize = Math.min(minFontSize, fontSize);
          });

          // Second pass: apply the smallest font size to all lines
          lines.forEach(line => {
            line.style.fontSize = minFontSize + 'px';
          });
        } else {
          // For single line title, just adjust to fill width
          adjustFontSize(title, window.innerWidth);
        }

        // Get the header height after text is added and sized
        const headerHeight = headerContainer.getBoundingClientRect().height;

        // Adjust the display container to start after header
        const display = document.getElementById('updateDisplay');
        display.classList.add('updateDisplay');
        display.style.position = 'fixed';
        display.style.bottom = `${headerHeight}px`; // Start after header
        display.style.left = '0';
        display.style.right = '0';
        display.style.top = '0';
        display.style.transform = 'rotate(180deg)';
        display.style.overflowY = 'auto';
        display.style.padding = '20px';
        display.style.background = 'white';

        // Position microphone instruction at the top (appears at bottom due to rotation)
        allowMicrophoneElement.innerText = '';
        allowMicrophoneElement.style.position = 'fixed';
        allowMicrophoneElement.style.top = '20px';
        allowMicrophoneElement.style.left = '50%';
        allowMicrophoneElement.style.transform = 'translateX(-50%) rotate(180deg)';
        allowMicrophoneElement.style.width = '90%';
        allowMicrophoneElement.style.textAlign = 'center';
        allowMicrophoneElement.style.zIndex = '1000';

        let lock = null;
        try {
          if ('wakeLock' in navigator) {
            lock = await navigator.wakeLock.request('screen');
          }
        } catch (err) {
          console.log(err);
        }

        const webAudioDeviceNames = {microphone: '', deviceID: ''};
        const externalMicList = ['UMIK', 'Airpods', 'Bluetooth'];
        try {
          const stream = await navigator.mediaDevices.getUserMedia({audio: true});
          if (stream) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const mics = devices.filter(device => device.kind === 'audioinput');
            mics.forEach(mic => {
              if (externalMicList.some(externalMic => mic.label.includes(externalMic))) {
                webAudioDeviceNames.microphone = mic.label;
                webAudioDeviceNames.deviceID = mic.deviceId;
              }
            });
            if (webAudioDeviceNames.microphone === '') {
              webAudioDeviceNames.microphone = mics[0].label;
              webAudioDeviceNames.deviceID = mics[0].deviceId;
            }
          }
        } catch (err) {
          console.log(err);
        }
        window.listener.setMicrophoneFromAPI(webAudioDeviceNames.microphone);
        window.listener.setMicrophoneDeviceId(webAudioDeviceNames.microphone);
        // show target element
        targetElement.style.display = 'block';
        await window.listener.startCalibration({
          microphoneFromAPI: webAudioDeviceNames.microphone,
          microphoneDeviceId: webAudioDeviceNames.microphone,
        });
        if (lock) {
          lock.release();
        }
      });
    }

    // Wrap the initialization in an IIFE
    (async function initializeSmartPhoneMode() {
      await initializeListener();

      const timeout = 30000; // 30 seconds timeout
      const startTime = Date.now();

      // Wait for peer connection setup with timeout
      while (Date.now() - startTime < timeout) {
        if (
          window.listener.peer.id !== null &&
          window.listener.conn !== null &&
          window.listener.connOpen
        ) {
          console.log('Connection established successfully');
          await checkAndRequestMicrophonePermission();
          return;
        }
        console.log('Waiting for connection setup...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If we get here, we've timed out
      console.error('Connection setup timed out after 30 seconds');
      allowMicrophoneElement.innerText = phrases.RC_microphonePermissionDenied['en-US'];
      await window.listener.sendPermissionStatus({
        type: 'error',
        error: 'Connection setup timed out after 30 seconds',
      });
    })().catch(console.error);
    break;
  case 'false':
    // Initialize listener immediately
    listenerParameters.microphoneDeviceId = urlParams.get('deviceId');

    // Wrap initialization in an IIFE
    (async function initializeDesktopMode() {
      window.listener = new Listener(listenerParameters);
      await window.listener.initializePeer();

      const timeout = 30000; // 30 seconds timeout
      const startTime = Date.now();

      // Wait for peer connection setup with timeout
      while (Date.now() - startTime < timeout) {
        if (
          window.listener.peer.id !== null &&
          window.listener.conn !== null &&
          window.listener.connOpen
        ) {
          console.log('Connection established successfully');
          // Continue with desktop setup
          setupDesktopUI();
          return;
        }
        console.log('Waiting for connection setup...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // If we get here, we've timed out
      console.error('Connection setup timed out after 30 seconds');
      // const message = document.getElementById('message');
      // message.innerText = phrases.RC_microphonePermissionDenied['en-US'];
    })().catch(console.error);

    function setupDesktopUI() {
      // remove the button
      const calibrationBeginButton2 = document.getElementById('calibrationBeginButton');
      calibrationBeginButton2.remove();
      container.style.display = 'block';

      //update the display to be
      const display = document.getElementById('display');
      if (display) {
        display.style.textAlign = 'left';
      }
      // set the text of the html elements
      recordingInProgressElement.innerText = recordingInProgress;
      allowMicrophoneElement.innerText = allowMicrophone;

      recordingInProgressElement.style.whiteSpace = 'nowrap';
      recordingInProgressElement.style.fontWeight = 'bold';

      // fit content
      recordingInProgressElement.style.width = 'fit-content';
      let fontSize = 100;
      recordingInProgressElement.style.fontSize = fontSize + 'px';

      while (recordingInProgressElement.scrollWidth > window.innerWidth * 0.9 && fontSize > 10) {
        fontSize--;
        recordingInProgressElement.style.fontSize = fontSize + 'px';
      }
      const message = document.getElementById('message');
      message.style.lineHeight = '2.5rem';
      const p = document.createElement('p');
      p.innerText = backToExperimentWindow;
      message.appendChild(p);

      window.listener.startCalibration();
    }
    break;
}
