import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: {
    path: './specs/openapi.json',
  },
  output: {
    path: './src/generated',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/sdk',
      auth: true,
    },
    '@hey-api/client-fetch',
  ],
});
