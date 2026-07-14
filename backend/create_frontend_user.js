const https = require('https');

const API_KEY = 'AIzaSyDixdqLoGuiOH7lsBMD6hYEUcRIpPzRaao';

const data = JSON.stringify({
  email: 'dravyantra.pathvision@gmail.com',
  password: 'dravyantrapv@2025',
  returnSecureToken: true
});

const options = {
  hostname: 'identitytoolkit.googleapis.com',
  path: `/v1/accounts:signUp?key=${API_KEY}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
