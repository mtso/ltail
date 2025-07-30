const blessed = require('blessed');
const readline = require('readline');

process.stdin.removeAllListeners('data');

const lines = [];
let query = '';

const rl = readline.createInterface({
  input: process.stdin,
  // output: process.stdout,
});

rl.on('line', (line) => {
  // console.log(`received line: ${line}`);
  lines.push(line);
  renderScreen();
});

rl.on('close', () => {{
  console.log('closed');
  process.exit(0);
}});

const screen = blessed.screen({
  smartCSR: true,
});

/*
screen.key([
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
], function(ch, key) {
  
});
*/

const list = blessed.list({
    top: 0,
    left: 0,
    bottom: -2,
    width: '100%',
    height: '90%',
    items: lines,

  border: {
    type: 'line'
  },
  });

const box = blessed.box({
  bottom: 0,
  width: '100%',
  height: 3,
  content: '> ',
  border: {
    type: 'line',
  },
  style: {
    hover: {
      bg: 'green',
    },
  },
});

box.key([
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
], function(ch, key) {
  query = query + ch;
  renderScreen();
});

box.key('delete', function(ch, key) {
  query = query.substring(0, query.length - 1);
});

screen.append(box);

screen.append(list);

function renderScreen() {
  //list.setItems(lines);
  list.setItems(
    lines.map((l, i) => `${i} ${l}`)
  );
  screen.render();
};

