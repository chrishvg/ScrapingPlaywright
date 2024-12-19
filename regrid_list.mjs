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

const pageMap = await browser.newPage()
await pageMap.setExtraHTTPHeaders({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
});

await pageMap.goto('https://www.google.com/maps/')
await pageMap.waitForLoadState('networkidle')// Wait until page is loaded

//Sign in
await page.goto('https://app.regrid.com/us/mo/')
await page.waitForLoadState('networkidle')// Wait until page is loaded
await page.locator('.fa.fa-angle-down.h4.margin-left-md.rotate-0.white').click()
await page.waitForLoadState('networkidle')// Wait until page is loaded
await page.locator('.show-signup').click()
await page.waitForSelector('#signup-signin', { state: 'visible' })
const signin = await page.locator('#map_signin_email').all()
await signin.at(1).fill('')
const password = await page.locator('#map_signin_password').all()
await password.at(1).fill('')
const submitButton = await page.locator('#signInCard-signIn').all()
await submitButton.at(1).locator('[type=submit]').click()
await page.waitForTimeout(1000);
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
  const buttonLocator = await page.locator('button[data-tip="Change measurement units"]').all()
  buttonLocator.at(0).click()
  await page.waitForSelector('select.conversion-select:visible')
  const selectLocator = await page.locator('select.conversion-select')
  await selectLocator.selectOption('squareFeet')
  const measurements = await page.locator('span.conversion-value').all()
  const landText = await measurements.at(0).textContent()
  const landSize = landText.split(' ').at(0).trim()

  //get owner
  const enhancedOwner = await page.locator('div.panel-body:has-text("Enhanced Owner")').locator('.field-value').locator('.flex-row-between').allTextContents()
  const owner = enhancedOwner.at(2).trim()

  //get mail address
  const mailAdress = enhancedOwner.at(3).trim()

  //get coordinates
  const coordinates = await page.locator('div.field:has-text("Centroid Coordinates")').locator('span').textContent()

  //get flood
  const floodContents = await page.locator('div.field:has-text("FEMA Flood Zone")').all()
  let flood = ''
  if (floodContents.length > 0) {
    flood = await floodContents.at(0).locator('.field-value').textContent()
  }

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

  //get parcer use description
  const parcelUseDescription = await page.locator('div.field:has-text("Parcel Use Description")').locator('span').textContent()

  //get map link
  const inputMap = await pageMap.locator('#searchboxinput')
  await inputMap.fill(coordinates)
  await inputMap.press('Enter')
  await page.waitForTimeout(1000);
  const mapLink = await pageMap.url()

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
    'Primary Land Use' : parcelUseDescription,
    'Legal Description' : legalValue,
    'Geo Location Latitude and Longitude' : coordinates,
    'Google Map Link' : mapLink,
    'Mail Address' : mailAdress,
    'Flood' : flood,
  }
  arrayTosave.push(dataToSave)
}

//save in json
saveInJson(arrayTosave)
await browser.close()