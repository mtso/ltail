import blessed from 'blessed';
import { Tail } from 'tail';
import clipboard from 'clipboardy';
import Database from 'better-sqlite3';

const MODE_NAV = 'nav';
const MODE_SEARCH = 'search';

const state = {
  mode: MODE_NAV, // or MODE_SEARCH
  lastLogResults: [],
  error: null,
  cursor: null,
};

const dbname = 'logtail' + Date.now();
const db = new Database('/tmp/' + dbname);

initDb(db);

const flags = process.argv.filter((arg) => arg.startsWith('-'));
const nonFlags = process.argv.filter((arg) => !arg.startsWith('-'));
const filepath = nonFlags[2];

const fromBeginning = flags.includes('--from-beginning');
const nLinesOption = flags.find((f) => f.startsWith('--lines='));

const tail = new Tail(filepath, {
  // TODO: if fromBeginning is true, then process asynchronously to avoid blocking rendering
  fromBeginning,
  nLines: nLinesOption ? +nLinesOption.replace('--lines=', '') : 100,
});

const lines = [];
let query = '';

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
  content: '',
  style: {
    hover: {
      bg: 'green',
    },
  },
});

screen.on('keypress', function(ch, key) {
  if (key.name === 'escape') {
    if (state.mode !== MODE_NAV) {
      state.mode = MODE_NAV;

      // TODO: Save state.cursor based on the query
      const { logs } = getLogs(query);
      if (state.cursor != null && logs.length < state.cursor) {
        state.cursor = null;
      }
    }
  } else if (state.mode === MODE_NAV) {
    handleNavMode(ch, key);
  } else if (state.mode === MODE_SEARCH) {
    handleSearchMode(ch, key);
  }

  // console.log(ch, JSON.stringify(key))
  renderScreen(); 
});

function handleNavMode(ch, key) {
  // Scroll
  if (key.name === 'up' || (key.name === 'k' && !key.ctrl)) {
    if (state.cursor == null) {
      const { logs } = getLogs();
      state.cursor = Math.max(0, logs.length - 1);
    } else {
      state.cursor = Math.max(0, state.cursor - 1);
    }
  } else if (key.name === 'down' || (key.name === 'j' && !key.ctrl)) {
    const { logs } = getLogs();
    if (state.cursor != null && state.cursor === logs.length - 1) {
      state.cursor = null;
    } else if (state.cursor != null) {
      state.cursor += 1;
    }
  // Jump to top
  } else if (ch === 'g' && !key.shift && !key.ctrl && key.name === 'g') {
    state.cursor = 0;
  // Jump to bottom
  } else if (ch === 'G' && key.shift) {
    state.cursor = null;
  // Test
  } else if (key.full === 'C-t') {
    const logs = getLogs();
    console.log(logs);
  // Export buffer to clipboard
  } else if (key.full === 'C-y') {
    const { logs } = getLogs(query);
    const text = logs.map(({ text }) => `${text}`).join('\n');
    clipboard.writeSync(text);
  } else if (ch === '/' && !key.ctrl) {
    state.mode = MODE_SEARCH;
  } else if (ch === 'i' && !key.ctrl) {
    state.mode = MODE_SEARCH;
  // Debugging
  // } else if (ch && !key.ctrl) {
  //   // 'a', { sequence: 'a', name: 'a', ctrl: false, meta: false, shift: false, full: 'a' }
  //   console.log(ch, key)
  }
}

function handleSearchMode(ch, key) {
  if (key.name === 'backspace') {
    query = query.substring(0, query.length - 1);
  } else if (key.name === 'enter') {
  } else if (key.name === 'return') {
  } else if (ch && !key.ctrl) {
    query += ch;
  }
}

// Quit on Escape, q, or Control-C.
screen.key(['C-c'], function(ch, key) {
  return process.exit(0);
});

screen.append(list);

screen.append(box);

let lastValid = new RegExp(query);

renderScreen();

function renderScreen() {
  const { logs, error } = getLogs(query);
  list.setItems(logs.map((l) => l.text));

  const place = (state.cursor ?? logs.length) + '/' + logs.length;
  if (state.mode === MODE_SEARCH) {
    if (error) {
      box.setContent(place + ' !' + query + '█');
    } else if (state.mode === MODE_SEARCH) {
      box.setContent(place + ' /' + query + '█');
    }
  } else {
    if (query === '') {
      box.setContent(place + '');
    } else {
      box.setContent(place + ' /' + query);
    }
  }
  list.scrollTo(state.cursor ?? logs.length);
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

function getLogs(query) {
  if (query === '') {
    const logs = getAllLogs();
    state.lastLogResults = logs;
    state.error = null;
    return { logs, query };
  }

  try {
    const logs = searchLogs(query);
    state.lastLogResults = logs;
    state.error = null;
    return {
      logs,
      query,
    }
  } catch (error) {
    state.error = error;
    return {
      logs: state.lastLogResults,
      error,
      query,
    }
  }
}

function getAllLogs() {
  const results = db.prepare(`SELECT * FROM logs ORDER BY timestamp ASC`).all();
  return results.map(r => ({
    ...r,
    ts: new Date(r.timestamp).toISOString(),
  }));
}

function searchLogs(query) {
  const search = db.prepare(`SELECT l.id, l.timestamp, l.text
    FROM logs_fts fts
    JOIN logs l ON l.id = fts.log_id
    WHERE fts.text MATCH :query
    ORDER BY l.timestamp ASC`);
  return search.all({ query });
}

function initDb(db) {
  db.exec(`
    CREATE TABLE logs (id INTEGER PRIMARY KEY, timestamp INTEGER, text TEXT);
    CREATE VIRTUAL TABLE logs_fts USING fts5(text, log_id, tokenize="trigram");
  `);
}
