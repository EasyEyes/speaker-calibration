const webpack = require('webpack')

module.exports = {
  mode: 'development',
  entry: './src/main.js',
  output: {
    path: `${__dirname}/dist`,
    filename: '[name].js',
    library: 'soundCheck',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      { test: /\.css$/, 
        use: [ 'style-loader', 'css-loader', ],
      },
    ],
  },
};
