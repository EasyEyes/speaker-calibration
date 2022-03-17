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
  constructor(elementID, bufferArray) {
    super(elementID);
    const signalCopy = [...bufferArray.slice(0, bufferArray.length / 500)];
    const labels = [...signalCopy.keys()];
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
  constructor(elementID, bufferArray) {
    super(elementID);
    const signalCopy = [...bufferArray.slice(0, bufferArray.length / 500)];
    const labels = [...signalCopy.keys()];
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
  constructor(elementID, bufferArray, sf) {
    super(elementID);
    const signalCopy = [...bufferArray.slice(0, bufferArray.length / 25)];
    const labels = [...signalCopy.keys()];
    this.setChartData(signalCopy, labels, 'IR', 'Impulse Response');
    this.chart = new Chart(this.ctx, this.chartDetails);
  }
}

export {GeneratedSignalChart, RecordedSignalChart, IRChart};
