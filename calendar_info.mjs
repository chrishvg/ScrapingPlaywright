import { chromium } from 'playwright'
import fs from 'fs/promises'
import XLSX from 'xlsx'

async function saveInJson(info) {
  const today = new Date()
  const filePath = `charlote_results_${today.getDate()}-${today.getMonth() + 1}.json`

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

function saveToExcel(url, data) {
  const regexText = /\/\/([^\.]+)\.realforeclose/
  const matchText = url.match(regexText)
  const countyName = matchText ? matchText[1] : ""

  const regexDate = /\d{2}\/\d{2}\/\d{4}$/
  const matchDate = url.match(regexDate)
  const date = matchDate ? matchDate[0].replace(/\//g, '-') : ""

  const fileName = `${countyName}_${date}.xlsx`
  
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")

  XLSX.writeFile(workbook, fileName)
  console.log('Datos agregados correctamente al archivo ', fileName)
}

const url = 'https://www.miamidade.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AUCTIONDATE=02/13/2025'
const invalidArray = []
const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: ['--no-sandbox']
})

const page = await browser.newPage()
const pageRegrid = await browser.newPage()
const header = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
}

await pageRegrid.setExtraHTTPHeaders(header)
await pageRegrid.goto('https://app.regrid.com/us/fl/')
await pageRegrid.waitForLoadState('networkidle')// Wait until page is loaded
//sign in
await pageRegrid.locator('.fa.fa-angle-down.h4.margin-left-md.rotate-0.white').click()
await pageRegrid.waitForLoadState('networkidle')// Wait until page is loaded
await pageRegrid.locator('.show-signup').click()
await pageRegrid.waitForSelector('#signup-signin', { state: 'visible' })
const signin = await pageRegrid.locator('#map_signin_email').all()
await signin.at(1).fill('')
const password = await pageRegrid.locator('#map_signin_password').all()
await password.at(1).fill('')
const submitButton = await pageRegrid.locator('#signInCard-signIn').all()
await submitButton.at(1).locator('[type=submit]').click()
//end sign in

await page.setExtraHTTPHeaders(header)
await page.goto(url)
await page.waitForLoadState('networkidle')// Wait until page is loaded
let currentPage = 1
let arrayTosave = []
const calendarDate = new Date(await page.locator('.BLHeaderDateDisplay').textContent())
const dateFormatted = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(calendarDate)
//pages
const finalPage = await page.locator('#maxWA').textContent()
while (currentPage <= finalPage) {
  const area = await page.locator('#Area_W')
  const auctions = await area.locator('.AUCTION_ITEM.PREVIEW').all()
  for (const auction of auctions) {
    const auctionInfo = await auction.locator('.AUCTION_DETAILS')
    const table = await auctionInfo.locator('table.ad_tab')
    const rows = await table.locator('tbody tr').all()
    let countyCaseNumber = ''
    let openningBid = ''
    let parcelIDFolio = ''
    let appraisalLink = ''
    let owner = ''
    let address = ''
    let addressCalendar = ''
    let city = ''
    let zip = ''
    let landSize = ''
    let assessedValue = ''
    let legalValue = ''
    let flood = ''
    let coordinates = ''
    let mailAdress = ''
    let zoningType = ''
    for (const row of rows) {
      const tHead = await row.locator('th').textContent()
      const tBodyObject = await row.locator('td')
      const tBodyText = await tBodyObject.textContent()
      if (tHead == 'Opening Bid:') {
        openningBid = tBodyText
      }

      if (tHead == 'Case #:') {
        countyCaseNumber = tBodyText
      }

      if (tHead == 'Assessed Value:') {
        assessedValue = tBodyText
      }

      if (tHead == 'Property Address:') {
        addressCalendar = tBodyText
      }
      
      if (tHead == 'Parcel ID:') {
        appraisalLink = await tBodyObject.locator('a').getAttribute('href')
        parcelIDFolio = tBodyText.trim()
        
        if (invalidArray.includes(parcelIDFolio)) {
          continue
        }
        //search input
        const searchInput = await pageRegrid.locator('#glmap-search-query')
        await searchInput.fill(parcelIDFolio)
        try {
          await pageRegrid.waitForSelector('.headline.parcel-result a', { state: 'visible' })
          //click on the link
          const links = await pageRegrid.locator('.headline.parcel-result a').all()
          if (links.length <= 3) {
            await links.at(2).click()
            await pageRegrid.waitForSelector('span.conversion-value', { state: 'visible' })

            //get address
            const addresses = await pageRegrid.locator('address').all()
            if (addresses.length > 0) {
              address = await pageRegrid.locator('address').last().textContent()
              const addressSeparated = address.split(',')
              city = addressSeparated.at(1)
              zip = addressSeparated.at(2).split(' ').at(2)
            }

            //get legal description
            legalValue = await pageRegrid.locator('div.field:has-text("Legal Description")').locator('.field-value').textContent()

            //get lot size
            const buttonLocator = await pageRegrid.locator('button[data-tip="Change measurement units"]').all()
            buttonLocator.at(0).click()
            await pageRegrid.waitForSelector('select.conversion-select:visible')
            const selectLocator = await pageRegrid.locator('select.conversion-select')
            await selectLocator.selectOption('squareFeet')
            const measurements = await pageRegrid.locator('span.conversion-value').all()
            const landText = await measurements.at(0).textContent()
            landSize = landText.split(' ').at(0).trim()

            //get owner
            const enhancedOwner = await pageRegrid.locator('div.panel-body:has-text("Enhanced Owner")').locator('.field-value').locator('.flex-row-between').allTextContents()
            owner = enhancedOwner.at(2).trim()

            //get mail address
            mailAdress = enhancedOwner.at(3).trim()

            //get coordinates
            coordinates = await pageRegrid.locator('div.field:has-text("Centroid Coordinates")').locator('span').textContent()

            //get flood
            const floodContents = await pageRegrid.locator('div.field:has-text("FEMA Flood Zone")').all()
            if (floodContents.length > 0) {
              flood = await floodContents.at(0).locator('.field-value').textContent()
            }

            //get zoning type
            zoningType = await pageRegrid.locator('div.field.premium:has-text("Zoning Type")').locator('.field-value').locator('.flex-row-between').textContent()
          }
        } catch (error) {
          console.error('La etiqueta headline.parcel-result no fue encontrada:', error)
        }
      }
    }

    const auctionToSave = {
      'Auction Date': dateFormatted,
      'County Case Number': countyCaseNumber,
      'Openning Bid' : openningBid,
      'Parcel ID / Folio': parcelIDFolio,
      'Appraisal Link' : appraisalLink,
      'Regrid Link' : pageRegrid.url(),
      'Owner' : owner,
      'Address' : address == '' ? addressCalendar : address,
      'City' : city,
      'Zip' : zip,
      'Lot Size (sqf)' : landSize,
      'Assessed Value' : assessedValue,
      'Legal Description' : legalValue,
      'Geo Location Latitude and Longitude' : coordinates,
      'Mail Address' : mailAdress,
      'Flood' : flood,
      'Zoning Type' : zoningType,
    }

    arrayTosave.push(auctionToSave)
  }
  currentPage++
  const nextButton = await page.locator('.PageRight').all()
  await nextButton.at(0).click()
  await page.waitForSelector('.AUCTION_ITEM.PREVIEW', { state: 'visible' })
}
saveInJson(arrayTosave)
//saveToExcel(url,arrayTosave)
await browser.close()