import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'test-results/', 'playwright-report/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The UI intentionally asserts the presence of known DOM nodes.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
