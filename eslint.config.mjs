import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    // New React Compiler rules in eslint-plugin-react-hooks v7 (pulled in by
    // eslint-config-next 16). They flag existing localStorage-hydration and
    // ref patterns that work today; keep them visible as warnings for now.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
