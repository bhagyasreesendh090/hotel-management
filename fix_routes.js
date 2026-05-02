const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('title="Generate Contract"')) {
      // Look back a few lines to find the navigate call
      for (let j = i - 1; j >= i - 5; j--) {
        if (lines[j].includes('navigate(`/crm/quotes/new?')) {
          lines[j] = lines[j].replace('/crm/quotes/new?', '/crm/contracts/new?');
          console.log(`Replaced in ${filePath} at line ${j + 1}`);
          break;
        }
      }
    }
  }
  fs.writeFileSync(filePath, lines.join('\n'));
}

fixFile('frontend/src/app/pages/banquet/BanquetBookingsPage.tsx');
fixFile('frontend/src/app/pages/crs/BookingsPage.tsx');

console.log('Done!');
