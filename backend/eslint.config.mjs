import { defineConfig } from 'eslint/config';
import rootConfig from '../eslint.config.mjs';

export default defineConfig([
  ...rootConfig,
  { rules: { '@next/next/no-html-link-for-pages': 'off' } },
]);
