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
  const blob = new Blob([jsonData], { type: 'application/json' });
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

const findMinValue = (array) => {
  let minValue = array[0];
  for (let i = 1; i < array.length; i++) {
      if (array[i] < minValue) {
          minValue = array[i];
      }
  }
  return minValue;
};

const findMaxValue = (array) => {
  let maxValue = array[0];
  for (let i = 1; i < array.length; i++) {
      if (array[i] > maxValue) {
          maxValue = array[i];
      }
  }
  return maxValue;
};

export {sleep, saveToCSV, saveToJSON, csvToArray,findMinValue,findMaxValue};
