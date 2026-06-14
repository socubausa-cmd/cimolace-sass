import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // ──────────────────────────────────────────────────────────────
  // INVARIANT D'ARCHITECTURE — LIRI doit rester AUTONOME.
  // Le moteur live (modules/liri, components/liri, pages/liri) ne doit
  // JAMAIS importer l'École (school) ni Studio Créateur (studio-creator).
  // École et Studio Créateur peuvent dépendre de Liri, jamais l'inverse.
  // Cf. docs/ARCHITECTURE_LIRI_VS_ECOLE.md
  // ──────────────────────────────────────────────────────────────
  {
    files: [
      'src/modules/liri/**/*.{js,jsx,ts,tsx}',
      'src/components/liri/**/*.{js,jsx,ts,tsx}',
      'src/pages/liri/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/school/*',
                '@/pages/school/*',
                '@/modules/school/*',
                '**/components/school/*',
                '**/pages/school/*',
                '**/modules/school/*',
              ],
              message:
                "Liri doit rester autonome : import depuis École (school) interdit. École consomme Liri, jamais l'inverse.",
            },
            {
              group: [
                '@/components/studio-creator/*',
                '@/pages/studio-creator/*',
                '**/components/studio-creator/*',
                '**/pages/studio-creator/*',
              ],
              message:
                'Liri doit rester autonome : import depuis Studio Créateur interdit. Studio Créateur consomme Liri, jamais l’inverse.',
            },
          ],
        },
      ],
    },
  },
)
