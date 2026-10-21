// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Astro configuration — Shade Page ("Explanation Wrongness" companion site)
 *
 * GitHub Pages (project pages) serves the site from a subpath, so `site` and
 * `base` MUST be set before deploying (SETUP.md Step 5):
 *   site: 'https://<username>.github.io'
 *   base: '/<repository-name>'
 */
export default defineConfig({
	// TODO(deploy): replace <username> with your GitHub username and
	// 'shade-page' with the actual repository name (both places below).
	site: 'https://5ShadesOfWrong.github.io',
	base: '/5Shades_Page',

	// Security hardening (project constraint): Astro auto-escapes expressions by
	// default. Never use `set:html` on dynamic data. Predictable URL handling:
	trailingSlash: 'ignore',
});
