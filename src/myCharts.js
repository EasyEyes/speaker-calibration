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
  constructor(elementID, label, text, bufferArray) {
    const signalCopy = [...bufferArray.slice(0, bufferArray.length / 500)];
    const labels = [...signalCopy.keys()];
    this.ctx = document.getElementById(elementID);
    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: signalCopy,
            label,
            borderColor: '#3e95cd',
            fill: false,
          },
        ],
      },
      options: {
        title: {
          display: true,
          text,
        },
      },
    });
  }
}

export default MyCharts;
