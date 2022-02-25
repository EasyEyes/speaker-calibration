const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  entry: {
    main: "./src/main.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    library: {
      name: "speakerCalibrator",
      type: "umd",
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  // experiments: {
  //   asyncWebAssembly: true,
  //   syncWebAssembly: true,
  // },
  // plugins: [new CopyPlugin([{ from: "src/mleGen/build", to: "" }])],
};
