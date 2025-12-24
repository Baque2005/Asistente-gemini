const express = require('express');
const bodyParser = require('body-parser');
const Alexa = require('ask-sdk-core');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(bodyParser.json());

async function preguntarGemini(texto) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: texto }] }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error en Gemini API:', error);
    return 'Lo siento, tuve un problema consultando a Gemini. Intenta de nuevo más tarde.';
  }
}

const PreguntarGeminiIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PreguntarGeminiIntent';
  },
  async handle(handlerInput) {
    const texto = handlerInput.requestEnvelope.request.intent.slots.texto.value;
    const respuesta = await preguntarGemini(texto);

    return handlerInput.responseBuilder
      .speak(respuesta)
      .getResponse();
  }
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Hola, pregúntame lo que quieras.')
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

const UnhandledIntentHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    console.log('Intent no manejado:', Alexa.getIntentName(handlerInput.requestEnvelope));
    return handlerInput.responseBuilder
      .speak('Lo siento, no pude entender eso. ¿Puedes intentarlo de nuevo?')
      .reprompt('Por favor, intenta decirlo de otra forma.')
      .getResponse();
  }
};


const HelloWorldIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
  },
  async handle(handlerInput) {
    // Intentar obtener el slot 'texto' si existe, si no, usar un texto por defecto
    let texto = '';
    try {
      texto = handlerInput.requestEnvelope.request.intent.slots.texto.value;
    } catch (e) {
      texto = 'Hola, ¿cómo puedes ayudarme?';
    }
    const respuesta = await preguntarGemini(texto);
    return handlerInput.responseBuilder
      .speak(respuesta)
      .getResponse();
  }
};

const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    PreguntarGeminiIntentHandler,
    HelloWorldIntentHandler,
    SessionEndedRequestHandler,
    UnhandledIntentHandler
  )
  .create();

app.post('/alexa', async (req, res) => {
  try {
    const responseEnvelope = await skill.invoke(req.body);
    res.json(responseEnvelope);
  } catch (error) {
    console.error('Error al procesar la petición Alexa:', error);
    res.status(500).send('Error interno del servidor');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
