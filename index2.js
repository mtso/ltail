import blessed from 'blessed';
import { Tail } from 'tail';
import clipboard from 'clipboardy';
import Database from 'better-sqlite3';

const db = new Database(':memory:');

initDb(db);

const filepath = process.argv[2];

const tail = new Tail(filepath, {
  fromBeginning: true,
  // nLines: 10,
})

const lines = [];
let query = '';

tail.on('line', (line) => {
  addLog(line);
  lines.push(line);
  renderScreen();
});

const screen = blessed.screen({
  smartCSR: true,
  dockBorders: true,
});

const list = blessed.list({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-1',
  items: lines,
  scrollable: true,
});

const box = blessed.box({
  bottom: 0,
  width: '100%',
  height: 1,
  content: '>',
  style: {
    hover: {
      bg: 'green',
    },
  },
});

screen.on('keypress', function(ch, key) {
  if (key.name === 'backspace') {
    query = query.substring(0, query.length - 1);
  } else if (key.name === 'up') {
  } else if (key.name === 'down') {
  } else if (key.full === 'C-t') {
    const logs = getLogs();
    console.log(logs)
  } else if (key.full === 'C-y') {
    const lineData = lines.map((l, i) => [i, l]);
    const pattern = getPattern(query);
    const filtered = lineData.filter(([, l]) => pattern.test(l));
    const text = filtered.map(([i, l]) => `${i} ${l}`).join('\n');
    clipboard.writeSync(text);
  } else if (ch && !key.ctrl) {
    query += ch;
  }

  // console.log(ch, JSON.stringify(key))
  renderScreen(); 
});

// Quit on Escape, q, or Control-C.
screen.key(['C-c'], function(ch, key) {
  return process.exit(0);
});

screen.append(list);

screen.append(box);

let lastValid = new RegExp(query);

renderScreen();

function renderScreen() {
  const lineData = lines.map((l, i) => [i, l]);
  const pattern = getPattern(query);
  const filtered = lineData.filter(([, l]) => pattern.test(l));
  const viewHeight = list.height;
  // const clipped = filtered.slice(filtered.length - viewHeight + 1)
  list.setItems(
    filtered.map(([i, l]) => `${i} ${l}`)
  );
  box.setContent('>' + query);
  list.scrollTo(filtered.length);
  // list.setScrollPerc('100%');
  screen.render();
};

function getPattern(query) {
  try {
    lastValid = new RegExp(query);
  } catch (err) {
  }
  return lastValid;
}

function addLog(log) {
  db.prepare(`INSERT INTO logs (timestamp, text) VALUES (?, ?)`).run(
    Date.now(),
    log
  )
}

function getLogs() {
  const results = db.prepare(`SELECT * FROM logs`).all();
  return results.map(r => ({
    ...r,
    ts: new Date(r.timestamp).toISOString(),
  }));
}

function initDb(db) {
  db.exec(`
    CREATE TABLE logs (id INTEGER PRIMARY KEY, timestamp INTEGER, text TEXT);
    CREATE VIRTUAL TABLE logs_fts USING fts5(text, log_id);
  `);
}
