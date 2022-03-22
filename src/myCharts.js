/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-extraneous-dependencies */
import {
  Chart,
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  BarController,
  BubbleController,
  DoughnutController,
  LineController,
  PieController,
  PolarAreaController,
  RadarController,
  ScatterController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Decimation,
  Filler,
  Legend,
  Title,
  Tooltip,
  SubTitle,
} from 'chart.js';

Chart.register(
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  BarController,
  BubbleController,
  DoughnutController,
  LineController,
  PieController,
  PolarAreaController,
  RadarController,
  ScatterController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Decimation,
  Filler,
  Legend,
  Title,
  Tooltip,
  SubTitle
);

/**
 * Charting Class
 */
class MyCharts {
  /** @private */
  static subSample = 1000;

  /**
   * Constructor
   */
  constructor(elementID) {
    this.ctx = document.getElementById(elementID);
    this.chartDetails = {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            label: '',
            borderColor: '#3e95cd',
            fill: false,
            pointStyle: false,
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: '',
        },
      },
    };
  }

  setChartData = (data, labels, label, text) => {
    this.chartDetails.data.labels = labels;
    this.chartDetails.data.datasets[0].data = data;
    this.chartDetails.data.datasets[0].label = label;
    this.chartDetails.options.title.text = text;
  };

  linspace = (start, stop, num, endpoint = true) => {
    const div = endpoint ? num - 1 : num;
    const step = (stop - start) / div;
    return Array.from({length: num}, (_, i) => (start + step * i).toFixed(2));
  };

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
    super(elementID);
    const [signalCopy, labels] = this.getSubSampledData(bufferArray, samplingRate);
    this.setChartData(signalCopy, labels, 'MLS', 'Generated MLS');
    this.chart = new Chart(this.ctx, this.chartDetails);
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
    super(elementID);
    const [signalCopy, labels] = this.getSubSampledData(bufferArray, samplingRate);
    this.setChartData(signalCopy, labels, 'MLS', 'Recorded MLS');
    this.chart = new Chart(this.ctx, this.chartDetails);
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
    super(elementID);
    const [signalCopy, labels] = this.getSubSampledData(bufferArray, samplingRate);
    this.setChartData(signalCopy, labels, 'IR', 'Impulse Response');
    this.chart = new Chart(this.ctx, this.chartDetails);
  }
}

export {GeneratedSignalChart, RecordedSignalChart, IRChart};
