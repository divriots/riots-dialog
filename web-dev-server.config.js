import rollupNodeResolve from '@rollup/plugin-node-resolve';
import { fromRollup } from '@web/dev-server-rollup';

const nodeResolve = fromRollup(rollupNodeResolve);

export default {
  open: true,
  watch: true,
  port: 8000,
  rootDir: 'demo',
  plugins: [
    nodeResolve({
      browser: true,
      // omit for production
      exportConditions: ['development'],
    }),
  ],
};
