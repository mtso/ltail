import blessed from 'blessed';
import { Tail } from 'tail';
import clipboard from 'clipboardy';
import Database from 'better-sqlite3';

const state = {
  mode: 'nav', // or 'search'
};

const dbname = 'logtail' + Date.now();
// const db = new Database(':memory:');
const db = new Database('/tmp/' + dbname);

initDb(db);

const filepath = process.argv[2];

const tail = new Tail(filepath, {
  // fromBeginning: true,
  nLines: 100,
});

const lines = [];
let query = '';

let shouldRender = false;

// // Delay rendering until initialization has had some time to process
// setTimeout(() => {
//   shouldRender = true;
// }, 500);

tail.on('line', (line) => {
  putLogs([processLogText(line)]);
  renderScreen();
});

function processLogText(logText) {
  return {
    timestamp: Date.now(),
    text: logText,
  };
}

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
  content: '/█',
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
  const logs = searchLogs(query);
  list.setItems(logs.map((l) => l.text));
  box.setContent(logs.length + ' /' + query + '█');
  list.scrollTo(logs.length);
  screen.render();
};

function getPattern(query) {
  try {
    lastValid = new RegExp(query);
    return { pattern: lastValid, valid: true, query };
  } catch (error) {
    return { pattern: lastValid, valid: false, error, query };
  }
}

function putLogs(logs) {
  const insert = db.prepare('INSERT INTO logs (timestamp, text) VALUES (:timestamp, :text)');
  const insertFts = db.prepare('INSERT INTO logs_fts (text, log_id) VALUES (:text, :logId)');
  const insertMany = db.transaction((logs) => {
    for (const log of logs) {
      const info = insert.run(log);
      insertFts.run({
        text: log.text,
        logId: info.lastInsertRowid,
      });
    }
  });
  return insertMany(logs);

//   INSERT INTO 'tablename'
//           SELECT 'data1' AS 'column1', 'data2' AS 'column2'
// UNION ALL SELECT 'data1', 'data2'
// UNION ALL SELECT 'data1', 'data2'
// UNION ALL SELECT 'data1', 'data2'
}

function deleteLogs(before) {
  const select = db.prepare('SELECT id, timestamp FROM logs WHERE id < :before');
  const logs = select.run({ before });
  const deleteLogs = db.prepare('DELETE FROM logs WHERE id IN :logIds');
  const deleteLogsFts = db.prepare('DELETE FROM logs_fts WHERE log_id IN :logIds');
  const deleteLogIds = db.transaction((logs) => {
    const logIds = logs.map((l) => l.id);
    deleteLogs.run({ logIds });
    deleteLogsFts.run({ logIds });
  });
  return deleteLogIds(logs);
}

function getLogs() {
  const results = db.prepare(`SELECT * FROM logs ORDER BY timestamp ASC`).all();
  return results.map(r => ({
    ...r,
    ts: new Date(r.timestamp).toISOString(),
  }));
}

function searchLogs(term) {
  if (term === '') {
    return getLogs();
  }
  const search = db.prepare(`SELECT l.id, l.timestamp, l.text
    FROM logs_fts fts
    JOIN logs l ON l.id = fts.log_id
    WHERE fts.text MATCH :term
    ORDER BY l.timestamp ASC`);
  try {
    const logs = search.all({ term });
    return logs;
  } catch (err) {
    return getLogs();
  }
}

function initDb(db) {
  db.exec(`
    CREATE TABLE logs (id INTEGER PRIMARY KEY, timestamp INTEGER, text TEXT);
    CREATE VIRTUAL TABLE logs_fts USING fts5(text, log_id);
  `);
}
