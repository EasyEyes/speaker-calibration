const path = require('path');
const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');

const config = {
  entry: {
    main: './src/main.js',
    listener: './src/listener-app/listener.js',
    phonePeer: './src/listener-app/PhonePeer.js',
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
        // If you have .mjs files, use test: /\.m?js$/,
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            // You can also move this config into a separate .babelrc or babel.config.js file
            presets: [
              [
                '@babel/preset-env',
                {
                  // Adjust your target browsers as needed
                  targets: {
                    ios: '12',
                  },
                  // This config tells Babel to automatically include necessary polyfills
                  // for features you use, referencing core-js where needed
                  useBuiltIns: 'usage',
                  corejs: '3',
                },
              ],
            ],
          },
        },
      },
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
