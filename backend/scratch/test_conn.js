const axios = require('axios');

async function testEndpoints() {
  try {
    const localRes = await axios.get('http://localhost:3000/health').catch(e => e.message);
    console.log('Local backend health:', localRes.status || localRes);
  } catch (err) {
    console.log('Local backend error:', err.message);
  }

  try {
    const remoteRes = await axios.get('https://16-112-99-7.nip.io/health').catch(e => e.message);
    console.log('Remote backend health:', remoteRes.status || remoteRes);
  } catch (err) {
    console.log('Remote backend error:', err.message);
  }

  process.exit(0);
}

testEndpoints();
