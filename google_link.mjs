import { chromium } from 'playwright'
import { readFile, readdir } from 'fs/promises'
import { join, basename } from 'node:path'
import { statSync } from 'fs'
import fs from 'fs/promises'

async function getLatestFile(directory) {
  try {
    const files = await readdir(directory)

    const filePaths = files
      .map(file => join(directory, file))
      .filter(file => statSync(file).isFile() && file.indexOf('_results_') > -1)

    const sortedFiles = filePaths.sort((a, b) => {
      return statSync(b).ctimeMs - statSync(a).ctimeMs
    })

    return sortedFiles.length > 0 ? basename(sortedFiles[0]) : null
  } catch (err) {
    console.error('Error al obtener el archivo:', err)
    return null
  }
}

async function saveInJson(info) {
  const today = new Date()
  const filePath = `con_google_results_${today.getDate()}-${today.getMonth() + 1}.json`

  try {
    const existingData = await fs.readFile(filePath, 'utf8');
    let parsedData = [];
    if (existingData) {
      parsedData = JSON.parse(existingData);
    }
    parsedData.push(info);
    await fs.writeFile(filePath, JSON.stringify(parsedData));
    console.log('Datos agregados correctamente al archivo', filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(info));
      console.log('Nuevo archivo creado:', filePath);
    } else {
      console.error('Error al escribir el archivo:', err);
    }
  }
}

const nameLatestFile = await getLatestFile(process.cwd())

const document = JSON.parse(
  await readFile(new URL(`./${nameLatestFile}`, import.meta.url))
)

const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: ['--no-sandbox']
})

const page = await browser.newPage()
await page.setExtraHTTPHeaders({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
})

await page.goto('https://maps.google.com/')
await page.waitForLoadState('networkidle')// Wait until page is loaded
await page.waitForTimeout(1000)
let arrayTosave = []
let input = null
for (let record of document) {
  input = await page.locator('#searchboxinput')
  await input.fill(record["Geo Location Latitude and Longitude"])
  await page.keyboard.press('Enter')
  await page.waitForLoadState('networkidle')// Wait until page is loaded
  await page.waitForTimeout(1000)
  record["Google Map Link"] = page.url()
  arrayTosave.push(record)
}
saveInJson(arrayTosave)