const { sendVerificationEmail } = require('./controllers/authController');

async function test() {
  const req = { body: { email: 'test.dravyantra@yopmail.com' } };
  const res = {
    status: (code) => ({
      json: (data) => console.log(`Response ${code}:`, data)
    })
  };
  await sendVerificationEmail(req, res);
  process.exit(0);
}

test();
