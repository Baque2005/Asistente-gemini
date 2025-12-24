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
    return 'Lo siento, tuve un problema consultando a Gemini. ¿Tienes otra pregunta?';
  }
}



const ActivarModoAsistenteVirtualIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ActivarModoAsistenteVirtualIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.modoAsistenteVirtual = true;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
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
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.modoAsistenteVirtual = false;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
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
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.modoAsistenteVirtual = true; // Si pregunta, se mantiene activo
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

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
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.modoAsistenteVirtual = true;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    return handlerInput.responseBuilder
      .speak('Hola Steven, soy tu asistente Gemini y el modo asistente virtual está activado.')
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
    // Si la sesión termina inesperadamente, invita a seguir preguntando
    return handlerInput.responseBuilder
      .speak('¿Tienes otra pregunta?')
      .reprompt('¿Tienes otra pregunta?')
      .getResponse();
  }
};


const UnhandledIntentHandler = {
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const modoAsistenteVirtual = sessionAttributes.modoAsistenteVirtual;
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
      .speak('Lo siento, no pude entender eso. ¿Tienes otra pregunta?')
      .reprompt('¿Tienes otra pregunta?')
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
