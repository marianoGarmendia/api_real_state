import {
  AIMessage,
  HumanMessage,
  InvalidToolCall,
  SystemMessage,
  ToolMessage,
  type BaseMessageLike,
} from "@langchain/core/messages";
// import { v4 as uuidv4 } from "uuid";
// import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  ActionRequest,
  HumanInterrupt,
  HumanInterruptConfig,
  HumanResponse,
} from "@langchain/langgraph/prebuilt";
// import { tool } from "@langchain/core/tools";
import { z } from "zod";
import ComponentMap from "./agent/ui.js";
import {
  typedUi,
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
// import { TavilySearch } from "@langchain/tavily";
// import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { encode } from "gpt-3-encoder";
import { createbookingTool, getAvailabilityTool } from "./booking-cal.mjs";
import { getPisos2, pdfTool } from "./pdf-loader_tool.mjs";
// import { ensureToolCallsHaveResponses } from "./ensure-tool-response.mjs";
// import { getUniversalFaq, noticias_y_tendencias } from "./firecrawl";

import { contexts } from "./contexts.mjs";
import { INMUEBLE_PROPS } from "./products_finder/schemas.mjs";
import { productsFinder } from "./products_finder/tools.mjs";
import { formatMessages } from "./format-messages.mjs";
import { formatSchema } from "./format_schema.mjs";
import { contextPrompt } from "./products_finder/helpers.mjs";

export const empresa = {
  eventTypeId: contexts.clinica.eventTypeId,
  context: contexts.clinica.context,
};

// process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
import * as dotenv from "dotenv";
import { update } from "lodash-es";
import { timeStamp } from "node:console";
import { vi } from "vitest";
import { get } from "node:http";
// import { tool, ToolSchemaBase } from "@langchain/core/tools";
dotenv.config();

// const tavilySearch = new TavilySearch({
//   tavilyApiKey: process.env.TAVILY_API_KEY,
//   description:
//     "Herramienta para buscar colegios, escuelas, clubes, ubicacion del mar , y relacionarlo con la zona de la propiedad",
//   name: "tavily_search",
// });

// const tools = [getAvailabilityTool, createbookingTool];

const stateAnnotation = MessagesAnnotation;

interface toolSchema {
  tool_name: string;
  id: string;
}

interface inputInmuble {
  prompt: string;
  props: string[];
}

const newState = Annotation.Root({
  ...stateAnnotation.spec,
  summary: Annotation<string>,
  property: Annotation<object>,
  request_property: Annotation<inputInmuble>,
  interruptResponse: Annotation<string>,
  ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),
});

// const llmGoogle = new ChatGoogleGenerativeAI({
//   model: "gemini-2.5",
//   streaming: false,
//   apiKey: process.env.GOOGLE_API_KEY,
//   temperature: 0,
// })

// export const llmGroq = new ChatGroq({
//   model: "llama-3.3-70b-versatile",
//   apiKey: process.env.GROQ_API_KEY,
//   temperature: 0,
//   maxTokens: undefined,
//   maxRetries: 2,
//   // other params...
// }).bindTools(tools);

export const model = new ChatOpenAI({
  model: "gpt-4o",
  streaming: false,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
});

// const toolNode = new ToolNode(tools);

async function callModel(
  state: typeof newState.State,
  config: LangGraphRunnableConfig,
) {
  const { messages } = state;

  // const ui = typedUi(config);

  // console.log("sumary agent en callModel");
  // console.log("-----------------------");
  // console.log(summary);

  const systemsMessage = new SystemMessage(
    `
        Sos Carla, el Agente IA de inmobiliaria MYM. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes, pero sobre todo guiar al cliente para que pueda comprar una propiedad según las caracteristicas que busca, tu perfil es el de una asesora inmobiliaria profesional, con gran vocación de venta  pero no invasiva. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.

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

        “Hola, soy Carla, Agente IA de la inmobiliaria MYM. quiero ayduarte a resolver todas tus consultas, ¿cual es tu nombre?”
        ( Cuanbdo el usuario responde, lo saludas por su nombre y le preguntas en que podes ayudarlo/a)

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

        ### REGLAS DE NEGOCIO:
        - Primero que nada debes lograr que el usuario te confirme que está buscando propiedades, si no lo hace no puedes buscar propiedades.
        - Si busca propiedades, analiza lo que busca y se breve y practico, no preguntes de más.
        - Solamente despues de que haya visto propiedades puede proponer una visita antes no

       

        Precios en euros.

       

    

         ℹ️ Información adicional
        Hoy es ${new Date().toLocaleDateString()}, hora ${new Date().toLocaleTimeString()}.

        Visitas: lunes a viernes, 9:00–18:00 en bloques de 30 min.

  
 `,
  );

  const response = await model.invoke([systemsMessage, ...messages]);

  // console.log("response: ", response);

  // const cadenaJSON = JSON.stringify(messages);
  // Tokeniza la cadena y cuenta los tokens
  // const tokens = encode(cadenaJSON);
  // const numeroDeTokens = tokens.length;

  console.log("call model ", messages);

  // console.log(`Número de tokens: ${numeroDeTokens}`);

  return { messages: [...messages, response] };

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

// function shouldContinue(
//   state: typeof newState.State,
//   config: LangGraphRunnableConfig,
// ) {
//   const { messages, request_property } = state;

//   const lastMessage = messages[messages.length - 1] as AIMessage;

//   console.log("shouldContinue: ", lastMessage);

//   // If the LLM makes a tool call, then we route to the "tools" node
//   if (lastMessage?.tool_calls?.length) {
//     return "tools";
//   } else {
//     console.log("end of conversation");

//     return END;
//   }

//   // Otherwise, we stop (reply to the user)
// }

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

    const description = `Por favor, confirma la reserva de la propiedad con los siguientes parámetros: ${JSON.stringify(
      {
        name,
        start,
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
  const { messages, request_property } = state;
  const ui = typedUi(config);
  const lastMessage = messages[messages.length - 1] as AIMessage;
  console.log("lastMessage: ", lastMessage);
  console.log("request_property_finder: ", request_property);

  console.log("toolNodo");
  console.log("-----------------------");
  // console.log(lastMessage);
  // console.log(lastMessage?.tool_calls);

  let toolMessage: BaseMessageLike = "un tool message" as BaseMessageLike;
  if (lastMessage?.tool_calls?.length) {
    const lastMessageID = lastMessage.id;
    const toolName = lastMessage.tool_calls[0].name;
    const toolCallId = lastMessage.tool_calls[0].id as string;
    const toolArgs = lastMessage.tool_calls[0].args as pisosToolArgs & {
      query: string;
    } & { startTime: string; endTime: string } & {
      name: string;
      start: string;
      email: string;
    };
    let tool_call_id = lastMessage.tool_calls[0].id as string;

    if (toolName === "Obtener_pisos_en_venta_dos") {
      const responseInterrupt = humanNode(lastMessage);
      if (
        responseInterrupt.humanResponse &&
        typeof responseInterrupt.humanResponse !== "string" &&
        responseInterrupt.humanResponse.args
      ) {
        const toolArgsInterrupt = responseInterrupt.humanResponse
          .args as pisosToolArgs;
        const response = await getPisos2.invoke(toolArgsInterrupt);
        if (typeof response !== "string") {
          toolMessage = new ToolMessage(
            "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
            tool_call_id,
            "Obtener_pisos_en_venta_dos",
          );
        } else {
          toolMessage = new ToolMessage(
            response,
            tool_call_id,
            "Obtener_pisos_en_venta_dos",
          );
        }
      }
    } else if (toolName === "universal_info_2025") {
      const res = await pdfTool.invoke(toolArgs);
      toolMessage = new ToolMessage(res, tool_call_id, "universal_info_2025");
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
    } else if (toolName === "evaluate_request") {
      const schemaToolArgs = await formatSchema(toolArgs);

      const res = await productsFinder({
        prompt: schemaToolArgs.prompt,
        props: INMUEBLE_PROPS,
        config: config,
      } as any);
      const responseTool = res as { item: any[]; message: ToolMessage };
      toolMessage = responseTool.message;
      // toolMessage = new ToolMessage("", request_property_finder.id , "evaluate_request")
      console.log("res item: ", responseTool.item);

      ui.push({
        name: "products-carousel",
        props: {
          items: [...responseTool.item],
          toolCallId: toolCallId,
        },
        metadata: {
          message_id: lastMessageID,
        },
      });
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

  return { ui: ui.items, messages: [...messages, toolMessage] };
};

const evaluate = async (state: typeof newState.State) => {
  const { messages } = state;

  const schema = z.object({
    prompt: z
      .string()
      .describe(
        "Consulta del usuario sobre el producto buscado, debe contener todos los requerimientos que el usuario considere relevantes",
      ),
    props: z
      .array(z.string())
      .describe("Atributos del producto que se pueden filtrar"),
  });

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    streaming: false,
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
  })
    .bindTools([
      {
        name: "find_property",
        description:
          "Recopila la información necesaria para buscar la propiedad que desea comprar el usuario ",
        schema: schema,
      },
    ])
    .withConfig({ tags: ["nostream"] });

  const conversation = formatMessages(messages);

  const prompt = `
  Sos Carla, el Agente IA de inmobiliaria MYM. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes, pero sobre todo guiar al cliente para que pueda comprar una propiedad según las caracteristicas que busca, tu perfil es el de una asesora inmobiliaria profesional, con gran vocación de venta  pero no invasiva. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.

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

        “Hola, soy Carla, Agente IA de la inmobiliaria MYM. quiero ayduarte a resolver todas tus consultas, ¿cual es tu nombre?”
        ( Cuanbdo el usuario responde, lo saludas por su nombre y le preguntas en que podes ayudarlo/a)

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

        ### REGLAS DE NEGOCIO:
        - Primero que nada debes lograr que el usuario te confirme que está buscando propiedades, si no lo hace no puedes buscar propiedades.
        - Si busca propiedades, analiza lo que busca y se breve y practico, no preguntes de más.
        - Solamente despues de que haya visto propiedades puede proponer una visita antes no

       

        Precios en euros.

       

    

         ℹ️ Información adicional
        Hoy es ${new Date().toLocaleDateString()}, hora ${new Date().toLocaleTimeString()}.

        Visitas: lunes a viernes, 9:00–18:00 en bloques de 30 min.
  
    
  Eres un agente de ventas d la imobiliaria MYM, el usuario está en busqueda una propiedad en venta, su consulta puede ser variada, puede preguntar por una zona, por cantidad de dormitorios, por precio, por piscina, por m2, por una propiedad en particular o por una propiedad en general, puede llegar a ser muy amplia o muy especifica la descripcion, debes ser capaz de recopilar la información relevante para poder utilizar la herramienta para la busqueda de propiedades.
  Para ellos debes recopialr datos como:
  cantidad de dormitorios, cantidad de baños, precio aproximado, zona, piscina, m2 construidos, m2 terraza, si es una propiedad en venta o alquiler.
  No necesiariamente deben estar todos, pero si los más importantes que el ususario considere relevantes.
  Para ello preguntale cual considera relevante para su búsqueda y que lo detalle lo mejor posible, ya que con ello mejoraras la calidad de la búsqueda.

  debes guardar la información en la variable prompt y props, para ello debes utilizar el siguiente formato:
  prompt: 'Consulta del usuario sobre el producto buscado',
  props: 'Atributos del producto que se pueden filtrar',

  Además te proveo de la conversación con el usuario hasta el momento
    El contexto de la conversacion es este hisotrial de mensajes entre el usuario y tu.
    contexto: ${conversation}
   
    `;

  const response = await llm.invoke(prompt);
  console.log("evaluate response: ", response);

  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolMessage = new ToolMessage(
      "Recopilación de datos exitosa para buscar la propiedad",
      response.tool_calls[0].id as string,
      "find_property",
    );
    // Aca se podría manipular los requerimientos de la propiedad segun los argumentos, etc
    return {
      messages: [...messages, toolMessage],
      request_property: response.tool_calls[0].args as inputInmuble,
    };
  }

  return {
    messages: [...messages, response],
    request_property: null,
  }
};

const routerAfterEvaluate = (state: typeof newState.State) => {
  const { request_property } = state;

  if (!request_property) {
    return END;
  }

  return "tools";
};

const callTool = async (
  state: typeof newState.State,
  config: LangGraphRunnableConfig,
) => {
  const { request_property } = state;
  if (!request_property) {
    throw new Error("No hay requerimientos para la búsqueda de la propiedad");
  }

  const ui = typedUi(config);

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  }).bindTools([productsFinder]);

  const response = await llm.invoke([
    {
      role: "system",
      content:
        "Eres un agente de ventas d la imobiliaria MYM, el usuario está en busqueda una propiedad en venta, puedes extraer los requisitos necesarios de la conversacion para buscar la propiedad que desea comprar el usuario",
    },
    ...state.messages,
  ]);

  const lastMessageID = state.messages[state.messages.length - 1].id as string;

  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCallId = response.tool_calls[0].id as string;
    const responseFinder = await productsFinder.invoke(
      response.tool_calls[0].args as inputInmuble,
    );
    const { item, message } = responseFinder as {
      item: any[];
      message: ToolMessage;
    };


    ui.push(
      {
        name: "products-carousel",
        props: {
          items: [...item],
          toolCallId: toolCallId,
        },
        metadata: {
          message_id: lastMessageID,
        },
      },
      { message: response },
    );

    return {
      ui: ui.items,
      messages: [
        ...state.messages,
        message,
      ],
      timeStamp: Date.now(),
      
    }

  }


};

const classify = async (state: typeof newState.State) => {
  const {request_property, messages} = state

  if(!request_property){
    return {}
  }

  
  
  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  }).bindTools(  [
    getAvailabilityTool,
    createbookingTool,
  ],
  {
    
  },).withConfig({
    tags: ["nostream"],})

    const prompt =`

      INFORMACIÓN DE CONTEXTO:
         Sos Carla, el Agente IA de inmobiliaria MYM. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes, pero sobre todo guiar al cliente para que pueda comprar una propiedad según las caracteristicas que busca, tu perfil es el de una asesora inmobiliaria profesional, con gran vocación de venta  pero no invasiva. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.

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

        “Hola, soy Carla, Agente IA de la inmobiliaria MYM. quiero ayduarte a resolver todas tus consultas, ¿cual es tu nombre?”
        ( Cuanbdo el usuario responde, lo saludas por su nombre y le preguntas en que podes ayudarlo/a)

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

        ### REGLAS DE NEGOCIO:
        - Primero que nada debes lograr que el usuario te confirme que está buscando propiedades, si no lo hace no puedes buscar propiedades.
        - Si busca propiedades, analiza lo que busca y se breve y practico, no preguntes de más.
        - Solamente despues de que haya visto propiedades puede proponer una visita antes no
       

        Precios en euros.

    

         ℹ️ Información adicional
        Hoy es ${new Date().toLocaleDateString()}, hora ${new Date().toLocaleTimeString()}.

        Visitas: lunes a viernes, 9:00–18:00 en bloques de 30 min.

        ### propiedades encontradas al momento:

        ${JSON.stringify(request_property)}

        ### Conversacion hasta el momento:
        ${formatMessages(state.messages)}

        ### ACCION A TOMAR AHORA
        - Con las propiedades encontradas, debes proponerle al usuario cuales son las intenciones:
        - Visitar la propiedad
        - pedir mas información
        - recomendaciones 
        - buscar otras alternativas
        - Consultarle por otras acciones que quiera tomar

        ### REGLAS SOBRE ESTA CONVERSACIÓN
        - Ve preguntandole al usuario de a una cosa por vez, no le preguntes todo junto.
        - Tu objetivo es concretar una venta, no le preguntes cosas innecesarias.
        - Lograr que visite la propiedad es muy positivo ya que es un paso importante para concretar la venta y por sobre todo para que el usuario vea la propiedad y pueda decidir si le gusta o no.

        ### POSIBLES RESPUESTAS DEL USUARIO
        1 - Si quiere agendar una visita a alguna de las propiedades, debes preguntarle por la fecha y hora que le gustaría visitar la propiedad.
        - Vas a verificar disponibilidad de la visita en la herramienta "getAvailabilityTool" y si está disponible, debes agendarla con la herramienta "createbookingTool".
        - Sino le propones otro horario disponible


        2 - Si quiere ver otras opciones, le preguntas sobre si tiene nuevas caracteristicas  o requisitos para la busqueda, como ampliar el presupuesto, cantidad de dormitrios, metros cuadrados, piscina, etc
        - Siempre preguntar de a uno por vez pero lo mas importante es que el usuario desarrolle por su cuenta lo que busca, no le preguntes todo junto.
         - En el caso         
    `
    const response = await llm.invoke(prompt)

    let toolResponse = ""

    if (response.tool_calls && response.tool_calls.length > 0){
      
      const callFound = response.tool_calls.map((call:any) => {
        return call.name === "getAvailabilityTool" && call 
      })

       if(callFound.length > 0){
        const response = await getAvailabilityTool.invoke(callFound[0].args as {startTime: string, endTime: string})
        return toolResponse=response
        // return {messages: [...state.messages, response]}
       } 

       const callFoundTwo = response.tool_calls.map((call:any) => {
        return call.name === "createBookingTool" && call 
      })

      if(callFoundTwo.length > 0){
        const response = await createbookingTool.invoke(callFoundTwo[0].args as {start: string, name: string, email: string})
        return toolResponse = response
        // return {messages: [...state.messages, response]}
      }

    }

    const res = await llm.invoke(toolResponse)

    return {messages: [...messages, res]}


}

function routeStart(state: typeof newState.State): "classify" | "evaluate" {
  if (!state.request_property) {
    return "evaluate";
  }

  return "classify";
}

const routeAfterClassifying = (state: typeof newState.State) => {
const {request_property}=state

if(!request_property){
  return "evaluate"
}
return END

}


const graph = new StateGraph(newState);

graph
  .addNode("classify", classify)
 
  .addNode("callTools", callTool)
  .addNode("evaluate", evaluate)
  .addConditionalEdges("__start__", routeStart, ["classify", "evaluate"])
  .addConditionalEdges("classify", routeAfterClassifying, [
    END,
    "evaluate",
  ])
  .addConditionalEdges("evaluate", routerAfterEvaluate, ["callTools", END])

  .addEdge("callTools", END);

const checkpointer = new MemorySaver();

export const workflow = graph.compile({ checkpointer });
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
