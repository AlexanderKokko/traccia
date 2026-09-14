import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Replaced at build time by Vite's `define`; true only in the
        // single-file build, which has to use hash routing.
        __SINGLE_FILE__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': [
        'error',
        // ignoreRestSiblings allows `const { drop, ...keep } = obj` — the idiom
        // used to strip database-only columns before writing a record back.
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // A concise-body arrow returns its expression, and React treats an effect's
      // return value as a cleanup function — `useEffect(() => doThing(), [])`
      // then crashes with "destroy is not a function". Require a block body.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='useEffect'] > ArrowFunctionExpression[body.type!='BlockStatement']",
          message:
            'useEffect callbacks must use a block body: a concise arrow returns its value, which React mistakes for a cleanup function.',
        },
      ],
    },
  },
]
