import { chromium } from 'playwright'
import { readFile } from 'fs/promises'
import fs from 'fs/promises'


async function saveInJson(date, info) {
  const dataToSave = {
    date: date,
    data: info
  }

  const filePath = 'hillsborough_final.json'

  try {
    const existingData = await fs.readFile(filePath, 'utf8');
    let parsedData = [];
    if (existingData) {
      parsedData = JSON.parse(existingData);
    }
    parsedData.push(dataToSave);
    await fs.writeFile(filePath, JSON.stringify(parsedData));
    console.log('Datos agregados correctamente al archivo', filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify([dataToSave]));
      console.log('Nuevo archivo creado:', filePath);
    } else {
      console.error('Error al escribir el archivo:', err);
    }
  }
}

const document = JSON.parse(
  await readFile(new URL('./hillsborough.json', import.meta.url))
);

const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: ['--no-sandbox']
})
const page = await browser.newPage()
const pageZillow = await browser.newPage()
const pageRedfin = await browser.newPage()
const pageRealtor = await browser.newPage()

//Sign in
await page.goto('https://app.regrid.com/us/fl/')
await page.waitForLoadState('networkidle')// Wait until page is loaded
await page.locator('.fa.fa-angle-down.h4.margin-left-md.rotate-0.white').click()
await page.waitForLoadState('networkidle')// Wait until page is loaded
await page.locator('.show-signup').click()
await page.locator('#map_signin_email').last().fill('')
await page.locator('#map_signin_password').last().fill('')
await page.locator('#signInCard-signIn').last().locator('[type=submit]').click()

for (const item of document) {
  const date = item.date
  let arrayTosave = []
  for (const auction of item.data) {
    const regridLink = await auction["Regrid Link"]
    await page.goto(regridLink)
    await page.waitForLoadState('domcontentloaded')// Wait until page is loaded
    const legalValue = await page.locator('div.field:has-text("Legal Description")').locator('.field-value').textContent()
    const address = await page.locator('address').last().textContent()
    const addressSeparated = address.split(',')
    const city = addressSeparated[1].trim()
    const zip = addressSeparated[2].split(' ')[2].trim()
    const measurements = await page.getByText('sqft').textContent()
    const landSize = measurements.split(' ')[0].trim()
    //@todo No Data
    const enhancedOwner = await page.locator('div.panel-body:has-text("Enhanced Owner")').locator('.field-value').locator('.flex-row-between').allTextContents()
    const owner = enhancedOwner[2].trim()
    const mailAdress = enhancedOwner[3].trim()
    const coordinatesContents = await page.locator('div.panel-body:has-text("Centroid Coordinates")').locator('.field-value').locator('.flex-row-between').allTextContents()
    const coordinates = coordinatesContents[1]
    const floodContents = await page.locator('div.subsection:has-text("FEMA Flood Data")').locator('.field-value').locator('.flex-row-between').allTextContents()
    const flood = floodContents[0]

    const auctionToSave = {
      'County Case Number': auction['County Case Number'],
      'Openning Bid': auction['Openning Bid'],
      'Parcel ID / Folio': auction['Parcel ID / Folio'],
      'Appraisal Link': auction['Appraisal Link'],
      'Beds' : auction['Beds'],
      'Bath' : auction['Bath'],
      'Year Build' : auction['Year Build'],
      'Land Value' : auction['Land Value'],
      'Market Value' : auction['Market Value'],
      'Assessed Value' : auction['Assessed Value'],
      'Regrid Link' : auction["Regrid Link"],
      'Address' : address[0],
      'City' : city,
      'Zip' : zip,
      'Land Size' : landSize,
      'Owner' : owner,
      'Legal Description' : legalValue[0],
      'Geo Location Latitude and Longitude' : coordinates,
      'Mail Address' : mailAdress,
      'Flood' : flood,
    }
    arrayTosave.push(auctionToSave)
  }
  saveInJson(date, arrayTosave)
}
await browser.close()
