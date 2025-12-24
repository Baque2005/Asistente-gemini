const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // O pon tu clave aquí directamente

async function testGemini() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: "¿Quién es Albert Einstein?" }] }
        ]
      })
    }
  );

  if (!response.ok) {
    console.error('Error HTTP:', response.status, await response.text());
    return;
  }

  const data = await response.json();
  console.log('Respuesta de Gemini:', JSON.stringify(data, null, 2));
}

testGemini();
