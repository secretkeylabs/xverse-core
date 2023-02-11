const webpack = require('webpack');
const path = require('path');

const NODE_ENV_PRODUCTION = 'production';
const NODE_ENV_DEVELOPMENT = 'development';

const isProduction = process.env.NODE_ENV === NODE_ENV_PRODUCTION;

module.exports = {
  mode: isProduction ? NODE_ENV_PRODUCTION : NODE_ENV_DEVELOPMENT,
  entry: ['./index.ts'],
  output: {
    library: {
      name: 'xverse-core',
      type: 'umd',
    },
    filename: 'index.js',
    path: path.resolve(process.cwd(), 'dist/umd'),
    globalObject: 'this',
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser'),
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  optimization: {
    minimize: isProduction,
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve('ts-loader'),
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@stacks/auth': '@stacks/auth/dist/esm',
      '@stacks/bns': '@stacks/bns/dist/esm',
      '@stacks/common': '@stacks/common/dist/esm',
      '@stacks/encryption': '@stacks/encryption/dist/esm',
      '@stacks/keychain': '@stacks/keychain/dist/esm',
      '@stacks/network': '@stacks/network/dist/esm',
      '@stacks/profile': '@stacks/profile/dist/esm',
      '@stacks/stacking': '@stacks/stacking/dist/esm',
      '@stacks/storage': '@stacks/storage/dist/esm',
      '@stacks/transactions': '@stacks/transactions/dist/esm',
      '@stacks/wallet-sdk': '@stacks/wallet-sdk/dist/esm',
    },
    fallback: {
      util: require.resolve('util/'),
      crypto: false,
      stream: false,
    },
  },
  experiments: {
    asyncWebAssembly: true,
  },
};
