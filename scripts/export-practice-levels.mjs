import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { rawLevels } from '../app/data/levels.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'app', 'data', 'levels', 'default')
const checkOnly = process.argv.includes('--check')

// These are keys from codeventure-bof/data/concepts.json. Keep the original
// Debug Master group name in meta because BOF has no recursion concept yet.
const concepts = {
  'Sequence and repeat loops': ['sequence'],
  Conditionals: ['if'],
  'While loops and negation': ['while'],
  'Functions and decomposition': ['function'],
  'Recursion and advanced control flow': ['function']
}

function toPage(level, order) {
  if (level.id !== order || level.map.length !== level.rows || level.map.some(row => row.length !== level.cols)) {
    throw new Error(`Invalid dimensions or order in level ${level.id}`)
  }
  const [row, col] = level.start
  if (row < 0 || row >= level.rows || col < 0 || col >= level.cols || !level.code) {
    throw new Error(`Invalid start or code in level ${level.id}`)
  }
  const mappedConcepts = concepts[level.concept]
  if (!mappedConcepts) throw new Error(`Unknown concept in level ${level.id}: ${level.concept}`)

  return {
    layout: 'DEBUG_CODING',
    type: 'PRACTICE',
    status: 'ACTIVE',
    content: {
      title: { en: level.title, th: `ด่าน ${String(order).padStart(2, '0')}` },
      description: { en: '', th: level.learningObjective },
      gameConfig: {
        concepts: mappedConcepts,
        defaultCode: level.code,
        tileMapSize: { row: level.rows, col: level.cols },
        defaultPlayerPosition: { row, col },
        defaultDirection: 'south',
        debugMap: level.map,
        meta: {
          sourceId: level.id,
          setId: 'default',
          order,
          learningObjective: level.learningObjective,
          legacyConcept: level.concept,
          ...(level.image ? { sourceImage: level.image } : {})
        }
      }
    }
  }
}

if (rawLevels.length !== 60) throw new Error(`Expected 60 practice levels, found ${rawLevels.length}`)
if (!checkOnly) await mkdir(outputDir, { recursive: true })

const expectedNames = []
for (const [index, level] of rawLevels.entries()) {
  const name = `level${index + 1}.json`
  expectedNames.push(name)
  const json = `${JSON.stringify(toPage(level, index + 1), null, 2)}\n`
  const path = join(outputDir, name)
  if (checkOnly) {
    const existing = await readFile(path, 'utf8')
    if (existing !== json) throw new Error(`${name} differs from app/data/levels.ts`)
  } else {
    await writeFile(path, json, 'utf8')
  }
}

if (checkOnly) {
  const actualNames = (await readdir(outputDir)).filter(name => /^level\d+\.json$/.test(name))
  const extras = actualNames.filter(name => !expectedNames.includes(name))
  if (extras.length) throw new Error(`Unexpected level files: ${extras.join(', ')}`)
}

console.log(`${checkOnly ? 'Verified' : 'Exported'} ${expectedNames.length} practice levels in ${outputDir}`)
