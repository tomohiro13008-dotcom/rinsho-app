import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { stripPrivateSources } from './src/build/strip-private';

// PUBLIC_BUILD=1 のときは、出典のうち public: false（書籍の頁など自分用）を配布物から落とす。
const publicBuild = process.env.PUBLIC_BUILD === '1';

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    {
      name: 'strip-private-sources',
      enforce: 'pre',
      transform(code, id) {
        if (!publicBuild) return null;
        if (!/[\\/]content[\\/].+\.json$/.test(id)) return null;
        return { code: stripPrivateSources(code), map: null };
      },
    },
  ],
  define: {
    __PUBLIC_BUILD__: JSON.stringify(publicBuild),
    __BUILD_ID__: JSON.stringify((process.env.COMMIT_REF ?? 'local').slice(0, 7)),
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,mjs}'],
  },
});
