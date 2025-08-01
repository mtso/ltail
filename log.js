import { faker } from "@faker-js/faker";
import capitalize from "capitalize";
import { basename } from "path";

const filepaths = Array(20).fill(0).map(() => faker.system.filePath());

const levels = ['DEBUG', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'ERROR', 'ERROR', 'ALERT'];

const serviceMethods = Array(20).fill(0).flatMap(() => {
  const noun = faker.word.noun();
  const service = capitalize(noun) + 'Service';
  const methods = [
    faker.hacker.verb().replaceAll(' ', '') + capitalize(noun),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(noun),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(noun),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(noun),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(faker.hacker.noun()),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(faker.hacker.noun()),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(faker.hacker.noun()),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(faker.hacker.noun()),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(faker.hacker.noun()),
    faker.hacker.verb().replaceAll(' ', '') + capitalize(faker.hacker.noun()),
  ];
  return methods.map((method) => service + '.' + method);
});

const formatTime = (date) => {
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
    timeZone: 'UTC',
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  return formatter.format(date);
}

const makeLog = () => {
  const now = new Date();
  const nowTime = formatTime(now);
  const level = levels[Math.floor(Math.random() * levels.length)];
  const metric = Math.floor(Math.random() * 5000) + 'ms';

  switch (level) {
    case 'INFO':
    case 'DEBUG':
      {
        const action = faker.hacker.ingverb();
        const serviceMethod = faker.helpers.arrayElement(serviceMethods);
        const adverb = faker.word.adverb();
        const extra = faker.datatype.boolean();
        let dataStr = '';
        if (extra) {
          const data = randomData(7);
          dataStr = indent(4, JSON.stringify(data, null, 2));
        }
        return `${level} ${nowTime} ${metric} ${action} ${serviceMethod}(...) ${adverb} ${dataStr}`;
      }
    case 'ERROR':
    case 'WARN':
    case 'ALERT':
      {
        const action = faker.hacker.ingverb();
        const serviceMethod = faker.helpers.arrayElement(serviceMethods);
        const data = randomData(7);
        const trace = randomTrace();
        const traceStr = indent(4, trace);
        const errorMessage = 'Error: ' + faker.hacker.phrase();
        return `${level} ${nowTime} ${metric} ${action} ${serviceMethod}\n    ${errorMessage}\n${traceStr}`;
      }
  }
}

const sleep = async (n) => new Promise((res) => setTimeout(() => res(), n));

const indent = (n, text) => {
  const dent = Array(n).fill(' ').join('');
  return text.split('\n').map((l) => dent + l).join('\n');
};

const randomData = (max) => {
  max = max ?? 5
  const obj = {}
  const numKeys = faker.number.int({ min: 1, max });
  const types = ['s', 's', 's', 'id', 'id', 'id', 'o'];
  for (let i = 0; i < numKeys; i++) {
    const type = faker.helpers.arrayElement(types);
    const key = faker.hacker.noun();
    if (type === 's') {
      obj[key] = faker.hacker.noun();
    } else if (type === 'id') {
      obj[key] = faker.string.uuid();
    } else {
      obj[key] = randomData(5);
    }
  }
  return obj;
};

const randomTrace = () => {
  const depth = faker.number.int({ min: 2, max: 10 });
  return Array(depth).fill(0).flatMap(() => {
    const filepath = faker.helpers.arrayElement(filepaths);
    const line = faker.number.int({ min: 1, max: 1500 });
    const col = faker.number.int({ min: 1, max: 120 });
    const serviceMethod = faker.helpers.arrayElement(serviceMethods);
    const method = serviceMethod.split('.')[1] ?? (faker.hacker.verb() + capitalize(faker.hacker.noun()));
    return [
      '- ' + basename(filepath) + ':' + line + ' ' + method,
      '    ' + filepath + ':' + line + ':' + col,
    ];
  }).join('\n');
}

;(async () => {
  while (true) {
    await sleep(Math.random() * 2000 + 200);
    const log = makeLog();
    console.log(log);
  }
})();
