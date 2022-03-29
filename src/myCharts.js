/* eslint-disable require-jsdoc */
/* eslint-disable max-classes-per-file */
import * as d3 from 'd3';

const linspace = (start, stop, num, endpoint = true) => {
  const div = endpoint ? num - 1 : num;
  const step = (stop - start) / div;
  return Array.from({length: num}, (_, i) => {
    const val = start + step * i;
    return val;
  });
};

const formatSamplingData = (bufferArray, samplingRate) => {
  const bufferLength = bufferArray.length;
  const MaxTimestamp = bufferLength / samplingRate;
  const timeSteps = linspace(0, MaxTimestamp, bufferLength);
  return timeSteps.map((value, idx) => ({
    date: new Date(+value * 1000),
    value: bufferArray[idx],
  }));
};

/**
 * Charting Class
 */
class MyCharts {
  /**
   * Constructor
   */
  constructor(elementID, data) {
    const margin = {
      top: 10,
      right: 30,
      bottom: 30,
      left: 60,
    };

    const element = d3.select(`#d3-select`).node();

    const width = element.getBoundingClientRect().width - margin.left - margin.right;

    const height = 500 - margin.top - margin.bottom;

    const x = d3.scaleTime().range([0, width]);

    const y = d3.scaleLinear().range([height, 0]);

    const xAxis = d3.axisBottom(x);

    const yAxis = d3.axisLeft(y);

    const line = d3
      .line()
      .x(d => x(d.date))
      .y(d => y(d.value));

    // append the svg object to the body of the page
    const svg = d3
      .select(`#${elementID}`)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    x.domain(d3.extent(data, d => d.date));
    y.domain(d3.extent(data, d => d.value));

    svg.append('g').attr('class', 'x axis').attr('transform', `translate(0,${height})`).call(xAxis);

    svg
      .append('g')
      .attr('class', 'y axis')
      .call(yAxis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Price ($)');

    svg.append('path').datum(data).attr('class', 'line').attr('d', line);

    this.svg = svg;
    this.data = data;
  }

  /**
   * Retrieve a fixed number of elements from an array, evenly distributed but
   * always including the first and last elements.
   *
   * @param   {Array} items - The array to operate on.
   * @param   {number} n - The number of elements to extract.
   * @returns {Array}
   */
  distributedCopy = (items, n) => {
    const elements = [items[0]];
    const totalItems = items.length - 2;
    const interval = Math.floor(totalItems / (n - 2));
    for (let i = 1; i < n - 1; i += 1) {
      elements.push(items[i * interval]);
    }
    elements.push(items[items.length - 1]);
    return elements;
  };

  getSubSampledData = (bufferArray, samplingRate) => {
    const signalCopy = this.distributedCopy(bufferArray, MyCharts.subSample);
    const MaxTimestamp = bufferArray.length / samplingRate;
    const labels = this.linspace(0, MaxTimestamp, signalCopy.length);
    return [signalCopy, labels];
  };
}

/**
 *
 */
class GeneratedSignalChart extends MyCharts {
  /**
   * Contructor
   * @param {*} elementID
   * @param {*} bufferArray
   */
  constructor(elementID, bufferArray, samplingRate) {
    const data = formatSamplingData(bufferArray, samplingRate);
    super(elementID, data);
  }
}

/**
 *
 */
class RecordedSignalChart extends MyCharts {
  /**
   * Contructor
   * @param {*} elementID
   * @param {*} bufferArray
   */
  constructor(elementID, bufferArray, samplingRate) {
    const data = formatSamplingData(bufferArray, samplingRate);
    super(elementID, data);
  }
}

/**
 * Impulse Response Charting Class
 */
class IRChart extends MyCharts {
  /**
   * Contructor
   * @param {*} elementID
   * @param {*} bufferArray
   */
  constructor(elementID, bufferArray, samplingRate) {
    const data = formatSamplingData(bufferArray, samplingRate);
    super(elementID, data);
  }
}

export {GeneratedSignalChart, RecordedSignalChart, IRChart};
