import { chromium } from 'playwright'
import { readFile } from 'fs/promises'
import fs from 'fs/promises'

async function saveInJson(info) {
  const today = new Date()
  const filePath = `missouri_jackson_results_${today.getDate()}-${today.getMonth() + 1}.json`

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

const document = JSON.parse(
  await readFile(new URL('./missouri_jackson.json', import.meta.url))
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
await page.goto('https://app.regrid.com/us/mo/')
await page.waitForLoadState('networkidle')// Wait until page is loaded
// await page.locator('.fa.fa-angle-down.h4.margin-left-md.rotate-0.white').click()
// await page.waitForLoadState('networkidle')// Wait until page is loaded
// await page.locator('.show-signup').click()
// await page.locator('#map_signin_email').last().fill('')
// await page.locator('#map_signin_password').last().fill('')
// await page.locator('#signInCard-signIn').last().locator('[type=submit]').click()
// await page.waitForSelector('span:is(.text.bold.truncate):visible:has-text("fffhunter")');
//end sign in

let arrayTosave = []
for (const folioId of document.data) {
  //search input
  const searchInput = await page.locator('#glmap-search-query')
  const folioSubString = folioId.substring(2)
  await searchInput.fill(folioSubString)
  await page.waitForSelector('.headline.parcel-result a', { state: 'visible' })

  //click on the link
  const links = await page.locator('.headline.parcel-result a').all()
  await links.at(2).click()
  await page.waitForSelector('h3.h4:visible:has-text("Property Details")');

  //get legal description
  const legalValue = await page.locator('div.field:has-text("Legal Description")').locator('.field-value').textContent()

  //get address
  const address = await page.locator('address').last().textContent()
  const addressSeparated = address.split(',')
  const city = addressSeparated.at(1).trim()
  const zip = addressSeparated.at(2).split(' ').at(2).trim()

  //get lot size
  const measurements = await page.getByText('sqft').textContent()
  const landSize = measurements.split(' ').at(0).trim()

  //get owner
  const enhancedOwner = await page.locator('div.panel-body:has-text("Enhanced Owner")').locator('.field-value').locator('.flex-row-between').allTextContents()
  const owner = enhancedOwner.at(2).trim()

  //get mail address
  const mailAdress = enhancedOwner.at(3).trim()

  //get coordinates
  const coordinatesContents = await page.locator('div.panel-body:has-text("Centroid Coordinates")').locator('.field-value').locator('.flex-row-between').allTextContents()
  const formatCoordinates = /^(\-?\d+\.\d+), (\-?\d+\.\d+)$/ 
  const coordinates = coordinatesContents.find(element => formatCoordinates.test(element))

  //get flood
  const floodContents = await page.locator('div.subsection:has-text("FEMA Flood Data")').locator('.field-value').locator('.flex-row-between').allTextContents()
  const flood = floodContents.length > 0 ? floodContents[0] : ''

  //get zoning
  const zoning = await page.locator('div.panel-body:has-text("Zoning Type")').locator('.field-value').locator('.flex-row-between').allTextContents()

  //get structure year
  const yearBuilds = await page.locator('div.panel-body:has-text("Structure Year Built")').locator('.field-value').locator('.flex-row-between').allTextContents()
  const formatYearBuild = /^(\d{4})$/
  const year = yearBuilds.find(element => formatYearBuild.test(element))
  const yearToSave = typeof year !== 'undefined' ? year : ''

  //get appraisal link
  const groupSizes = [2, 3, 2, 2, 2, 1, 2, 3]
  let currentIndex = 0
  let arrayFolioId = []
  for (const size of groupSizes) {
    let temp = folioSubString.substring(currentIndex, currentIndex + size)
    arrayFolioId.push(temp)
    currentIndex += size
  }
  const folioIdFormat = arrayFolioId.join('-')
  const urlAppraisal = "https://ascendweb.jacksongov.org/parcelinfo.aspx?parcel_number=" + folioIdFormat

  const dataToSave = {
    'Parcel ID / Folio' : folioId,
    'Appraisal Link': urlAppraisal,
    'Regrid Link' : page.url(),
    'Owner' : owner,
    'Address' : address,
    'City' : city,
    'Zip' : zip,
    'Lot Size (sqf)' : landSize,
    'Year Built' : yearToSave,
    'Primary Land Use' : zoning.at(2),
    'Legal Description' : legalValue,
    'Geo Location Latitude and Longitude' : coordinates,
    'Mail Address' : mailAdress,
    'Flood' : flood,
  }
  arrayTosave.push(dataToSave)
}

//save in json
saveInJson(arrayTosave)
await browser.close()