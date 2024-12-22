import { chromium } from 'playwright'
import XLSX from 'xlsx'

function dateBetweenAugustAndNow(dateFromCalendar) {
  try {
    const fechaFormateada = new Date(dateFromCalendar)

    const startDate = new Date('08/01/2024')
    const endDate = new Date()

    const result = fechaFormateada.getTime() >= startDate.getTime() && fechaFormateada.getTime() <= endDate.getTime()
    return result
  } catch (error) {
    console.error(`Error parsing date: ${dateFromCalendar}`, error)
    return false
  }
}

function saveToExcel(data) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")

  XLSX.writeFile(workbook, 'broward.xlsx')
  console.log('Datos agregados correctamente al archivo broward.xlsx')
}

const browser = await chromium.launch({
  headless: false,
  slowMo: 100,
  args: ['--no-sandbox']
})

const page = await browser.newPage()
await page.setExtraHTTPHeaders({
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
});

const pageRegrid = await browser.newPage()
await pageRegrid.setExtraHTTPHeaders({
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
});

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
await pageRegrid.waitForTimeout(1000);
//end sign in

await page.goto('https://broward.deedauction.net/reports/total_sales/')
await page.waitForLoadState('networkidle')// Wait until page is loaded

let table = null
let rows = null
let isDisabled = false
let nextButton = null
let arrayTosave = []

while (isDisabled === false) {
  table = await page.locator('.basic')
  rows = await table.locator('tbody tr').all()
  for (const row of rows) {
    const values = await row.locator('td').all()
    const SoldAmount = await values.at(5).textContent()
    const AuctionDate = await values.at(3).textContent()
    const AuctionDateResult = AuctionDate.replace('\n      ', '')
    if (SoldAmount != '-' && dateBetweenAugustAndNow(AuctionDateResult)) {
      const ParcelIDFolio = await values.at(1).textContent()
      const ParcelIDFolioResult = ParcelIDFolio.replace('\n      ', '')
      //search input
      const searchInput = await pageRegrid.locator('#glmap-search-query')
      await searchInput.fill(ParcelIDFolio)
      await pageRegrid.waitForSelector('.headline.parcel-result a', { state: 'visible' })

      //click on the link
      const links = await pageRegrid.locator('.headline.parcel-result a').all()
      await links.at(2).click()
      await pageRegrid.waitForSelector('h3.h4:visible:has-text("Property Details")');
      const Category = await values.at(2).textContent()

      //get address
      const address = await pageRegrid.locator('address').last().textContent()
      const addressSeparated = address.split(',')
      const city = addressSeparated.at(1).trim()
      const zip = addressSeparated.at(2).split(' ').at(2).trim()

      const auctionInfo = {
        'Auction Date': AuctionDateResult,
        'Parcel ID / Folio': ParcelIDFolioResult,
        'Openning Bid': await values.at(4).textContent(),
        'Sold Amount': SoldAmount,
        'Category': Category === 'No' ? 'House' : 'Lot',
        'Address' : address,
        'City' : city,
        'Zip' : zip,
      }

      arrayTosave.push(auctionInfo)
    }
  }

  nextButton = await page.locator('span:has-text("Next »")').all()
  await nextButton.at(0).click()
  await page.waitForLoadState('networkidle')// Wait until page is loaded
  isDisabled = await nextButton.at(0).locator('.disabled').isVisible()
}

arrayTosave.sort((a, b) => {
  const dateA = new Date(a['Auction Date']);
  const dateB = new Date(b['Auction Date']);

  return dateA.getTime() - dateB.getTime();
});

saveToExcel(arrayTosave)

await browser.close()