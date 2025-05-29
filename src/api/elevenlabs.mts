// api/elevenlabs.mts
import { Hono } from "hono";
// import { zValidator } from "@hono/zod-validator";
// import { z } from "zod";

const elevenlabs = new Hono();

// elevenlabs.post(
//   "/v1/chat/completions",
//   zValidator(
//     "json",
//     z.object({
//       messages: z.array(
//         z.object({
//           role: z.enum(["user", "assistant", "tool"]),
//           content: z.string().optional(),
//         })
//       ),
//       stream: z.boolean().optional(),
//     })
//   ),
//   async (c) => {
//     const { messages, stream } = c.req.valid("json");

//     if (!stream) {
//       return c.json({ error: "Solo soporta stream=true" }, 400);
//     }

//     const lastMessage = messages.at(-1);
//     if (!lastMessage || lastMessage.role !== "user") {
//       return new Response(
//         `event: error\ndata: ${JSON.stringify({
//           message: "El último mensaje debe ser del usuario",
//         })}\n\ndata: [DONE]\n\n`,
//         {
//           status: 400,
//           headers: {
//             "Content-Type": "text/event-stream",
//           },
//         }
//       );
//     }

//     const streamBody = new ReadableStream({
//       start(controller) {
//         controller.enqueue(
//           new TextEncoder().encode(
//             `data: ${JSON.stringify({
//               id: Date.now().toString(),
//               object: "chat.completion.chunk",
//               created: Math.floor(Date.now() / 1000),
//               model: "gpt-4-o",
//               choices: [
//                 {
//                   index: 0,
//                   delta: { role: "assistant", content: "Respuesta simulada 🎤" },
//                   finish_reason: "stop",
//                 },
//               ],
//             })}\n\n`
//           )
//         );
//         controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
//         controller.close();
//       },
//     });

//     return new Response(streamBody, {
//       headers: {
//         "Content-Type": "text/event-stream",
//         "Cache-Control": "no-cache",
//         Connection: "keep-alive",
//       },
//     });
//   }
// );

import { workflow } from "../../tests/graphs/inmo.mjs"; // Asegúrate de que la ruta sea correcta


const threadLocks = new Map<string, boolean>();

elevenlabs.post("/v1/chat/completions", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch (err) {
    return c.json({ error: "Body inválido" }, 400);
  }

  const { messages, stream } = body;
  console.log("[POST] /v1/chat/completions body messages:", body["messages"].at(-1));
  console.log("stream:", stream);
  

  if (!stream) {
    return c.json({ error: "Solo soporta stream=true" }, 400);
  }

  const last_message = messages?.at(-1);
  if (!last_message || last_message.role !== "user") {
    return new Response(
      `event: error\ndata: ${JSON.stringify({
        message: "El último mensaje debe ser del usuario",
      })}\n\ndata: [DONE]\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
        },
        status: 400,
      },
    );
  }

  const streamResponse = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const thread_id = "477";

      if (threadLocks.get(thread_id)) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message: "Espera un momento, estoy procesando información",
            })}\n\ndata: [DONE]\n\n`,
          ),
        );
        controller.close();
        return;
      }

      threadLocks.set(thread_id, true);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 2000);

      try {
        console.log("Invocando workflow con el último mensaje:", last_message);
        
        const agentResp = await workflow.invoke(
          { messages: last_message },
          { configurable: { thread_id } },
        );

        const reply = agentResp.messages.at(-1)?.content;
        console.log("agentResp:", agentResp);
        console.log("reply:", reply);
        
        
        

        const chunk = {
          id: Date.now().toString(),
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "gpt-4-o",
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                content:
                  reply === ""
                    ? "Muy bien, voy a realizar la búsqueda espera un momento por favor"
                    : reply,
                  
              },
              finish_reason: "stop",
            },
          ],
        };


        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message: err.message,
            })}\n\ndata: [DONE]\n\n`,
          ),
        );
      } finally {
        threadLocks.set(thread_id, false);
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(streamResponse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

console.log("[✔️] Endpoint ElevenLabs cargado");

export default elevenlabs;
