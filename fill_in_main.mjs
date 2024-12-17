import { chromium } from 'playwright'
import { readFile, readdir } from 'fs/promises'
import { join, basename } from 'node:path'
import { statSync } from 'fs'

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

const FIELDS = {
  'Parcel ID / Folio': '#vPARCELID',
  'Appraisal Link': '#vLEADAPPRAISALLINK',
  'Regrid Link': '#vLEADREGRIDLINK',
  'Owner': '#vLEADOWNERNAME',
  'Address': '#vLEADADDRESS',
  'City': '#vLEADCITY',
  'Zip': '#vLEADZIP',
  'Lot Size (sqf)': '#vLEADLOTSIZE',
  'Primary Land Use': '#vLEADZONNINGCODE',
  'Legal Description': '#vLEADBRIEFLEGALDESCRIPTION',
  'Geo Location Latitude and Longitude': '#vLEADGEOLOCATIONLATXLONG'
}

const nameLatestFile = await getLatestFile(process.cwd())

const document = JSON.parse(
  await readFile(new URL(`./${nameLatestFile}`, import.meta.url))
);

const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: ['--no-sandbox']
})

const page = await browser.newPage()
await page.setExtraHTTPHeaders({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
});

//Sign in
await page.goto('http://194.93.58.207/deed/login.aspx')
await page.waitForLoadState('networkidle')// Wait until page is loaded
const username = await page.locator('#vUSERNAME')
await username.fill('')
const password = await page.locator('#vPASSWORD')
await password.fill('')
await page.locator('#LOGIN').click()
//end sign in

await page.waitForTimeout(1000);
await page.locator('#NEWPLAN').click()
await page.waitForTimeout(1000);
await page.selectOption('#vSTATEID', 'MO')
await page.waitForTimeout(1000);
await page.selectOption('#vCOUNTYNAME', 'Jackson County')
let input = null
for (const record of document) {
  await page.waitForTimeout(1000);
  for (const [key, value] of Object.entries(record)) {
    if (FIELDS.hasOwnProperty(key)){
      input = await page.locator(FIELDS[key])
      await input.fill(value)
    }
  }

  await page.locator('#SAVEANDNEW').click()
}

await browser.close()