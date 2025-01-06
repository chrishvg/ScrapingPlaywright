import { chromium } from 'playwright'
import XLSX from 'xlsx'

function saveToExcel(data) {
  const date = new Date()
  const fileName = `clay_${date.getDate()}_${date.getMonth() + 1}_${date.getHours()}_${date.getMinutes()}.xlsx`
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data")

  XLSX.writeFile(workbook, fileName)
  console.log('Datos agregados correctamente al archivo ', fileName)
}

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
//await pageRegrid.waitForLoadState('networkidle')// Wait until page is loaded
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
await page.goto('https://clay.realtaxdeed.com/index.cfm?zaction=AUCTION&zmethod=PREVIEW&AuctionDate=11/06/2024')
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
const finalPage = await page.locator('#maxCA').textContent()
while (currentPage <= finalPage) {
  const auctions = await page.locator('.AUCTION_ITEM.PREVIEW').all()
  for (const auction of auctions) {
    const auctionStatus = await auction.locator('.AUCTION_STATS')
    const amountSold = await auctionStatus.locator('.ASTAT_MSGD.Astat_DATA').textContent()
    if (amountSold != '') {
      const auctionInfo = await auction.locator('.AUCTION_DETAILS')
      const table = await auctionInfo.locator('table.ad_tab')
      const rows = await table.locator('tbody tr').all()
      let ParcelIDFolio = ''
      let OpenningBid = ''
      let address = ''
      let city = ''
      let zip = ''
      let landSize = ''
      for (const row of rows) {
        const tHead = await row.locator('th').textContent()
        const tBody = await row.locator('td').textContent()
        if (tHead == 'Opening Bid:') {
          OpenningBid = tBody
        }
        if (tHead == 'Parcel ID:') {
          ParcelIDFolio = tBody.trim()
          
          if (invalidArray.includes(ParcelIDFolio)) {
            continue
          }
          //search input
          const searchInput = await pageRegrid.locator('#glmap-search-query')
          await searchInput.fill(ParcelIDFolio)
          try {
            await pageRegrid.waitForSelector('.headline.parcel-result a', { state: 'visible' })
            //click on the link
            const links = await pageRegrid.locator('.headline.parcel-result a').all()
            if (links.length <= 3) {
              await links.at(2).click()
              await pageRegrid.waitForSelector('span.conversion-value', { state: 'visible' })

              //get land size
              let measurements = await pageRegrid.locator('.conversion-value').allTextContents()
              landSize = measurements.at(0)

              //get address
              const addresses = await pageRegrid.locator('address').all()
              if (addresses.length > 0) {
                address = await pageRegrid.locator('address').last().textContent()
                const addressSeparated = address.split(',')
                city = addressSeparated.at(1)
                zip = addressSeparated.at(2).split(' ').at(2)
              }
            }
          } catch (error) {
            console.error('La etiqueta headline.parcel-result no fue encontrada:', error)
          }

        }
        if (tHead == 'Property Address:') {
          addressCalendar = tBody
        }
      }

      const auctionToSave = {
        'Auction Date': dateFormatted,
        'Parcel ID / Folio': ParcelIDFolio,
        'Openning Bid': OpenningBid,
        'Sold Amount': amountSold,
        'Lot Size (sqf)' : landSize,
        'Address' : address,
        'City' : city,
        'Zip' : zip
      }

      arrayTosave.push(auctionToSave)
    }
  }
  currentPage++
  const nextButton = await page.locator('.PageRight').all()
  await nextButton.at(nextButton.length - 1).click()
  await page.waitForLoadState('networkidle')// Wait until page is loaded
  await page.waitForTimeout(1000)
}
saveToExcel(arrayTosave)
await browser.close()