const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'], // helps low-RAM systems
  });

  const page = await browser.newPage();

  const url = 'https://search.perfectgame.org/?startDate=2026-01-31&sportType=All+Sports&endDate=2026-12-30&fbclid=IwY2xjawOARvZleHRuA2FlbQIxMABicmlkETFvVU94UmJzQzFRYTlUenZzc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHjf3_-XnmMhy2A9eXZrcuDWhZDz3y9k-73UuIPZcY0S0K23U6ooD2kfZX1b9_aem_L06rYl6jvTaB6nm1Qb1a1g&director=PG+SEC+Alabama,Jeff+Casteel,Donnie+Darby,Dee+Black';
  console.log(`Opening ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for table
  await page.waitForSelector('tbody.bg-white.divide-y', { timeout: 60000 });

  console.log('Scrolling to load all events…');

  let lastCount = 0;
  let sameCountTries = 0;

  while (sameCountTries < 3) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(1200);

    const rowCount = await page.evaluate(() =>
      document.querySelectorAll('tbody.bg-white.divide-y tr').length
    );

    if (rowCount === lastCount) {
      sameCountTries++;
    } else {
      sameCountTries = 0;
      lastCount = rowCount;
    }

    console.log(`Loaded rows: ${rowCount}`);
  }

  console.log('Extracting data…');

  const data = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tbody.bg-white.divide-y tr'))
      .map(row => {
        const getText = sel => row.querySelector(sel)?.innerText.trim() || '';

        const month = getText('td:nth-child(2) span');
        const day = getText('td:nth-child(2) div.text-md');
        const year = getText('td:nth-child(2) div.text-muted-foreground');

        return {
          date: `${month} ${day}, ${year}`,
          eventName: getText('td:nth-child(3) a'),
          eventURL: row.querySelector('td:nth-child(3) a')?.href || '',
          eventDesc: getText('td:nth-child(3) div.text-xs'),
          division: getText('td:nth-child(4) div.inline-flex'),
          teams: getText('td:nth-child(4) span'),
          location: getText('td:nth-child(5) div.text-xs'),
        };
      });
  });

  console.log(`Extracted ${data.length} events`);

  // Write CSV
  const header = Object.keys(data[0]).join(',');
  const rows = data.map(r =>
    Object.values(r)
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [header, ...rows].join('\n');
  const out = path.join(__dirname, 'pg_events.csv');
  fs.writeFileSync(out, csv);

  console.log(`Saved CSV → ${out}`);

  await browser.close();
})();
