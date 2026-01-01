export default {
  'pre-commit': 'npx lint-staged',
  "pre-push": "pnpm lint.fix && pnpm typecheck && pnpm test.run"
};
