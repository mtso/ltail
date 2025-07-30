const fs = require('fs');
const readline = require('readline');

const filepath = process.argv[2];

const rs = fs.createReadStream(filepath, {
  encoding: 'utf8',
  end: Number.MAX_SAFE_INTEGER,
});

const rl = readline.createInterface({
  input: rs,
  end: false,
  terminal: true,
});

let i = 0;
rl.on('line', (line) => {
  console.log(`${i++} ${line}`);
});

rs.on('end', () => {
  console.log('continue');
});

/*
rl.on('close', () => {
  console.log('continuing');
});
*/



