import nodeResolve from '@rollup/plugin-node-resolve';
import html from '@web/rollup-plugin-html';

export default {
  input: 'demo/index.html',
  output: {
    dir: 'dist',
  },
  plugins: [
    html(),
    nodeResolve({
      browser: true,
    }),
  ],
};
