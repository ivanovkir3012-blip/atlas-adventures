import { defineConfig } from 'vite';

const isGitHubPages = Boolean(
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.GITHUB_ACTIONS
);

export default defineConfig({
  base: isGitHubPages ? '/atlas-adventures/' : '/',
});
