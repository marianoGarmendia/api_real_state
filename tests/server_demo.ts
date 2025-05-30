// import express from "express";
// import cors from "cors";
// import { dirname } from "path";
// import { fileURLToPath } from "url";

// // import { processAudioElevenLabs } from "./procesing-voices/text-to-speech.js";
// // import { ensureToolCallsHaveResponses } from "./ensure-tool-response.ts";

// const __filename = fileURLToPath(import.meta.url);
// console.log("filename: ", __filename);

// const __dirname = dirname(__filename);
// console.log("dirname: ", __dirname);

// import { workflow } from "./graphs/inmo.mjs";
// import { AIMessage } from "@langchain/core/messages";

// const app = express();
// app.use(express.json());
// app.use(cors());

// const PORT = process.env.PORT || 5000;

// const threadLocks = new Map<string, boolean>();
// const threadControllers = new Map<string, AbortController>();

// app.post("/v1/chat/completions", async (req, res) => {
//     console.log("[POST] /v1/chat/completions body:", req.body);
    
//   const { messages , stream } = req.body;
//   const last_message = messages.at(-1);
//   const thread_id = "158863656"; // idealmente recibido desde el cliente

//   if (last_message.role !== "user") {
//     res.write(
//       `event: error\ndata: ${JSON.stringify({ message: "El último mensaje debe ser del usuario" })}\n\n`,
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

//   const heartbeat = setInterval(() => res.write(`: ping\n\n`), 2000);

//   req.on("close", () => {
//     console.log("[SSE] Cliente/proxy cerró la conexión");
//     clearInterval(heartbeat);
//     threadLocks.set(thread_id, false);
//     const controller = threadControllers.get(thread_id);
//     controller?.abort();
//   });

//   res.on("error", (err) => {
//     console.error("[SSE] Error en el stream:", err);
//     clearInterval(heartbeat);
//     threadLocks.set(thread_id, false);
//   });

//   // 🔁 Cancelar flujo anterior si existe
//   if (threadControllers.has(thread_id)) {
//     console.log("[Interrupción] Abortando operación previa...");
//     threadControllers.get(thread_id)!.abort();
//     threadControllers.delete(thread_id);
//   }

//   // 🔒 Verificar si otro flujo está en curso
//   if (threadLocks.get(thread_id)) {
//     res.write(
//       `event: error\ndata: ${JSON.stringify({ message: "Estoy procesando una solicitud anterior" })}\n\n`,
//     );
//     res.write("data: [DONE]\n\n");
//     return;
//   }

//   const controller = new AbortController();
//   threadControllers.set(thread_id, controller);
//   threadLocks.set(thread_id, true);

//   try {
//     let state = await workflow.invoke(
//       { messages: last_message },
//       { configurable: { thread_id }, signal: controller.signal },
//     );

//     let finalReply = "";
//     let done = false;

//     while (!done) {
//       const last = state.messages.at(-1);
//       console.log("[Agente] Último mensaje:", last);
//       console.log("contendo:", last?.content);

//       if (!last) {
//         console.warn("[Agente] No hay mensaje final, cerrando.");
//         break;
//       }

//       if (controller.signal.aborted)
//         throw new Error("Abortado por nueva entrada");

//       if (last instanceof AIMessage) {
//         if (last.tool_calls?.length && !last.content) {
//           console.log("[Agente] Llamadas a herramientas iniciadas");

//           // 🔊 Emitimos un mensaje temporal al frontend
//           const tempChunk = {
//             id: Date.now().toString(),
//             object: "chat.completion.chunk",
//             created: Math.floor(Date.now() / 1000),
//             model: "gpt-4-o",
//             choices: [
//               {
//                 index: 0,
//                 delta: {
//                   role: "assistant",
//                   content:
//                     "Entendido. Estoy buscando esa información, por favor espera un momento.",
//                 },
//                 finish_reason: null,
//               },
//             ],
//           };
//           res.write(`data: ${JSON.stringify(tempChunk)}\n\n`);

//           console.log("invokando al agente con [] para continuar el hilo");

//           // Esperamos nuevo mensaje del agente
//           state = await workflow.invoke(
//             { messages: [] }, // langgraph continúa el hilo solo con el thread_id
//             { configurable: { thread_id }, signal: controller.signal },
//           );
//           continue;
//         }
//       }

//       if (last instanceof AIMessage && last.content) {
//         finalReply = last.content as string;
//         done = true;
//         break;
//       } else {
//         console.warn("[Agente] No se obtuvo respuesta útil.");
//         done = true;
//       }
//     }

//     if (finalReply !== "") {
//       const chunk = {
//         id: Date.now().toString(),
//         object: "chat.completion.chunk",
//         created: Math.floor(Date.now() / 1000),
//         model: "gpt-4-o",
//         choices: [
//           {
//             index: 0,
//             delta: { role: "assistant", content: finalReply },
//             finish_reason: "stop",
//           },
//         ],
//       };

//       res.write(`data: ${JSON.stringify(chunk)}\n\n`);
//       res.write("data: [DONE]\n\n");
//     } else {
//       res.write("data: [DONE]\n\n");
//     }
//   } catch (err: any) {
//     if (err.name === "AbortError" || err.message.includes("Abortado")) {
//       console.log("[Cancelado] Flujo abortado correctamente");
//     } else {
//       console.error("Error en /v1/chat/completions:", err);
//       res.write(
//         `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`,
//       );
//       res.write("data: [DONE]\n\n");
//     }
//   } finally {
//     clearInterval(heartbeat);
//     threadLocks.set(thread_id, false);
//     threadControllers.delete(thread_id);
//     res.end();
//   }
// });

// // Iniciar el servidor
// app.listen(PORT, () => {
//   console.log(`Servidor corriendo en http://localhost:${PORT}`);
// });
