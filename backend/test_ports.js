const http = require('http');

const ports = [
  44456, 49561, 49670, 49809, 49810, 49813, 49816, 49841,
  52289, 52670, 56223, 56224, 56227, 56228, 59135, 61529,
  61536, 63168, 63712
];

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 1000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          port,
          status: res.statusCode,
          headers: res.headers,
          snippet: body.substring(0, 100).replace(/\r?\n/g, ' ')
        });
      });
    });
    req.on('error', (err) => {
      resolve({ port, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ port, error: 'timeout' });
    });
  });
}

async function run() {
  console.log('Probing ports...');
  const results = [];
  for (const port of ports) {
    const res = await checkPort(port);
    if (!res.error) {
      results.push(res);
    }
  }
  console.table(results);
  process.exit(0);
}

run();
