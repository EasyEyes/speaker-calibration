import Swal from 'sweetalert2';
//import {phrases} from '../dist/example/i18n.js';
/** .
 * .
 * .
 * Utlity function to pause execution for a given time
 *
 * @param {number} seconds
 * @returns {Promise}
 * @example
 */
const sleep = seconds =>
  new Promise(resolve => {
    setTimeout(resolve, seconds * 1000);
  });

/** .
 * .
 * .
 * Uiltity function to create and save a CSV file from a buffer
 *
 * @param {*} data
 * @param {*} filename
 * @example
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

const saveToJSON = (data, filename = 'recordedMLSignal.json') => {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
};

/** .
 * .
 * .
 * Utility function to create a buffer from a CSV file
 *
 * @param {*} csvString
 * @param {*} delimiter
 * @returns
 * @example
 */
const csvToArray = (csvString, delimiter = ',') =>
  csvString
    .trim()
    .split('\n')
    .map(row => parseFloat(row.trim().split(delimiter)[1]));

const findMinValue = array => {
  let minValue = array[0];
  for (let i = 1; i < array.length; i++) {
    if (array[i] < minValue) {
      minValue = array[i];
    }
  }
  return minValue;
};

const findMaxValue = array => {
  let maxValue = array[0];
  for (let i = 1; i < array.length; i++) {
    if (array[i] > maxValue) {
      maxValue = array[i];
    }
  }
  return maxValue;
};

export const getCurrentTimeString = () => {
  const date = new Date();

  // Get the date string in the user's locale
  const dateOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZoneName: 'longOffset',
    hour: 'numeric',
    minute: 'numeric',
  };
  const dateString = date.toLocaleDateString(undefined, dateOptions);

  return dateString.replace('at ', '');
};

const standardDeviation = values => {
  const avg = average(values);

  const squareDiffs = values.map(value => {
    const diff = value - avg;
    const sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = Math.sqrt(avgSquareDiff);
  // only 1 digit after the decimal place
  const std = Math.round(stdDev * 10) / 10;
  return std.toFixed(1);
};

const average = data => {
  const sum = data.reduce((sum, value) => {
    return sum + value;
  }, 0);

  const avg = sum / data.length;
  return avg;
};

function interpolate(x, x0, x1, y0, y1) {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

export const formatLineBreak = (inputStr, checkInternetConnection) => {
  let finalStr = inputStr
    .replace(/\n/g, '<br>')
    .replace('𝕃𝕃𝕃', `<a href="#" id="check-connection">${checkInternetConnection}</a>`);

  console.log(finalStr);

  return finalStr;
};

export const createAndShowPopup = (lang, phrases) => {
  console.log(`
    <div style="text-align: left;"> 
    ${convertAsterisksToList(phrases.RC_NeedInternetConnectedPhone[lang].replace(/\n/g, '<br>'))}
    </div>
      <div class="col-3" style="margin-top:10px;">
        <button id="okaybtn" class="btn btn-lg btn-dark">
          ${phrases.EE_ok[lang]}
        </button>
      </div>`);
  Swal.fire({
    html: `
    <div style="text-align: left;"> 
    ${convertAsterisksToList(phrases.RC_NeedInternetConnectedPhone[lang].replace(/\n/g, '<br>'))}
    </div>
      <div class="col-3" style="margin-top:10px;">
        <button id="okaybtn" class="btn btn-lg btn-dark">
          ${phrases.EE_ok[lang]}
        </button>
      </div>`,
    showConfirmButton: false,
    position: 'bottom',
    width: '40%',
    customClass: {
      container: 'no-background',
    },
    showClass: {
      popup: 'fade-in',
    },
    hideClass: {
      popup: '',
    },
    didOpen: () => {
      const okayBtn = document.getElementById('okaybtn');
      okayBtn.style.display = 'flex';
      okayBtn.addEventListener('click', () => {
        Swal.close(); // Close the Swal popup
      });
    },
  });
};

export function convertAsterisksToList(content) {
  // Replace * with <li> and convert line breaks to </li><li>
  console.log(content);
  let result = content
    .replace(/\* (.*?)(<br>|$)/g, '<li>$1</li>')
    .replace(/(<li>)(<\/li>)\s*$/, '') // Remove trailing </li>
    .replace('<li>', '<ul style="padding-left:40px"> <br> <li>');
  result = result.replace('</li>5', '</li></ul>5');
  return result;
}

export const reorderMLS = (mlsSignal, preSec, sourceSamplingRate) => {
  // Number of samples to move
  const numSamplesToMove = Math.round(preSec * sourceSamplingRate);
  if (numSamplesToMove <= 0 || numSamplesToMove >= mlsSignal.length) {
    // Nothing to reorder, return original
    return mlsSignal;
  }
  const lastPart = mlsSignal.slice(-numSamplesToMove);
  const firstPart = mlsSignal.slice(0, mlsSignal.length - numSamplesToMove);
  return lastPart.concat(firstPart);
};

export {
  sleep,
  saveToCSV,
  saveToJSON,
  csvToArray,
  findMinValue,
  findMaxValue,
  standardDeviation,
  interpolate,
};
