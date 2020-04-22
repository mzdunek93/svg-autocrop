import fs from 'fs'
import unknownTest, { TestInterface } from 'ava'
import autocrop from '../src'
import { debug, getDebug } from '../src/debug'

const test = unknownTest as TestInterface<{ [x: string]: string }>

test.before(async () => {
  const fixtures = await fs.promises.readdir('test/fixtures')
  const images = await Promise.all(
    fixtures.map((file) => fs.promises.readFile(`test/fixtures/${file}`, 'utf-8'))
  )
  await autocrop(images)
})

test('correctly saves a screenshot', async (t) => {
  t.snapshot(getDebug('image'))
})

test('saves an arbitrary value', async (t) => {
  const count = 0
  debug('count', count)
  t.is(getDebug('count'), count)
})

test('throws an error when accessing a nonexistent value', async (t) => {
  t.throws(() => getDebug('browser'))
})
