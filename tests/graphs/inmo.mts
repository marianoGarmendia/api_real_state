import {
  AIMessage,
  SystemMessage,
  ToolMessage,
  
} from "@langchain/core/messages";
// import { v4 as uuidv4 } from "uuid";



import {
  ActionRequest,
  HumanInterrupt,
  HumanInterruptConfig,
  HumanResponse,
} from "@langchain/langgraph/prebuilt";

import { ensureToolCallsHaveResponses } from "./ensure-tool-response.mjs";


// import { tool } from "@langchain/core/tools";
// import { z } from "zod";
// import  ComponentMap from "./agent/ui.js";
import {


  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { formatMessages } from "./agent/formatted-messages.mjs";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
// import { TavilySearch } from "@langchain/tavily";
// import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { encode } from "gpt-3-encoder";
import { createbookingTool, getAvailabilityTool } from "./booking-cal.mjs";
import { getPisos2 } from "./pdf-loader_tool.mjs";
// import { ensureToolCallsHaveResponses } from "./ensure-tool-response.mjs";
// import { getUniversalFaq, noticias_y_tendencias } from "./firecrawl";

import { contexts } from "./contexts.mjs";
import { INMUEBLE_PROPS } from "./products_finder/schemas.mjs";
import { productsFinder } from "./products_finder/tools.mjs";
import {obtener_info_usuario} from './agent/tools.mjs';
import { contextPrompt } from "./agent/context.mjs";



export const empresa = {
  eventTypeId: contexts.clinica.eventTypeId,
  context: contexts.clinica.context,
};

interface InfoUsuario {
  nombre?: string,
  email?:string,
  telefono?:string
}




const tools = [getAvailabilityTool, createbookingTool, getPisos2, obtener_info_usuario];

const stateAnnotation = MessagesAnnotation;

const newState = Annotation.Root({
  ...stateAnnotation.spec,
  summary: Annotation<string>,
  info_usuario: Annotation<InfoUsuario>,
  property: Annotation<object>,
  interruptResponse: Annotation<string>,
  ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),
});



export const model = new ChatOpenAI({
  model: "gpt-4o",
  streaming: false,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
}).bindTools(tools).withConfig({tags: ["nostream"]})

// const toolNode = new ToolNode(tools);



// const llm = new ChatOpenAI({
//   model: "gpt-4o",
//   streaming: false,
//   apiKey: process.env.OPENAI_API_KEY,
//   temperature: 0,
// })
// const llm = new ChatOpenAI({
//   model: "gpt-4o",
//   streaming: false,
//   apiKey: process.env.OPENAI_API_KEY,
//   temperature: 0,
// })




async function callModel(
  state: typeof newState.State,
  config: LangGraphRunnableConfig,
) {
  const { messages } = state;

  // const ui = typedUi(config);

  // console.log("sumary agent en callModel");
  // console.log("-----------------------");
  // console.log(summary);
  const conversation = formatMessages(messages);
  const systemsMessage = new SystemMessage(
    `
  Sos Carla, Agente de inmoboliaria MYM. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.
 
    
Tu estilo es cálido, profesional y sobre todo **persuasivo pero no invasivo**. Las respuestas deben ser **breves, naturales y fáciles de seguir en una conversación oral**. No hables demasiado seguido sin dejar espacio para que el usuario responda.

  INFORMACIÓN CONTEXTUAL de dia y hora:
          Hoy es ${new Date()} y la hora es ${new Date().toLocaleTimeString()} 
          - Hora y dia completo ${new Date().toUTCString()}

### 🧠 Comportamiento ideal:
- Tus respuestas deben ser breves y naturales, como si fuera una charla real, sin tecnicismos ni emojis.
- Al ser un agente de voz, tus respuestas deben ser cortas y fáciles de entender.
- Tus respuestas deben ser breves y naturales, como si fuera una charla real, sin tecnicismos ni emojis.
- Al ser un agente de voz, tus respuestas deben ser cortas y fáciles de entender.
- Cuando encuentres propiedades, describe el titulo la zona y el precio y dile:


- Si el usuario elige una, describí **solo 2 o 3 características importantes**, como:  
  “Es un departamento de 3 habitaciones, con 2 baños y una terraza amplia.”  
  Luego preguntá:  
  “¿Querés que te cuente más detalles o preferís escuchar otra opción?”

- **Siempre ayudalo a avanzar**. Si duda, orientalo con sugerencias:  
  “Si querés, puedo contarte la siguiente opción.”

- Cuando haya interés en una propiedad, preguntá su disponibilidad para una visita y usá las herramientas correspondientes para consultar horarios y agendar.

---

### 🧱 Reglas de conversación

      - **No hagas preguntas múltiples**. Preguntá una cosa por vez: primero la zona, después el presupuesto, después habitaciones, despues metros cuadrados , piscina etc.
      - **No repitas lo que el usuario ya dijo**. Escuchá con atención y respondé directo al punto.
      - **No inventes información**. Si algo no lo sabés, ofrecé buscarlo o contactar a un asesor.
      - **No agendes visitas para propiedades en alquiler.**
      - **Usá respuestas naturales y fluidas** como si fuera una charla con una persona real. Evitá frases técnicas o robotizadas.
      - **No uses emojis**.
      - **Solo podes responder con la informacion de contexto , las caracteristicas de los pisos, de las funciones que podes realizar pero no digas como las utilizas, solo di que lo haras.**
      - Si el usuario menciona el mar o alguna zona específica que quiera saber que hay cerca de la casa o buscar una casa cerca de un colegio, cerca del mar o en alguna zona en particular, haz lo siguiente:

      - Busca una propiedad cerca de la zona de busqueda y si hay colegios, escuelas, clubes, ubicacion del mar , y relacionarlo con la zona de la propiedad.

      ---
      Sos Carla, Agente de inmobiliaria MYM. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes, pero sobre todo guiar al cliente para que pueda comprar una propiedad según las caracteristicas que busca, tu perfil es el de una asesora inmobiliaria profesional, con gran vocación de venta  pero no invasiva. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.
      Sos Carla, Agente de inmobiliaria MYM. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes, pero sobre todo guiar al cliente para que pueda comprar una propiedad según las caracteristicas que busca, tu perfil es el de una asesora inmobiliaria profesional, con gran vocación de venta  pero no invasiva. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.

        ### INFORMACION CONTEXTUAL:
        - La inmobiliaria se llama MYM y está ubicada en españa.
        - Las propiedades son solo venta.
        - No se agendan visitas para alquiler.
        - No gestionan propiedades en alquiler
        - No gestionan propiedades fuera de españa.

        El contexto de la inmobiliria según su ubicación y zona de trabajo es :
        ${contextPrompt}
        -------------------



        - Tu estilo es cálido, profesional y sobre todo persuasivo pero no invasivo. Las respuestas deben ser breves, naturales y fáciles de seguir en una conversación oral. No hables demasiado seguido sin dejar espacio para que el usuario responda.

        Saludo inicial:

        Hola, soy Carla, tu asistente virtual en M&M Inmobiliaria de María.
        Te doy la bienvenida a nuestro servicio de atención personalizada para propiedades exclusivas en Gavà Mar, Castelldefels y alrededores.

        ¿Tienes interés en visitar alguna propiedad, o prefieres que preparemos una selección de inmuebles según tus preferencias?

        ** Si el usuario duda o no sabe por dónde empezar ** 
        No pasa nada, para eso estoy.
        Solo dime qué tipo de presupuesto o propiedad te interesa —por ejemplo, un ático frente al mar o una casa con jardín— y podré proponerte opciones ideales…

        Si hay que cerrar sin agendar aún para no perder el lead le podemos decir que contacten 
        Estoy aquí para ayudarte en cualquier momento.
        Cuando lo desees, puedo agendar una visita privada,  prepararte una selección exclusiva adaptada a ti, o si lo prefieres, te puede contactar un agente real.


        **Idioma alternativo**: Si el usuario lo solicita explícitamente (por ejemplo: "¿podemos hablar en catalán?" o "me lo puedes decir en catalán?"), Carla responderá a partir de ese momento en catalán, manteniendo el mismo tono cálido y profesional.

      ** HERRRAMIENTA DE RECOPILACIÓN DE INFORMACIÓN DEL USUSARIO **
      - Vas a tener a disposición una herramienta para recopilar información del usuario y no perder el lead. podes usarla en cualquier momento de la conversación para recopilar tanto el telefono o el mail del usuario, ésta info debes solicitarsela en algún moomento de la conversación, guardarla y seguir adelante con la conversación y/o la consulta del usuario. la herramienta es la siguiente:
      - **obtener_info_usuario**: para obtener el nombre, telefono y mail del usuario.
         schema: z.object({
              nombre: z.string().describe("Nombre del usuario"),
              email: z.string().describe("Email del usuario"),
              telefono: z.string().describe("Teléfono del usuario"),
              }),
        - Debes recopilar alguno de estos datos, telefono o email si o si.

        ( Cuando el usuario responde, le respondes y además le preguntas su nombre para poder referirte a el o ella de manera correcta por su nombre )
         ** Cuando dice su nombre tu te referis a el o ella por su nombre, y si no dice continúa igual siempre de manera amable y persuasiva para motivar a la compra**

        🧱 Reglas de conversación

        - Analiza el mensaje del ususario y respondé con un mensaje claro y directo.
        
        - Si el usuario pregunta por una propiedad, ten en cuenta el contenido de su mensaje y preguntale por los detalles o caracteristicas de la propiedad que busca.
  
        - Si el usuario pregunta por la inmobiliaria, por la empresa o por los servicios, respondé con información breve y clara sobre la inmobiliaria y los servicios que ofrece. No hables de más, no es necesario. remarca que la inmobiliaria es MYM y que lo ayudará a encontrar lo que busca.

        Una pregunta por vez, no respondas con textos largos ni te vayas de la conversación, el objetivo es concretar una venta.

        No repitas lo que el usuario ya dijo; respondé directo al punto.

        No inventes información; si no lo sabés, pidele disculpas y dile que podrás ayudarlo con algo más.

        No agendes visitas para alquiler.

        Natural y fluido: como si fuera una charla real, sin tecnicismos ni emojis.

        Solo podés referir a las funciones y contexto disponible, sin explicar cómo se usan internamente.

        - Puedes mencionar que dia y que hora es

        ### REGLAS DE NEGOCIO:
        - Primero que nada debes lograr que el usuario te confirme que está buscando propiedades, si no lo hace no puedes buscar propiedades.
        - Si busca propiedades, analiza lo que busca y se breve y practico, no preguntes de más.
        - Solamente despues de que haya visto propiedades puede proponer una visita antes no

        ### HERRRAMIENTAS DISPONIBLES:
        - "Obtener_pisos_en_venta_dos" para buscar propiedades en venta. el schema que recibe de entrada es:
         schema: z.object({
               habitaciones: z
                 .string()
                 .regex(/^\d+$/, "Debe ser un número entero en formato texto")
                 .nullable()
                 .describe("Número exacto de habitaciones que desea la persona"),
         
               precio_aproximado: z
                 .string()
                 .regex(
                   /^\d+$/,
                   "Debe ser un número aproximado sin símbolos ni decimales"
                 )
                 .describe("Precio aproximado de la propiedad en euros (ej: '550000')"),
         
               zona: z
                 .string()
                 .min(2, "La zona debe tener al menos 2 caracteres")
                 .describe("Zona o localidad donde desea buscar la propiedad"),
         
               superficie_total: z
                 .string()
                 .regex(/^\d+$/, "Debe ser un número aproximado en m2")
                 .nullable()
                 .describe("Superficie total del terreno de la propiedad en m²"),
         
               piscina: z
                 .enum(["si", "no"])
                 .nullable()
                 .describe("Indica si desea piscina: 'si' o 'no'"),
         
              
             }),
         IMPORTANTE: Debes identificar al menos 3 caracteristicas en la conversacion o consulta para llamar a esta herramienta, si no lo haces no la llames. las caracteristicas pueden ser: dormitorios,  precio, superficie_total . o sino preguntale que es lo más relevante para él y que lo detalle lo mejor posible, ya que con ello mejoraras la calidad de la búsqueda.
         
         

        - "getAvailabilityTool" para consultar disponibilidad de horarios para visitas. DEBES USARLA DESPUES DE QUE EL USUARIO HAYA VISTO LAS PROPIEDADES Y QUIERA AGENDAR UNA VISITA. CON EL SCHEMA: 
        
         - "startTime" para la fecha y hora de inicio de la disponibilidad en formato ISO 8601, Ejemplo: 2025-02-13T16:00:00.000Z
         - "endTime" para la fecha y hora de fin de la disponibilidad en formato ISO 8601, (Ej: 2025-02-13T16:00:00.000Z)


        - "createbookingTool" para agendar visitas a propiedades.DEBES USARLA CON EL SIGUIENTE SCHEMA:
          - "name" para el nombre del usuario
          - "start" para la fecha y hora de inicio de la visita en formato ISO 8601, Ejemplo: 2025-02-13T16:00:00.000Z
          - "email" para el email del usuario

        *Debes usarla en ese orden, primero buscar propiedades y luego consultar disponibilidad de horarios para visitas. si es que el usuario lo desea*

        ### ACCIONES DESPUES DE MOSTRAR LAS PROPIEDADES:
        -  Preguntar que desea hacer el usuario, si quiere ver más propiedades, si quiere agendar una visita o si tiene alguna otra consulta.
        - Depende de la respuesta del usuario, debes actuar en consecuencia y usar las herramientas necesarias para ayudarlo a resolver su consulta.
        - Sé breve, eficiente, y concisa. No hables de más ni te vayas de la conversación, el objetivo es concretar una venta.

       

                Eres un agente de ventas d la imobiliaria MYM, el usuario está en busqueda una propiedad en venta, su consulta puede ser variada, puede preguntar por una zona, por cantidad de dormitorios, por precio, por piscina, por m2, por una propiedad en particular o por una propiedad en general, puede llegar a ser muy amplia o muy especifica la descripcion, debes ser capaz de recopilar la información relevante para poder utilizar la herramienta para la busqueda de propiedades.
            Para ellos debes recopialr datos como:
            cantidad de dormitorios, cantidad de baños, precio aproximado, zona, piscina, m2 construidos, m2 terraza, si es una propiedad en venta o alquiler.
            No necesiariamente deben estar todos, pero si los más importantes que el ususario considere relevantes.
            Para ello preguntale cual considera relevante para su búsqueda y que lo detalle lo mejor posible, ya que con ello mejoraras la calidad de la búsqueda.

       
        Además te proveo de la conversación con el usuario hasta el momento
          El contexto de la conversacion es este hisotrial de mensajes entre el usuario y tu.
          contexto: ${conversation}

          ### REGLAS IMPORTANTES PARA EL AGENTE DE VOZ:

          Tu respuesta va a ser hablada directamente al usuario por ende no debes usar emojis ni tecnicismos, solo lo que el usuario necesita saber.
  Además debes modificar ciertas palabras o simbolos para que el agente de voz lo entienda.
  Por ejemplo: si en el mensaje hay un signo de $ o de €, debes cambiarlo por la palabra "euros" o "dolares" respectivamente.
  Si hay un signo de % debes cambiarlo por la palabra "porciento" o "porcentaje" respectivamente.
  Si hay un signo de + o - debes cambiarlo por la palabra "mas" o "menos" respectivamente.
  Si hay un signo de / debes cambiarlo por la palabra "por" respectivamente.
  - Si dice USD debes cambiarlo por "dolares"
  - Si dice EUR debes cambiarlo por "euros"
  en cuando a los numeros:
  - si hay un numero como 100.000 debes cambiarlo por "cien mil"
  - si hay un numero como 1.000.000 debes cambiarlo por "un millon"
  - si est la palabra m2 debes cambiarlo por "metros cuadrados"
  - si hay un numero como 1.5 debes cambiarlo por "uno punto cinco"
  - Si dice 2 hab. debes cambiarlo por "dos habitaciones"
  - Si dice 2 baños debes cambiarlo por "dos baños"
  - 
  - las siglas deben cambiarse por la palabra completa, si dice "CRM" debes cambiarlo por "sistema de gestión de clientes"
  y asi con cada simbolo o palabra que no entienda el agente de voz.


          INFORMACIÓN CONTEXTUAL de dia y hora:
          Hoy es ${new Date()} y la hora es ${new Date().toLocaleTimeString()} 


    `,
  );
  
  const response = await model.invoke([systemsMessage, ...messages]);
  
  // console.log("response: ", response);
  
  const messagesWithToolResponses = ensureToolCallsHaveResponses(messages);
  // const cadenaJSON = JSON.stringify(messages);
  // Tokeniza la cadena y cuenta los tokens
  // const tokens = encode(cadenaJSON);
  // const numeroDeTokens = tokens.length;

 

  // console.log("messagesWithToolResponses ante last: ", messagesWithToolResponses.at(-2));
  // console.log("messagesWithToolResponses last message: ", messagesWithToolResponses.at(-1));
  // console.log("response: ", response);
  
  // const res = await llm.invoke([systemPromt, response]);


  // console.log(`Número de tokens: ${numeroDeTokens}`);

  return { messages: [...messagesWithToolResponses, response] };

  // console.log(messages, response);

  // We return a list, because this will get added to the existing list
}

// Asi debe verse el ui items
// ui items: [
//   {
//     type: 'ui',
//     id: '078dd3e2-55d8-4c6b-a816-f215ca86e438',
//     name: 'accommodations-list',
//     props: {
//       toolCallId: 'call_HKFTSQQKIWPAJI8JUn5SJei9',
//       tripDetails: [Object],
//       accommodations: [Array]
//     },
//     metadata: {
//       merge: undefined,
//       run_id: '1ed83f9a-d953-4527-9e5b-1474fca72355',
//       tags: [],
//       name: undefined,
//       message_id: 'chatcmpl-BTb6SQ2iOOpI0WoEfdke1uDgAydt6'
//     }
//   },


const systemPromt = new SystemMessage(
  `Eres un evaluador de respuestas  y debes resumir y estructurar ésta respuesta para que sea procesada por un agente de voz, es decir, que el texto que respondas de esta evaluacion del mensaje debe ser breve, claro y conciso, como si fuera una charla real, sin tecnicismos ni emojis.
  Tu respuesta va a ser hablada directamente al usuario por ende no debes usar emojis ni tecnicismos, solo lo que el usuario necesita saber.
  Además debes modificar ciertas palabras o simbolos para que el agente de voz lo entienda.
  Por ejemplo: si en el mensaje hay un signo de $ o de €, debes cambiarlo por la palabra "euros" o "dolares" respectivamente.
  Si hay un signo de % debes cambiarlo por la palabra "porciento" o "porcentaje" respectivamente.
  Si hay un signo de + o - debes cambiarlo por la palabra "mas" o "menos" respectivamente.
  Si hay un signo de / debes cambiarlo por la palabra "por" respectivamente.
  - Si dice USD debes cambiarlo por "dolares"
  - Si dice EUR debes cambiarlo por "euros"
  en cuando a los numeros:
  - si hay un numero como 100.000 debes cambiarlo por "cien mil"
  - si hay un numero como 1.000.000 debes cambiarlo por "un millon"
  - si est la palabra m2 debes cambiarlo por "metros cuadrados"
  - si hay un numero como 1.5 debes cambiarlo por "uno punto cinco"
  - Si dice 2 hab. debes cambiarlo por "dos habitaciones"
  - Si dice 2 baños debes cambiarlo por "dos baños"
  - sis dice MYM debes cambiarlo por "inmobiliaria EME Y EME"
  - las siglas deben cambiarse por la palabra completa, por ejemplo: si dice "AI" debes cambiarlo por "inteligencia artificial", si dice "CRM" debes cambiarlo por "sistema de gestión de clientes"
  y asi con cada simbolo o palabra que no entienda el agente de voz.
  
  `
)

function shouldContinue(
  state: typeof newState.State,
  config: LangGraphRunnableConfig,
) {
  const { messages } = state;
  // console.log(messages);
 
  const lastMessage = messages[messages.length - 1] as AIMessage;
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage?.tool_calls?.length) {
    return "tools";
  } else {
    console.log("end of conversation");

    return END;
  }

  // Otherwise, we stop (reply to the user)
}

// const products = [
//   {
//     agente: "M&M .",
//     alrededores: "Bus:\nTren:\nRestaurantes:\nAeropuerto:",
//     banios: 1,
//     caracteristicas: [
//       "Planta 1",
//       "Aparcamiento",
//       "Terraza",
//       "Buen Estado",
//       "Comunidad:  0",
//       "Ventanas: Aluminio",
//       "Cocina: Independiente",
//       "Ubicación: Céntrico",
//     ],
//     circunstancia: "No Disponible",
//     ciudad: "Gava",
//     cocina: "Independiente",
//     codigo_postal: 8850,
//     construccion_nueva: 0,
//     consumo_energia: 0,
//     direccion: "Calle Sarria, 11, puerta 2",
//     dormitorios: 3,
//     emisiones: 0,
//     estado: "No Disponible",
//     estgen: "Buen Estado",
//     fecha_alta: "2024-04-26 00:00:00",
//     freq_precio: "sale",
//     "geolocalizacion.latitude": 41.30558,
//     "geolocalizacion.longitude": 2.00845,
//     id: "1985",
//     image_url:
//       "https://crm904.inmopc.com/INMOWEB-PHP/base/fotos/inmuebles/98475/9847513104_5.jpg",
//     m2constr: 0,
//     m2terraza: 0,
//     m2utiles: 82,
//     moneda: "EUR",
//     nascensor: 0,
//     ntrasteros: 0,
//     num_inmueble: 11,
//     num_pisos_bloque: 0,
//     num_pisos_edificio: 0,
//     num_planta: "1ª Planta",
//     num_terrazas: 1,
//     pais: "spain",
//     piscina: 1,
//     precio: 208000,
//     "propietario.apellido": "David",
//     "propietario.codigo": 51,
//     "propietario.comercial": "M&M .",
//     "propietario.fecha_alta": "03/11/2023",
//     "propietario.nombre": "Maria",
//     provincia: "Barcelona",
//     puerta: 2,
//     ref: 3092,
//     "superficie.built": 0,
//     "superficie.plot": 0,
//     tipo: "piso",
//     tipo_operacion: "Venta",
//     tipo_via: "Calle",
//     ubicacion: "Céntrico",
//     ventana: "Aluminio",
//     zona: "Centre",
//     url: "https://propiedades.winwintechbank.com/#/producto/1985",
//   },
// ];

const humanNodeBooking = (lastMessage: AIMessage) => {
  if (lastMessage.tool_calls) {
    const toolArgs = lastMessage.tool_calls[0].args as {
      name: string;
      start: string;
      email: string;
    };
    const { name, start, email } = toolArgs;
    const actionRequest: ActionRequest = {
      action: "Confirma la reserva",
      args: toolArgs,
    };

    

    const date = new Date(start);

      // Fecha y hora completas
        const stringNormalized = 
        date.toLocaleString('es-ES', {
          day:   '2-digit',
          month: '2-digit',
          year:  'numeric',
          hour:   '2-digit',
          minute: '2-digit',
          hour12: false
        });



    const description = `Por favor, confirma la reserva de la propiedad con los siguientes parámetros: ${JSON.stringify(
      {
        name,
        stringNormalized,
        email,
      },
    )}`;

    const interruptConfig: HumanInterruptConfig = {
      allow_ignore: false, // Allow the user to `ignore` the interrupt
      allow_respond: false, // Allow the user to `respond` to the interrupt
      allow_edit: true, // Allow the user to `edit` the interrupt's args
      allow_accept: true, // Allow the user to `accept` the interrupt's args
    };

    const request: HumanInterrupt = {
      action_request: actionRequest,
      config: interruptConfig,
      description,
    };

    const humanResponse = interrupt<HumanInterrupt[], HumanResponse[]>([
      request,
    ])[0];

    if (humanResponse.type === "response") {
      const message = `User responded with: ${humanResponse.args}`;
      return { interruptResponse: message, humanResponse: humanResponse.args };
    } else if (humanResponse.type === "accept") {
      const message = `User accepted with: ${JSON.stringify(humanResponse.args)}`;
      return { interruptResponse: message, humanResponse: humanResponse };
    } else if (humanResponse.type === "edit") {
      const message = `User edited with: ${JSON.stringify(humanResponse.args)}`;
      return { interruptResponse: message, humanResponse: humanResponse.args };
    } else if (humanResponse.type === "ignore") {
      const message = "User ignored interrupt.";
      return { interruptResponse: message, humanResponse: humanResponse };
    }

    return {
      interruptResponse:
        "Unknown interrupt response type: " + JSON.stringify(humanResponse),
    };
  }
};

const humanNode = (lastMessage: any) => {
  const toolArgs = lastMessage.tool_calls[0].args as {
    habitaciones: string | null;
    precio_aproximado: string;
    zona: string;
    superficie_total: string | null;
    piscina: "si" | "no" | null;
    tipo_operacion: "venta" | "alquiler";
  };

  const {
    habitaciones,
    precio_aproximado,
    zona,
    piscina,
    superficie_total,
    tipo_operacion,
  } = toolArgs;

  // Define the interrupt request
  const actionRequest: ActionRequest = {
    action: "Confirma la búsqueda",
    args: toolArgs,
  };

  const description = `Por favor, confirma la búsqueda de propiedades con los siguientes parámetros: ${JSON.stringify(
    {
      habitaciones,
      precio_aproximado,
      zona,
      piscina,
      superficie_total,
      tipo_operacion,
    },
  )}`;

  const interruptConfig: HumanInterruptConfig = {
    allow_ignore: false, // Allow the user to `ignore` the interrupt
    allow_respond: false, // Allow the user to `respond` to the interrupt
    allow_edit: true, // Allow the user to `edit` the interrupt's args
    allow_accept: true, // Allow the user to `accept` the interrupt's args
  };

  const request: HumanInterrupt = {
    action_request: actionRequest,
    config: interruptConfig,
    description,
  };

  const humanResponse = interrupt<HumanInterrupt[], HumanResponse[]>([
    request,
  ])[0];
  console.log("request: ", request);

  console.log("humanResponse: ", humanResponse);

  if (humanResponse.type === "response") {
    const message = `User responded with: ${humanResponse.args}`;
    return { interruptResponse: message, humanResponse: humanResponse.args };
  } else if (humanResponse.type === "accept") {
    const message = `User accepted with: ${JSON.stringify(humanResponse.args)}`;
    return { interruptResponse: message, humanResponse: humanResponse };
  } else if (humanResponse.type === "edit") {
    const message = `User edited with: ${JSON.stringify(humanResponse.args)}`;
    return { interruptResponse: message, humanResponse: humanResponse.args };
  } else if (humanResponse.type === "ignore") {
    const message = "User ignored interrupt.";
    return { interruptResponse: message, humanResponse: humanResponse };
  }

  return {
    interruptResponse:
      "Unknown interrupt response type: " + JSON.stringify(humanResponse),
  };
};

interface booking {
  name: string;
  start: string;
  email: string;
}

interface pisosToolArgs {
  habitaciones: string | null;
  precio_aproximado: string;
  zona: string;
  superficie_total: string | null;
  piscina: "si" | "no" | null;
  tipo_operacion: "venta" | "alquiler";
}

const toolNodo = async (
  state: typeof newState.State,
  config: LangGraphRunnableConfig,
) => {
  const { messages } = state;
 
  const lastMessage = messages[messages.length - 1] as AIMessage;
  console.log("toolNodo");
  console.log("-----------------------");
  // console.log(lastMessage);
  // console.log(lastMessage?.tool_calls);

  let toolMessage: ToolMessage;
  if (lastMessage?.tool_calls?.length && lastMessage.tool_calls[0]) {
    // const lastMessageID = lastMessage.id;
    const toolName = lastMessage.tool_calls[0].name;
    const toolArgs = lastMessage.tool_calls[0].args as pisosToolArgs & {
      query: string;
    } & { startTime: string; endTime: string } & {
      name: string;
      start: string;
      email: string;
    };
    let tool_call_id = lastMessage.tool_calls[0].id as string;

    if (toolName === "Obtener_pisos_en_venta_dos") {
      const response = await getPisos2.invoke(toolArgs);
      if(!response ) {
        toolMessage = new ToolMessage(
          "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
          tool_call_id,
          "Obtener_pisos_en_venta_dos",
        );
      }
      else {
        toolMessage = new ToolMessage(
          response,
          tool_call_id,
          "Obtener_pisos_en_venta_dos",
        );

        

      }
      // const responseInterrupt = humanNode(lastMessage);
      // if (
      //   responseInterrupt.humanResponse &&
      //   typeof responseInterrupt.humanResponse !== "string" &&
      //   responseInterrupt.humanResponse.args
      // ) {
      //   // const toolArgsInterrupt = responseInterrupt.humanResponse
      //   //   .args as pisosToolArgs;
      //   const response = await getPisos2.invoke(toolArgs);
      //   if (typeof response !== "string") {
      //     toolMessage = new ToolMessage(
      //       "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
      //       tool_call_id,
      //       "Obtener_pisos_en_venta_dos",
      //     );
      //   } else {
      //     toolMessage = new ToolMessage(
      //       response,
      //       tool_call_id,
      //       "Obtener_pisos_en_venta_dos",
      //     );
      //   }
      // }
    } else if (toolName === "universal_info_2025") {
      // const res = await pdfTool.invoke(toolArgs);
      toolMessage = new ToolMessage("res", tool_call_id, "universal_info_2025");
    } else if (toolName === "getAvailabilityTool") {
      const res = await getAvailabilityTool.invoke(toolArgs);
      toolMessage = new ToolMessage(res, tool_call_id, "getAvailabilityTool");
    } else if (toolName === "createbookingTool") {
      const responseInterruptBooking = humanNodeBooking(lastMessage);
      if (
        responseInterruptBooking?.humanResponse &&
        typeof responseInterruptBooking.humanResponse !== "string" &&
        responseInterruptBooking.humanResponse.args
      ) {
        const toolArgsInterrupt = responseInterruptBooking.humanResponse
          .args as ActionRequest;
        console.log("tollArgsInterrupt: ", toolArgsInterrupt);
        if (toolArgsInterrupt.args) {
          const { name, start, email } = toolArgsInterrupt.args as booking;
          const response = await createbookingTool.invoke({
            name,
            start,
            email,
          });
          if (typeof response !== "string") {
            toolMessage = new ToolMessage(
              "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
              tool_call_id,
              "createbookingTool",
            );
          } else {
            toolMessage = new ToolMessage(
              response,
              tool_call_id,
              "createbookingTool",
            );
          }
        } else {
          toolMessage = new ToolMessage(
            "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
            tool_call_id,
            "createbookingTool",
          );
        }
      } else {
        toolMessage = new ToolMessage(
          "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
          tool_call_id,
          "createbookingTool",
        );
      }
    } else if (toolName === "products_finder") {
      console.log("products_finder");
      console.log(lastMessage);
      
      
      const res = await productsFinder.invoke({
        ...toolArgs,
        props: INMUEBLE_PROPS,
      } as any); // @ts-ignore
      toolMessage = res.message as ToolMessage;

      

      // ui.push({
      //   name: "products-carousel",
      //   props: {// @ts-ignore
      //     items: [...res.item],
      //     toolCallId: tool_call_id,
      //   },
      //   metadata: {
      //     message_id: lastMessageID,
      //   },
      // });
    }
  } else {
    const toolMessages = lastMessage.tool_calls?.map((call) => {
      return new ToolMessage(
        "No pude gestionar esta herramienta, probemos de nuevo",
        call.id as string,
        `${call?.name}`,
      );
    });

    if (!toolMessages || toolMessages.length === 0) {
      toolMessage = new ToolMessage(
        "No pude gestionar esta herramienta, probemos de nuevo",
        lastMessage.id as string,
        "error",
      );
      return { messages: [...messages, toolMessage] };
    } else {
      return { messages: [...messages, ...toolMessages] };
    }
  }
  // tools.forEach((tool) => {
  //   if (tool.name === toolName) {
  //     tool.invoke(lastMessage?.tool_calls?[0]['args']);
  //   }
  // });
  // console.log("toolMessage: ", toolMessage);
//@ts-ignore
  return {  messages: [ toolMessage]  , timestamp: Date.now() };
};

// const delete_messages = async (state: typeof newState.State) => {
//   const { messages, summary } = state;
//   console.log("delete_messages");
//   console.log("-----------------------");

//   console.log(messages);

//   let summary_text = "";

//   let messages_parsed: any[] = [];
//   messages_parsed = messages.map((message) => {
//     if (message instanceof AIMessage) {
//       return {
//         ...messages_parsed,
//         role: "assistant",
//         content: message.content,
//       };
//     }
//     if (message instanceof HumanMessage) {
//       return { ...messages_parsed, role: "Human", content: message.content };
//     }
//   });

//   // 1. Filtrar elementos undefined
//   const filteredMessages = messages_parsed.filter(
//     (message) => message !== undefined
//   );

//   // 2. Formatear cada objeto
//   const formattedMessages = filteredMessages.map(
//     (message) => `${message.role}: ${message.content}`
//   );

//   // 3. Unir las cadenas con un salto de línea
//   const prompt_to_messages = formattedMessages.join("\n");

//   if (messages.length > 3) {
//     if (!summary) {
//       const intructions_summary = `Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación. Por favor, analiza cada mensaje y elabora un resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo
//         mensajes: ${prompt_to_messages}
//         `;

//       const summary_message = await model.invoke(intructions_summary);
//       summary_text = summary_message.content as string;
//     } else {
//       const instructions_with_summary = `"Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación y además tener en cuenta el resumen previo de dicha conversación. Por favor, analiza cada mensaje y el resumen y elabora un nuevo resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo.

//       mensajes: ${prompt_to_messages}

//       resumen previo: ${summary}

//       `;

//       const summary_message = await model.invoke(instructions_with_summary);

//       summary_text = summary_message.content as string;
//     }

//     const mssageReduced = messages.slice(0, -3).map((message) => {
//       return new RemoveMessage({ id: message.id as string });
//     });

//     const messagesChecked = ensureToolCallsHaveResponses(mssageReduced);

//     return {
//       messages: [...messagesChecked],
//       summary: summary_text,
//     };
//   }
//   return { messages };
// };

const graph = new StateGraph(newState);

graph
  .addNode("agent", callModel)
  .addNode("tools", toolNodo)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();

export const workflow = graph.compile({checkpointer});
// let config = { configurable: { thread_id: "123" } };

// const response = await workflow.invoke({messages:"dame las noticias ams relevantes de este 2025"}, config)

// console.log("response: ", response);

// const response =  workflow.streamEvents({messages: [new HumanMessage("Hola como estas? ")]}, {configurable: {thread_id: "1563"} , version: "v2" });
// console.log("-----------------------");
// console.log("response: ", response);

// await workflow.stream({messages: [new HumanMessage("Podes consultar mi cobertura?")]}, {configurable: {thread_id: "1563"} , streamMode: "messages" });

// console.log("-----------------------");

// await workflow.stream({messages: [new HumanMessage("Mi dni es 32999482, tipo dni")]}, {configurable: {thread_id: "1563"} , streamMode: "messages" });

// for await (const message of response) {

//   // console.log(message);
//   // console.log(message.content);
//   // console.log(message.tool_calls);

//   console.dir({
//     event: message.event,
//     messages: message.data,

//   },{
//     depth: 3,
//   });
// }

// for await (const message of response) {
//   // console.log(message);

//   console.dir(message, {depth: null});
// }

// await workflow.stream(new Command({resume: true}));

// Implementacion langgraph studio sin checkpointer
// export const workflow = graph.compile();

// MODIFICAR EL TEMA DE HORARIOS
// En el calendar de cal esta configurado el horario de bs.as.
// El agente detecta 3hs mas tarde de lo que es en realidad es.
// Ejemplo: si el agente detecta 16hs, en realidad es 13hs.
// Para solucionar este problema, se debe modificar el horario de la herramienta "create_booking_tool".
// En la herramienta "create_booking_tool" se debe modificar el horario de la variable "start".
// En la variable "start" se debe modificar la hora de la reserva.
