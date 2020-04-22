import fs from 'fs'
import unknownTest, { TestInterface } from 'ava'
import autocrop, { startBrowser, closeBrowser } from '../src'

const test = unknownTest as TestInterface<{ [x: string]: string }>

const getSVG = (attrs = '', fill = '#000') =>
  `<svg ${attrs}><rect width="100px" height="100px" fill="${fill}"></rect></svg>`

test.before(async (t) => {
  await startBrowser()
  const fixtures = await fs.promises.readdir('test/fixtures')
  t.context = (
    await Promise.all(
      fixtures.map(async (file) => ({
        [file.replace(/\..*?$/, '')]: await fs.promises.readFile(`test/fixtures/${file}`, 'utf-8')
      }))
    )
  ).reduce((acc, curr) => ({ ...acc, ...curr }))
})

test('correctly crops an image', async (t) => {
  const firebase = await autocrop(t.context.firebase)
  t.snapshot(firebase)
})

test('correctly infers viewBox from dimensions', async (t) => {
  const firebaseDimensions = await autocrop(t.context.firebaseDimensions)
  t.snapshot(firebaseDimensions)
})

test('correctly infers viewBox from style', async (t) => {
  const firebaseStyle = await autocrop(t.context.firebaseStyle)
  t.snapshot(firebaseStyle)
})

test('correctly crops images in batches', async (t) => {
  const images = Object.values(t.context)
  const [singular, batch] = await Promise.all([
    Promise.all(images.map((svg) => autocrop(svg))),
    autocrop(images)
  ])
  t.deepEqual(singular, batch)
})

test('throws if the size option is too big', async (t) => {
  await t.throwsAsync(() => autocrop('<svg></svg>', { size: 2000 }), {
    message: 'Maximum bitmap size is 1600, got: 2000'
  })
})

test("throws if the data doesn't contain an svg tag", async (t) => {
  await t.throwsAsync(() => autocrop('<div></div>'), { message: 'Incorrect data in svg #0' })
  await t.throwsAsync(() => autocrop([getSVG('viewBox="0 0 100 100"'), '<div></div>']), {
    message: 'Incorrect data in svg #1'
  })
})

test('tries to infer the viewBox from dimension attributes and enable-background style', async (t) => {
  await t.throwsAsync(() => autocrop(getSVG('viewBox="0 0 0 0"')), {
    message: 'Invalid viewBox inferred for svg #0: "0 0 0 0"'
  })
  await t.throwsAsync(() => autocrop(getSVG('x="0px" y="0px" width="0px" height="0px"')), {
    message: 'Invalid viewBox inferred for svg #0: "undefined"'
  })
  await t.throwsAsync(() => autocrop(getSVG('style="enable-background: new 0 0 0 0;"')), {
    message: 'Invalid viewBox inferred for svg #0: "0 0 0 0"'
  })
  await t.throwsAsync(() => autocrop(getSVG()), {
    message: 'Invalid viewBox inferred for svg #0: "undefined"'
  })
  await t.notThrowsAsync(() => autocrop(getSVG('viewBox="0 0 100 100"')))
  await t.notThrowsAsync(() => autocrop(getSVG('x="0px" y="0px" width="100px" height="100px"')))
  await t.notThrowsAsync(() => autocrop(getSVG('style="enable-background: new 0 0 100 100;"')))
})

test('throws an error if passed an svg without opaque content', async (t) => {
  await t.throwsAsync(() => autocrop(getSVG('viewBox="0 0 100 100"', 'none')), {
    message: 'Error processing svg #0: no non-transparent pixels found'
  })
})

test.after.always(() => {
  closeBrowser()
})
