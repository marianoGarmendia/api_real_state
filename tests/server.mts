import express from "express";

import cors from "cors";
import fs from "fs-extra";

import path, { dirname } from "path";
import { fileURLToPath } from "url";

// import { processAudioElevenLabs } from "./procesing-voices/text-to-speech.js";
// import { ensureToolCallsHaveResponses } from "./ensure-tool-response.ts";

const __filename = fileURLToPath(import.meta.url);
console.log("filename: ", __filename);

const __dirname = dirname(__filename);
console.log("dirname: ", __dirname);

// Guardar archivos de voz entrantes
// const upload = multer({ dest: 'uploads/' });
// const audiosDir = path.join(__dirname, "audios");
fs.ensureDirSync("audios"); // crea la carpeta si no existe

// Asegurarse que exista la carpeta
// if (!fs.existsSync('audios')) {
//   fs.mkdirSync('audios');
// }

// ... acá tu Multer y resto del código ...

// Multer config
// const storage = multer.diskStorage({
//   destination: (req:any, file:any, cb:any) => cb(null, "audios"),
//   filename: (req:any, file:any, cb:any) => cb(null, `${uuidv4()}.webm`),
// });
// const upload = multer({ storage });

import { workflow } from "./graphs/inmo.mjs";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { a } from "vitest/dist/chunks/suite.d.FvehnV49.js";
// import { text } from "stream/consumers";
// import { HumanMessage } from "@langchain/core/messages";

const app = express();
const PORT = process.env.PORT || 5000;

// const openai = new Openai({
//   apiKey: process.env.OPENAI_API_KEY_WIN_2_WIN,
// });

// const uploadsDir = 'uploads';
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir);
// }

// Servir audios generados
// app.use('/audios', express.static(path.join(__dirname, 'audios')));

// Middleware para parsear JSON
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "..")));
// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, "public")));
console.log("path.join: ", path.join(__dirname, "public"));

// Ruta para servir el archivo index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint principal
// app.post("/procesar-audio", upload.single("audio"), async (req, res) => {
//   const { threadId } = req.body; // Obtener el threadId del cuerpo de la solicitud
//   const webmPath = req.file?.path as string;

//   const audioName = `${uuidv4()}.wav`;
//   const audioPath = path.join("audios", audioName);
//   console.log("audioPath: ", audioPath);
//   console.log("webmPath: ", webmPath);

//   try {
//     const audio_wav_converted = await convertirAudioWebmAWav(
//       webmPath,
//       audioPath
//     );

//     // const audio_path_wav = await convertirAudio(audio_wav_converted, audioPath);
//     const textoUsuario = await transcribirAudio({
//       path_to_audio: audio_wav_converted,
//     });
//     console.log("🗣️ Usuario dijo:", textoUsuario);

//     // Le doy al agente el audio del humano
//     let config = { configurable: { thread_id: "123" } };
//     const responseGraph = await workflow.invoke(
//       { messages: textoUsuario },
//       config
//     );
//     const agent_message = responseGraph.messages[
//       responseGraph.messages.length - 1
//     ].content as string;

//     await processAudioElevenLabs(agent_message, audioPath);

//     // scheduleCleanup([wavPath, mp3Path], 2 * 60 * 1000); // elimina en 2 mins

//     res.send(`http://localhost:${PORT}/respuesta.mp3`);
//   } catch (err) {
//     console.error("❌ Error en /procesar-audio:", err);
//     res.status(500).send("Error procesando audio");
//   }
// });

// app.get("/start-recording", async (req, res) => {
//   const {threadId} = req.body
//   try {
//     await grabarAudio()
//     await convertirAudio()
//     const transcription = await transcribirAudio()

//     // Le doy al agente el audio del humano
//     let config =  { configurable: { thread_id: threadId } }
//     const responseGraph = await workflow.invoke({messages: transcription}, config)
//     const agent_message = responseGraph.messages[responseGraph.messages.length - 1].content

//    // Pasar texto a audio

//     res.json({ transcription });
//   } catch (error) {
//      res.status(500).json({ error: 'Error al procesar el audio' });
//   }
//   res.end()
// })

// Ruta /agent
app.post("/agent", async (req, res) => {
  const { message, thread_id } = req.body;
  let config = { configurable: { thread_id: thread_id } };
  const responseGraph = await workflow.invoke({ messages: message }, config);
  console.log(responseGraph);
  console.log("longitud de mensajes: " + responseGraph.messages.length);

  res
    .status(200)
    .json(responseGraph.messages[responseGraph.messages.length - 1].content);
});

// app.post("/agent_eleven",  (req, res) => {
//   console.log("agent eleven");
//   console.log(req.body);
//   res.status(200).json({message: "Hola"});

// })

const threadLocks = new Map<string, boolean>();
app.post("/v1/chat/completions", async (req, res) => {
  const { messages, stream } = req.body;
  
  
  // console.dir( req.body, { depth: null, colors: true });
  

  const last_message = messages.at(-1);

  console.log("user message: ", last_message);
  

  if (last_message.role !== "user") {
    res.write(
      `event: error\ndata: ${JSON.stringify({
        message: "El último mensaje debe ser del usuario",
      })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    return;
  }

  if (!stream) {
    res.status(400).json({ error: "Solo soporta stream=true" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

    // En tu handler de /chat/completions
    req.on("close", (e:any) => {
      console.log("[SSE] Cliente/proxy cerró la conexión");
      console.log("[SSE] Close:", e);
      threadLocks.set(thread_id, false);

    });
    res.on("error", (err) => {
      console.error("[SSE] Error en el stream:", err);
    });

  const heartbeat = setInterval(() =>     res.write(`: ping\n\n`), 2000);

  const thread_id = "158863656";
  if (threadLocks.get(thread_id)) {
    clearInterval(heartbeat);
    // Informamos por SSE y luego cerramos
    res.write(`event: error\ndata: ${JSON.stringify({
      message: "Espera un momento, estoy procesando información",
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  try {
    
    
   threadLocks.set(thread_id, true);
    const agentResp = await workflow.invoke(
      { messages: last_message },
      { configurable: { thread_id } }
    );
    // const state = await workflow.getState({
    //   configurable: { thread_id },
    // });
    // console.log("state: ", state.values.messages.at(-2));
    // console.log("state: ", state.values.messages.at(-1));
    
    if(agentResp.messages.at(-1) instanceof AIMessage ){
        console.log("AIMessage: ");

    }else if(agentResp.messages.at(-1) instanceof ToolMessage){
        console.log("ToolMessage: ");
    }else{
        console.log("Human message");
    }

    const reply =
      agentResp.messages.at(-1)?.content;
    console.log("reply: ", reply);
    
      if(reply === ""){
        res.write("data: [DONE]\n\n");
        return;
      }

    // construir chunk
    const id = Date.now().toString();
    const created = Math.floor(Date.now() / 1000);
    const chunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: "gpt-4-o",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: reply === "" ? "Muy bien, voy a realizar la búsqueda espera un momento por favor" : reply },
          finish_reason: "stop",
        },
      ],
    };

    console.log("send a elevenlabs");
    // console.dir(chunk, { depth: null, colors: true });

    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write("data: [DONE]\n\n");
   
    // res.end()

  } catch (err:any) {
    res.write(
      `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    console.log("Error en /v1/chat/completions:", err);
  } finally {
    clearInterval(heartbeat);
     threadLocks.set(thread_id, false); // ← Liberar el lock
    res.end();
  }
});

// Version con controller
// const threadLocks = new Map<string, boolean>();

// const threadLocks = new Map<string, AbortController>();

// app.post("/v1/chat/completions", async (req, res) => {
//   const { messages, stream } = req.body;
//   const thread_id = "146"; // podrías usar hash del usuario

//   // Cancelar flujo anterior si lo hay
//   const prev = threadLocks.get(thread_id);
//   if (prev) {
//     prev.abort(); // cancela ejecución previaHtoolno
//   }
//   const controller = new AbortController();
//   threadLocks.set(thread_id, controller);

//   // Manejo de headers SSE
//   if (!stream) {
//     res.status(400).json({ error: "Solo soporta stream=true" });
//     return
//   }

//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   const heartbeat = setInterval(() => res.write(`: ping\n\n`), 2000);

//   req.on("close", () => {
//     console.log("[SSE] Cliente cerró la conexión");
//     controller.abort(); // cancela si cliente cierra conexión
//     threadLocks.delete(thread_id);
//     clearInterval(heartbeat);
//   });

//   try {
//     // Verificar si el flujo anterior quedó con tool_call pendiente
//     const state = await workflow.getState({ configurable: { thread_id } });
//     let lastMsg;
//     if(state.values.messages && state.values.messages.length > 0){
//        lastMsg = state.values.messages.at(-1);
//     }

//     if (lastMsg?.tool_calls?.length) {
//       const toolCall = lastMsg.tool_calls[0];
//       const forced = new ToolMessage("Interrumpido", toolCall.id, toolCall.name);
//       await workflow.invoke({ messages: forced }, {
//         configurable: { thread_id }
//       });
//     }

//     console.log("human message: ", messages.at(-1));
    

//     const agentResp = await workflow.invoke(
//       { messages: messages.at(-1) },
//       { configurable: { thread_id }, signal: controller.signal }
//     );

//     const reply = agentResp.messages.at(-1)?.content ?? "";

//     if (reply) {
//       const chunk = {
//         id: Date.now().toString(),
//         object: "chat.completion.chunk",
//         created: Math.floor(Date.now() / 1000),
//         model: "gpt-4-o",
//         choices: [{
//           index: 0,
//           delta: { role: "assistant", content: reply },
//           finish_reason: "stop",
//         }],
//       };

//       res.write(`data: ${JSON.stringify(chunk)}\n\n`);
//     }

//     res.write("data: [DONE]\n\n");
//   } catch (err: any) {
//     console.error("Error:", err);
//     res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
//     res.write("data: [DONE]\n\n");
//   } finally {
//     clearInterval(heartbeat);
//     res.end();
//     threadLocks.delete(thread_id);
//   }
// });






// let forward = true;
// app.post("/v1/chat/completions", async (req, res) => {
//   const { messages, stream } = req.body;
//   console.log("stream: ", stream);

//   const last_message = messages.at(-1);

//   if (last_message.role !== "user") {
//     res.write(
//       `event: error\ndata: ${JSON.stringify({
//         message: "El último mensaje debe ser del usuario",
//       })}\n\n`,
//     );
//     res.write("data: [DONE]\n\n");
//     return;
//   }

//   if (!stream) {
//     res.status(400).json({ error: "Solo soporta stream=true" });
//     return;
//   }
//   res.setHeader("Content-Type", "text/event-stream");
//   res.setHeader("Cache-Control", "no-cache");
//   res.setHeader("Connection", "keep-alive");

//   // En tu handler de /chat/completions
//   req.on("close", (e: any) => {
//     console.log("[SSE] Cliente/proxy cerró la conexión");
//     console.log("[SSE] Close:", e);
//     threadLocks.set(thread_id, false);
//   });
//   res.on("error", (err) => {
//     console.error("[SSE] Error en el stream:", err);
//   });

//   const heartbeat = setInterval(() => res.write(`: ping\n\n`), 2000);

//   const thread_id = "149";
//   if (threadLocks.get(thread_id)) {
//     clearInterval(heartbeat);
//     // Informamos por SSE y luego cerramos
//     res.write(
//       `event: error\ndata: ${JSON.stringify({
//         message: "Espera un momento, estoy procesando información",
//       })}\n\n`,
//     );
//     res.write("data: [DONE]\n\n");
//     res.end();
//     return;
//   }
// console.log("last_message: ", last_message);


//   try {
//     const stream = await workflow.stream(
//       { messages: last_message },
//       { configurable: { thread_id }, streamMode: "messages" },
   
//     );

//     console.log("stream: ", stream);
    

//     for await (const step of stream) {
//       // Identifica los mensajes generados por el agente
//       // console.log("step: ", step[0]);
      
//       // if (step.data && step.data.chunk ) {
//       //  console.log("step data chunk: ", step.data.chunk);
//       //  console.log("step data tool_calls : ", step.data.chunk.tool_calls);
       
       

//         console.log("event: ", step.event);
//         // console.log("data: ", step.data);
//         // if(step.data.chunk.tools !== undefined){

//         //   console.log("tools: ", step.data.chunk.tools.messages);
//         // }
        
        
        
//           // const partial = step.data.chunk.content;
//           const partial = step[0].content;
//           console.log("partial: ", partial);
//           if(partial === ""){
//             res.write("data: [DONE]\n\n");
//             res.end()
//             return;
//           }

       
        
//             const chunk = {
//               id: Date.now().toString(),
//               object: "chat.completion.chunk",
//               created: Math.floor(Date.now() / 1000),
//               model: "gpt-4-o",
//               choices: [
//                 {
//                   index: 0,
//                   delta: {role: "assistant" ,  content: partial },
//                   finish_reason: null,
//                 },
//               ],
//             };
  
//             res.write(`data: ${JSON.stringify(chunk)}\n\n`);

          
          
          
          
//           // if (partial === "") {
//           //   res.write("data: [DONE]\n\n");
//           //   return;
//           // }

          
        
//       // }
//       // Puedes emitir ToolMessages o manejar otras fases aquí también si es útil para feedback temprano
//     }
//     console.log("finde de stream DONE");
    
//     res.write("data: [DONE]\n\n");
//     res.end();

//     // res.end()
//   } catch (err: any) {
//     res.write(
//       `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`,
//     );
//     res.write("data: [DONE]\n\n");
//     console.log("Error en /v1/chat/completions:", err);
//   } finally {
//     clearInterval(heartbeat);

//     res.end();
//   }
// });

//   const streamingDelay = 1000; // ms entre chunks

//   async function streamWaitMessage(res, chunk) {

//     const frase =
//       "Dame un momento por favor, estoy buscando propiedades según tus preferencias... ya casi termino, solo un momento por favor";
//     const palabras = frase.split(/(\s+|(?<=\w)(?=[.,]))/); // separa palabras y puntuación

//     const id = Date.now();

//     for (const palabra of palabras) {
//       const content = palabra;

//       const chunk_custom_graph = {
//         id: id,
//         object: "chat.completion.chunk",
//         created: "",
//         model: "gpt-4-o",
//         service_tier: "default",
//         system_fingerprint: "fp_18cc0f1fa0",
//         choices: [
//           {
//             index: 0,
//             delta: {
//               content: content,
//             },
//             logprobs: null,
//             finish_reason: null,
//           },
//         ],
//       };

//       res.write(`data: ${JSON.stringify(chunk_custom_graph)}\n\n`);
//       await new Promise((r) => setTimeout(r, streamingDelay)); // simula el stream
//     }

//     res.write("data: [DONE]\n\n");

//   }
// ------------------------------------------------------------------
//     for await (const chunk of completionStream) {
//         console.log(chunk[0].invalid_tool_calls.length);

//       const { id, content } = chunk[0];
//       const { ls_model_name } = chunk[1];
//   const chunk_custom_graph = {
//     id: id,
//     object: "chat.completion.chunk",
//     created: "",
//     model: ls_model_name,
//     service_tier: "default",
//     system_fingerprint: "fp_18cc0f1fa0",
//     choices: [
//       {
//         index: 0,
//         delta: {
//           content: content,
//         },
//         logprobs: null,
//         finish_reason: null,
//       },
//     ],
//   };

//       res.write(`data: ${JSON.stringify(chunk_custom_graph)}\n\n`);
//     }

//     res.write("data: [DONE]\n\n");
//     res.end();
//   } else {
//     const completion = await openai.chat.completions.create({
//       model,
//       messages,
//       temperature,
//       max_tokens,
//       user: user_id,
//     });

//     res.json(completion);
// }

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
