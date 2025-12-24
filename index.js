function limpiarPregunta(texto) {
  // Elimina frases comunes de invocación
  return texto
    .replace(/^(pregúntale|pregunta|dile|di le|di a|dile a|hazle una pregunta) a asistente gemini( que)?/i, '')
    .trim();
}

const express = require('express');
const bodyParser = require('body-parser');
const Alexa = require('ask-sdk-core');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(bodyParser.json());

async function preguntarGemini(texto) {
  try {
    const prompt = `Responde de forma breve y clara: ${texto}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
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

let modoAsistenteVirtual = false;

const ActivarModoAsistenteVirtualIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ActivarModoAsistenteVirtualIntent';
  },
  handle(handlerInput) {
    modoAsistenteVirtual = true;
    return handlerInput.responseBuilder
      .speak('Modo asistente virtual activado. Puedes hacerme cualquier pregunta.')
      .reprompt('¿Sobre qué tema quieres preguntar?')
      .getResponse();
  }
};

const DesactivarModoAsistenteVirtualIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DesactivarModoAsistenteVirtualIntent';
  },
  handle(handlerInput) {
    modoAsistenteVirtual = false;
    return handlerInput.responseBuilder
      .speak('Modo asistente virtual desactivado. Si necesitas algo más, solo dímelo.')
      .getResponse();
  }
};

const PreguntarGeminiIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PreguntarGeminiIntent';
  },
  async handle(handlerInput) {

    console.log('Request completo:', JSON.stringify(handlerInput.requestEnvelope, null, 2));
    const textoOriginal = handlerInput.requestEnvelope.request.intent.slots.texto.value;
    const textoLimpio = limpiarPregunta(textoOriginal);
    console.log('Texto enviado a Gemini:', textoLimpio);
    const respuesta = await preguntarGemini(textoLimpio);

    return handlerInput.responseBuilder
      .speak(respuesta)
      .reprompt('¿Tienes otra pregunta?')
      .getResponse();
  }
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    modoAsistenteVirtual = true;
    return handlerInput.responseBuilder
      .speak('Hola Steven, soy tu asistente Gemini y el modo asistente virtual está activado. Puedes preguntarme lo que quieras. Cuando quieras salir, di: Alexa, desactiva el modo asistente virtual.')
      .reprompt('¿Sobre qué tema quieres preguntar?')
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
  async handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    console.log('Intent no manejado:', intentName);
    // Si el modo asistente virtual está activo, responde con Gemini
    if (modoAsistenteVirtual && handlerInput.requestEnvelope.request.type === 'IntentRequest') {
      let texto = '';
      // Intenta obtener el slot 'texto' si existe
      if (handlerInput.requestEnvelope.request.intent && handlerInput.requestEnvelope.request.intent.slots && handlerInput.requestEnvelope.request.intent.slots.texto && handlerInput.requestEnvelope.request.intent.slots.texto.value) {
        texto = handlerInput.requestEnvelope.request.intent.slots.texto.value;
      } else {
        // Si no hay slot, usa el nombre del intent como texto
        texto = intentName || 'pregunta';
      }
      const textoLimpio = limpiarPregunta(texto);
      const respuesta = await preguntarGemini(textoLimpio);
      return handlerInput.responseBuilder
        .speak(respuesta)
        .reprompt('¿Tienes otra pregunta?')
        .getResponse();
    }
    // Si no está activo, responde por defecto
    return handlerInput.responseBuilder
      .speak('Lo siento, no pude entender eso. ¿Puedes intentarlo de nuevo?')
      .reprompt('Por favor, intenta decirlo de otra forma.')
      .getResponse();
  }
};




const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ActivarModoAsistenteVirtualIntentHandler,
    DesactivarModoAsistenteVirtualIntentHandler,
    PreguntarGeminiIntentHandler,
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
