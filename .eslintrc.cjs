module.exports = {
  root: true,
  env: {
    es2020: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: ['apps/frontend/**/*.{ts,tsx}'],
      env: {
        browser: true,
      },
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['apps/backend/**', '../../backend/**', '../backend/**'],
                message: 'Frontend code must call the backend API instead of importing backend modules.',
              },
              {
                group: [
                  '@/services/emailContentPreparationService',
                  '@/services/kitMergePropertySyncService',
                  '@/services/emailPlatform/**',
                ],
                message: 'Admin email delivery logic belongs in apps/backend. Use a frontend API client facade.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/backend/**/*.ts'],
      env: {
        node: true,
      },
    },
  ],
}
