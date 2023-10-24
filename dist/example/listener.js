// get element with id message
import {phrases} from './i18n.js';
// get url query parameters
const urlParams = new URLSearchParams(window.location.search);

// get isSmartPhone query parameter
const isSmartPhone = urlParams.get('isSmartPhone');

const listenerParameters = {
  targetElementId: 'display',
  deviceInfoFromUser: {},
};

let preferredModelNumber = '';
let findModel = '';
const getDeviceDetails = deviceInfo => {
  let OS = '';
  switch (deviceInfo.PlatformName) {
    case 'iOS':
      OS = 'IOS';
      break;
    case 'mac':
      OS = 'macOS';
      break;
    case 'win':
      OS = 'Windows';
      break;
    case 'Android':
      OS = 'Android';
      break;
    case 'cros':
      OS = 'ChromeOS';
      break;
    case 'Linux':
      OS = 'Linux';
      break;
    case 'openbsd':
      OS = 'Open/FreeBSD';
      break;
    case 'Fuchsia':
      OS = 'Fuchsia';
      break;
    default:
      OS = 'GenericOS';
      break;
  }
  if (OS.includes('Android')) {
    preferredModelNumber = phrases.RC_modelNumberAndroid['en-US'];
    findModel = phrases.RC_findModelAndroid['en-US'];
  } else if (OS.includes('Bada')) {
    preferredModelNumber = phrases.RC_modelNumberBada['en-US'];
    findModel = phrases.RC_findModelBada['en-US'];
  } else if (OS.includes('Blackberry')) {
    preferredModelNumber = phrases.RC_modelNumberBlackberry['en-US'];
    findModel = phrases.RC_findModelBlackberry['en-US'];
  } else if (OS.includes('Firefox')) {
    preferredModelNumber = phrases.RC_modelNumberFirefox['en-US'];
    findModel = phrases.RC_findModelFirefox['en-US'];
  } else if (OS.includes('IOS')) {
    preferredModelNumber = phrases.RC_modelNumberIOs['en-US'];
    findModel = phrases.RC_findModelIOs['en-US'];
  } else if (OS.includes('iPad')) {
    preferredModelNumber = phrases.RC_modelNumberIPad['en-US'];
    findModel = phrases.RC_findModelIPad['en-US'];
  } else if (OS.includes('Linux')) {
    preferredModelNumber = phrases.RC_modelNumberLinux['en-US'];
    findModel = phrases.RC_findModelLinux['en-US'];
  } else if (OS.includes('macOS')) {
    preferredModelNumber = phrases.RC_modelNumberMacOs['en-US'];
    findModel = phrases.RC_findModelMacOs['en-US'];
  } else if (OS.includes('Maemo')) {
    preferredModelNumber = phrases.RC_modelNumberMaemo['en-US'];
    findModel = phrases.RC_findModelMaemo['en-US'];
  } else if (OS.includes('Palm')) {
    preferredModelNumber = phrases.RC_modelNumberPalm['en-US'];
    findModel = phrases.RC_findModelPalm['en-US'];
  } else if (OS.includes('WebOS')) {
    preferredModelNumber = phrases.RC_modelNumberWebOS['en-US'];
    findModel = phrases.RC_findModelWebOS['en-US'];
  } else if (OS.includes('Windows')) {
    preferredModelNumber = phrases.RC_modelNumberWindows['en-US'];
    findModel = phrases.RC_findModelWindows['en-US'];
  } else {
    preferredModelNumber = phrases.RC_modelNumber['en-US'];
    findModel = phrases.RC_findModeGeneric['en-US'];
  }
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
const turnMessageElement2 = document.createElement('p');
turnMessageElement2.innerHTML = turnMeToReadBelow;
const askModelNumberElement = document.createElement('div');
// const modelNumberElement = document.getElementById('askModelNumberContent');
const modelNumberButton = document.createElement('button');

// ask for model number
const deviceInfo = {};
try {
  fod.complete(function (data) {
    deviceInfo['IsMobile'] = data.device['ismobile'];
    deviceInfo['HardwareName'] = data.device['hardwarename'];
    deviceInfo['HardwareFamily'] = data.device['hardwarefamily'];
    deviceInfo['HardwareModel'] = data.device['hardwaremodel'];
    deviceInfo['OEM'] = data.device['oem'];
    deviceInfo['HardwareModelVariants'] = data.device['hardwaremodelvariants'];
    deviceInfo['DeviceId'] = data.device['deviceid'];
    deviceInfo['PlatformName'] = data.device['platformname'];
    deviceInfo['PlatformVersion'] = data.device['platformversion'];
    deviceInfo['DeviceType'] = data.device['devicetype'];
  });
  console.log(deviceInfo);
  getDeviceDetails(deviceInfo);
} catch (error) {
  console.error('Error fetching or executing script:', error.message);
}

switch (isSmartPhone) {
  case 'true':
    //  add turnMessageElement2 to body
    // document.body.appendChild(turnMessageElement2);
    // style turnMessageElement2
    // turnMessageElement2.style.position = 'absolute';
    // turnMessageElement2.style.top = '20px';
    // turnMessageElement2.style.fontSize = 'larger';

    // add askModelNumberElement to body
    document.body.appendChild(askModelNumberElement);
    // style askModelNumberElement
    // askModelNumberElement.style.transform = 'rotate(180deg)';
    askModelNumberElement.style.marginTop = '10px';
    askModelNumberElement.style.position = 'absolute';
    askModelNumberElement.style.top = '0';
    askModelNumberElement.style.left = '10px';

    const askModelNumberContent = document.createElement('div');
    askModelNumberContent.style.display = 'flex';
    askModelNumberContent.style.flexDirection = 'column';
    askModelNumberElement.appendChild(askModelNumberContent);
    const p = document.createElement('p');
    p.innerHTML = findModel;
    p.style.marginTop = '10px';
    askModelNumberContent.appendChild(p);

    // create input box for model number and name
    const modelNumberInput = document.createElement('input');
    modelNumberInput.type = 'text';
    modelNumberInput.id = 'modelNumberInput';
    modelNumberInput.name = 'modelNumberInput';
    modelNumberInput.placeholder = preferredModelNumber;

    const modelNameInput = document.createElement('input');
    modelNameInput.type = 'text';
    modelNameInput.id = 'modelNameInput';
    modelNameInput.name = 'modelNameInput';
    modelNameInput.placeholder = 'Model Name';

    askModelNumberContent.appendChild(modelNameInput);
    askModelNumberContent.appendChild(modelNumberInput);

    // add modelNumberButton to askModelNumberContent
    askModelNumberContent.appendChild(modelNumberButton);
    modelNumberButton.innerHTML = 'Proceed';
    modelNumberButton.style.width = '20%';
    // add class
    modelNumberButton.classList.add(...['btn', 'btn-success']);
    modelNumberButton.addEventListener('click', async () => {
      modelNumberButton.innerHTML = 'Loading...';
      await new Promise(async resolve => {
        // get model number and name
        const modelNumber = document.getElementById('modelNumberInput').value;
        const modelName = document.getElementById('modelNameInput').value;
        if (modelNumber === '' || modelName === '') {
          alert('Please enter model number and name');
          modelNumberButton.innerHTML = 'Proceed';
        } else {
          if (await speakerCalibrator.Speaker.doesMicrophoneExist(modelNumber, deviceInfo['OEM'])) {
            // remove the button
            modelNumberButton.remove();
            askModelNumberElement.remove();
            turnMessageElement2.remove();
            allowMicrophoneElement.innerHTML = placeSmartphoneMicrophone;
            turnMessageElement.innerHTML = turnMeToReadBelow;
            // show the html upsidedown
            const phrasesContainer = document.getElementById('phrases');
            // add class
            phrasesContainer.classList.add('phrases');
            const html = document.querySelector('html');
            html.style.overflow = 'hidden';
            const display = document.getElementById('updateDisplay');
            display.classList.add('updateDisplay');
            container.style.display = 'block';
            // event listener for id calibrationBeginButton
            const calibrationBeginButton = document.getElementById('calibrationBeginButton');
            calibrationBeginButton.addEventListener('click', () => {
              // remove the button
              calibrationBeginButton.remove();
              // remove turn message
              turnMessageElement.remove();
              // set the text of the html elements
              recordingInProgressElement.innerHTML = recordingInProgress;
              allowMicrophoneElement.innerHTML = allowMicrophone;

              recordingInProgressElement.style.whiteSpace = 'nowrap';
              recordingInProgressElement.style.fontWeight = 'bold';
              // fit content
              recordingInProgressElement.style.width = 'fit-content';
              let fontSize = 100;
              recordingInProgressElement.style.fontSize = fontSize + 'px';

              while (
                recordingInProgressElement.scrollWidth > window.innerWidth * 0.9 &&
                fontSize > 10
              ) {
                fontSize--;
                recordingInProgressElement.style.fontSize = fontSize + 'px';
              }
              listenerParameters.deviceInfoFromUser = {
                modelNumber,
                modelName,
                OEM: deviceInfo['OEM'],
              };
              window.listener = new speakerCalibrator.Listener(listenerParameters);
              console.log(window.listener);
            });
          } else {
            modelNumberButton.innerHTML = 'Proceed';
            if (p.innerHTML === findModel) {
              p.innerHTML =
                p.innerHTML +
                '<br>' +
                phrases.RC_sorryPhoneMicrophone['en-US']
                  .replace('MMM', deviceInfo['OEM'])
                  .replace('NNN', modelName)
                  .replace('XXX', modelNumber);
            }
          }
        }
      });
      modelNumberButton.innerHTML = 'Proceed';
    });

    break;
  case 'false':
    // remove the button
    const calibrationBeginButton2 = document.getElementById('calibrationBeginButton');
    calibrationBeginButton2.remove();
    container.style.display = 'block';
    // event listener for when the page is loaded
    window.addEventListener('load', () => {
      // set the text of the html elements
      recordingInProgressElement.innerHTML = recordingInProgress;
      allowMicrophoneElement.innerHTML = allowMicrophone;

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
      p.innerHTML = backToExperimentWindow;
      message.appendChild(p);
      window.listener = new speakerCalibrator.Listener(listenerParameters);
      console.log(window.listener);
    });
    break;
}
