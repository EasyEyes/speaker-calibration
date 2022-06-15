const path = require('path');
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');

const config = {
  entry: {
    main: './src/main.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: {
      name: 'speakerCalibrator',
      type: 'umd',
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [],
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
      fs: false,
    },
  },
};

if (process.env.WEBPACK_ANALYZE === 'true') {
  config.plugins.push(new BundleAnalyzerPlugin());
}

module.exports = config;
