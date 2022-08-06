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

export {sleep, saveToCSV, csvToArray};
