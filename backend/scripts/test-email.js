import fs from 'fs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/hotel management/pramodhotels/backend/.env' });

const token = jwt.sign({ sub: 1 }, process.env.JWT_SECRET || 'change-me-to-a-long-random-string', { expiresIn: '1h' });

async function testApi() {
  console.log("Token:", token);
  try {
    const res = await fetch('http://localhost:4000/api/crm/contracts/1/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to_email: 'test@example.com',
        cc_email: '',
        subject: 'Test',
        body: 'Test body'
      })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

testApi();
