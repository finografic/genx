export default {
  'pre-commit': 'npx lint-staged',
  "pre-push": "pnpm lint && pnpm typecheck && pnpm test"
};
