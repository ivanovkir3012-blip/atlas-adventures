import { defineConfig } from 'vite';

const isGitHubPages = Boolean(
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.GITHUB_ACTIONS
);

const basePath = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.VITE_BASE_PATH;

export default defineConfig({
  base: isGitHubPages ? (basePath || '/atlas-adventures/') : '/',
});
