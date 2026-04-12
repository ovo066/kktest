import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.tmp/**',
      '.claude/**'
    ]
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  pluginVue.configs['no-layout-rules'],
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        ...globals.node,
        __APP_BUILD_ID__: 'readonly'
      }
    },
    rules: {
      // Keep the baseline lightweight; tighten incrementally.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'no-empty': 'off',
      'no-control-regex': 'off',
      'preserve-caught-error': 'off',
      'no-console': 'off',
      'vue/multi-word-component-names': 'off'
    }
  }
]
