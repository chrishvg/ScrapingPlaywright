import { chromium } from 'playwright'
import fs from 'fs/promises'

async function dateGreaterThanToday(dateFromCalendar) {
  const fechaActual = new Date()
  //const fechaActual =  Date.parse('01 Dec 2024 00:00:00 GMT')
  const fechaElementoFormateada = await new Date(dateFromCalendar.replace('-', ' '))

  return fechaElementoFormateada.getTime() > fechaActual.getTime()
  //return fechaElementoFormateada.getTime() > fechaActual
}

async function saveInJson(date, info) {
  const fechaElementoFormateada = new Date(date.replace('-', ' '))
  const dataToSave = {
    date: fechaElementoFormateada.toISOString(),
    data: info
  }

  const filePath = 'hillsborough.json'

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

const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: ['--no-sandbox']
})

const page = await browser.newPage()
await page.goto('https://hillsborough.realtaxdeed.com/')
await page.getByText('AUCTION CALENDAR').click()
await page.waitForLoadState('networkidle')// Wait until page is loaded
let testCaldate = await page.locator('.CALDATE[tabindex="0"]').first().textContent()
let year = parseInt(testCaldate.split(' ')[1])
const actualYear = new Date().getFullYear()
while (year <= actualYear) {
  const elements = await page.locator('.CALBOX.CALW5.CALSELT').all()
  for (const element of elements) {
    const dateFromCalendar = await element.getAttribute('aria-label')
    if (await dateGreaterThanToday(dateFromCalendar)) {
      await element.click()
      await page.waitForLoadState('networkidle')// Wait until page is loaded
      const auctions = await page.locator('#Area_W').locator(".ad_tab").all()
      let arrayTosave = []
      for (const auction of auctions) {
        const auctionInfo = await auction.locator('.AD_DTA').allTextContents()
        const preUrlParcel = await auction.getByText(auctionInfo[4]).getAttribute('href')
        //Parcel page
        const parcelPage = await browser.newPage()
        await parcelPage.goto(preUrlParcel)
        await parcelPage.locator('.link.force-one-line').click()
        await parcelPage.waitForLoadState('networkidle')// Wait until page is loaded
        const urlParcel = await parcelPage.url()
        //Value Summary & GIS Map Table
        const summaryTable = await parcelPage.locator('.value-and-map-data').locator('table').locator('td.centered').allTextContents()

        //Building 1 Tables
        const tables = await parcelPage.locator('.section-wrap').locator('table').all()
        let buildingData = []
        for (const table of tables) {
          const yearBuiltRow = await table.locator('tr:has-text("Year Built:")').locator('td').all()
          const bedroomsRow = await table.locator('tr:has-text("Bedrooms")').locator('td').all()
          const bathroomsRow = await table.locator('tr:has-text("Bathrooms")').locator('td').all()
          if (yearBuiltRow.length > 0) {
            buildingData.push(await yearBuiltRow[1].textContent())
          }
          if (bedroomsRow.length > 0) {
            buildingData.push(await bedroomsRow[1].textContent())
          }
          if (bathroomsRow.length > 0) {
            buildingData.push(await bathroomsRow[1].textContent())
          }
        }

        //Land Lines
        const lands = await parcelPage.locator('td[data-bind="text: publicValue"]').all()
        const landValue = await lands[1].textContent()

        const auctionToSave = {
          'County Case Number': auctionInfo[1].trim(),
          'Openning Bid': auctionInfo[3],
          'Parcel ID / Folio': auctionInfo[4].trim(),
          'Appraisal Link': urlParcel,
          'Beds' : buildingData[1] ? parseInt(buildingData[1]) : null,
          'Bath' : buildingData[2] ? parseInt(buildingData[2]) : null,
          'Year Build' : buildingData[0] ? parseInt(buildingData[0]) : null,
          'Land Value' : landValue,
          'Market Value' : summaryTable[0],
          'Assessed Value' : summaryTable[1],
        }

        arrayTosave.push(auctionToSave)
        parcelPage.close()
      }
      saveInJson(dateFromCalendar, arrayTosave)
      await page.goBack()
      await page.waitForLoadState('networkidle')// Wait until page is loaded
    }
  }

  await page.locator('.CALNAV[tabindex="0"] a').last().click()
  await page.waitForLoadState('networkidle')// Wait until page is loaded
  testCaldate = await page.locator('.CALDATE[tabindex="0"]').first().textContent()
  year = parseInt(testCaldate.split(' ')[1])
}
await browser.close()