// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

const coverageSummary = JSON.parse(fs.readFileSync('./coverage/coverage-summary.json', 'utf8'));

const args = process.argv.slice(2);
if (args.length) {
  switch (args[0]) {
    case 'line':
      console.log(coverageSummary.total.lines.pct);
      break;
    case 'statement':
      console.log(coverageSummary.total.statements.pct);
      break;
    case 'branch':
      console.log(coverageSummary.total.branches.pct);
      break;
    case 'function':
      console.log(coverageSummary.total.functions.pct);
      break;
    default:
      console.log('Invalid argument');
  }
}
