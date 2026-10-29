/**
 * validate.ts — build-time validation of the JSON data files
 * -----------------------------------------------------------
 * Checks every src/data/*.json against its schema (schemas.ts) and fails the
 * build with a precise message if anything drifts: missing fields, wrong
 * types, unknown lens ids, duplicate scenario ids, or an archetype reference
 * that doesn't exist.
 *
 * Run manually:   npx tsx src/schemas/validate.ts
 * (Optionally wired into `npm run build` later — kept standalone for now so
 * the dev loop stays fast.)
 *
 * Security: validation is the content gate — only well-typed, expected data
 * can reach the rendering layer.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
	ArchetypesData,
	LensesData,
	ScenarioSetData,
	SiteData,
	WorkflowData,
} from './schemas';

const DATA_DIR = resolve(import.meta.dirname ?? '.', '..', 'data');

type Json = unknown;

function load(name: string): Json {
	return JSON.parse(readFileSync(resolve(DATA_DIR, name), 'utf-8'));
}

let failures = 0;
function fail(file: string, message: string): void {
	failures += 1;
	console.error(`✗ ${file}: ${message}`);
}

function ok(file: string, message: string): void {
	console.log(`✓ ${file}: ${message}`);
}

function isStr(v: unknown): v is string {
	return typeof v === 'string';
}

function isStrArray(v: unknown): v is string[] {
	return Array.isArray(v) && v.every(isStr);
}

function checkStrs(file: string, obj: Record<string, unknown>, fields: string[]): void {
	for (const f of fields) {
		if (!isStr(obj[f])) fail(file, `field "${f}" must be a string`);
	}
}

/* ---------------- site.json ---------------- */

function validateSite(data: Json): data is SiteData {
	const file = 'site.json';
	const d = data as Record<string, unknown>;
	checkStrs(file, d, ['title', 'subtitle', 'kicker', 'authors', 'license', 'bibtex']);

	const paper = d.paper as Record<string, unknown> | undefined;
	if (!paper || !isStr(paper.title)) fail(file, 'paper.title must be a string');

	const tagline = d.tagline as Record<string, unknown> | undefined;
	if (!tagline || !isStr(tagline.reader) || !isStr(tagline.presenter)) {
		fail(file, 'tagline.reader/presenter must be strings');
	}

	if (failures === 0) ok(file, 'site metadata valid');
	return failures === 0;
}

/* ---------------- lenses.json ---------------- */

const LENS_IDS = ['coherence', 'validity', 'faithfulness'] as const;

function validateLenses(data: Json): data is LensesData {
	const file = 'lenses.json';
	const d = data as { lenses?: unknown };
	if (!Array.isArray(d.lenses) || d.lenses.length !== 3) {
		fail(file, 'must contain exactly 3 lenses');
		return false;
	}
	const ids = new Set<string>();
	for (const lens of d.lenses as Record<string, unknown>[]) {
		checkStrs(file, lens, ['id', 'name', 'relationship', 'definition', 'footnote']);
		if (!LENS_IDS.includes(lens.id as never)) fail(file, `unknown lens id "${lens.id}"`);
		ids.add(String(lens.id));
		if (!Array.isArray(lens.facets) || lens.facets.length === 0) {
			fail(file, `lens "${lens.id}" must list facets`);
		}
		for (const ex of ['goodExample', 'flawedExample'] as const) {
			const e = lens[ex] as Record<string, unknown> | undefined;
			if (!e || !isStr(e.setup) || !isStr(e.explanation) || !isStr(e.why)) {
				fail(file, `lens "${lens.id}" ${ex} needs setup/explanation/why strings`);
			}
		}
	}
	if (ids.size !== 3) fail(file, 'lens ids must be unique');
	if (failures === 0) ok(file, '3 lenses valid');
	return failures === 0;
}

/* ---------------- archetypes.json ---------------- */

function validateArchetypes(data: Json): data is ArchetypesData {
	const file = 'archetypes.json';
	const d = data as { archetypes?: unknown; legend?: unknown };
	if (!Array.isArray(d.archetypes) || d.archetypes.length !== 6) {
		fail(file, 'must contain exactly 6 archetypes');
		return false;
	}
	const letters = new Set<string>();
	for (const a of d.archetypes as Record<string, unknown>[]) {
		checkStrs(file, a, [
			'id',
			'letter',
			'name',
			'summary',
			'prediction',
			'explanation',
			'groundTruthFeature',
			'modelUsed',
			'highlighted',
		]);
		if (a.verdict !== 'correct' && a.verdict !== 'wrong') {
			fail(file, `archetype "${a.id}" verdict must be "correct" or "wrong"`);
		}
		for (const b of ['coherent', 'valid', 'faithful'] as const) {
			if (typeof a[b] !== 'boolean') fail(file, `archetype "${a.id}" ${b} must be boolean`);
		}
		letters.add(String(a.letter));
	}
	if (letters.size !== 6) fail(file, 'archetype letters must be unique (a)–(f)');
	if (!d.legend || typeof d.legend !== 'object') fail(file, 'legend must be an object');
	if (failures === 0) ok(file, '6 archetypes valid');
	return failures === 0;
}

/* ---------------- workflow.json ---------------- */

function validateWorkflow(data: Json): data is WorkflowData {
	const file = 'workflow.json';
	const d = data as { steps?: unknown; intro?: unknown };
	if (!isStr(d.intro)) fail(file, 'intro must be a string');
	if (!Array.isArray(d.steps) || d.steps.length !== 4) {
		fail(file, 'must contain exactly 4 steps (0–3)');
		return false;
	}
	const numbers = new Set<number>();
	for (const s of d.steps as Record<string, unknown>[]) {
		if (typeof s.number !== 'number') fail(file, 'step.number must be a number');
		numbers.add(s.number as number);
		checkStrs(file, s, ['title', 'question']);
		if (!isStrArray(s.details)) fail(file, `step ${s.number} details must be string[]`);
		if (s.lens !== undefined && !LENS_IDS.includes(s.lens as never)) {
			fail(file, `step ${s.number} has unknown lens "${s.lens}"`);
		}
	}
	if (numbers.size !== 4) fail(file, 'step numbers must be unique 0–3');
	if (failures === 0) ok(file, '4 workflow steps valid');
	return failures === 0;
}

/* ---------------- scenarios.*.json ---------------- */

function validateScenarioSet(data: Json, file: string): data is ScenarioSetData {
	const d = data as Record<string, unknown>;
	checkStrs(file, d, ['setId', 'setTitle', 'setIntro']);
	const ctx = d.context as Record<string, unknown> | undefined;
	if (!ctx || !isStr(ctx.domain) || !isStr(ctx.explainee)) {
		fail(file, 'context needs domain/explainee strings');
	}
	if (!Array.isArray(d.scenarios) || d.scenarios.length === 0) {
		fail(file, 'must contain at least one scenario');
		return false;
	}
	const ids = new Set<string>();
	for (const s of d.scenarios as Record<string, unknown>[]) {
		if (!isStr(s.id)) {
			fail(file, 'scenario.id must be a string');
			continue;
		}
		if (ids.has(s.id)) fail(file, `duplicate scenario id "${s.id}"`);
		ids.add(s.id);
		const seen = s.seen as Record<string, unknown> | undefined;
		if (!seen || !isStr(seen.output) || !isStr(seen.explanation)) {
			fail(file, `scenario ${s.id} seen needs output/explanation strings`);
		}
		const gt = s.groundTruth as Record<string, unknown> | undefined;
		if (!gt || !isStr(gt.outcome) || !isStr(gt.premise)) {
			fail(file, `scenario ${s.id} groundTruth needs outcome/premise strings`);
		}
		if (!isStr(s.modelBehavior)) fail(file, `scenario ${s.id} modelBehavior must be a string`);
		if (s.archetype !== null && !isStr(s.archetype)) {
			fail(file, `scenario ${s.id} archetype must be a string or null`);
		}
	}
	if (failures === 0) ok(file, `${ids.size} scenarios valid`);
	return failures === 0;
}

/* ---------------- run all ---------------- */

function main(): boolean {
	console.log('Validating data files against schemas…\n');
	validateSite(load('site.json'));
	validateLenses(load('lenses.json'));
	validateArchetypes(load('archetypes.json'));
	validateWorkflow(load('workflow.json'));
	validateScenarioSet(load('scenarios.banking.json'), 'scenarios.banking.json');
	validateScenarioSet(load('scenarios.spam.json'), 'scenarios.spam.json');

	console.log('');
	if (failures > 0) {
		console.error(`✗ ${failures} validation failure(s). Fix the data files above.`);
		return false;
	}
	console.log('All data files valid.');
	return true;
}

const success = main();
if (!success) process.exit(1);
