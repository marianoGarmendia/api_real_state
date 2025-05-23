import { tool } from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";
import {ToolMessage} from "@langchain/core/messages";
import { workflow } from "../inmo.mjs";
import { z } from "zod";

interface InfoUsuario {
    nombre: string;
    email: string;
    telefono: string;
}


export const obtener_info_usuario = tool(
    async ({ nombre, email, telefono }:InfoUsuario, config) => {

        const state = await workflow.getState({
            configurable: { thread_id: config.configurable.thread_id },
        });
        const toolCallId = state.values.messages.at(-1).tool_calls.find((call:any) => call.name === "obtener_info_usuario")?.id;
        console.log("config. ",config);
        console.log("state: ",state);

        const info_usuario = {
            nombre: nombre,
            email: email,
            telefono: telefono 
        }
        
        return new Command({
            update:{
                info_usuario: info_usuario,
                messages:[new ToolMessage("info usuario obtenida", toolCallId, "obtener_info_usuario" )]
            }
        })
    },
    {
        name: "obtener_info_usuario",
        description: "Obtener información del usuario para un futuro contacto.",
        schema: z.object({
        nombre: z.string().describe("Nombre del usuario"),
        email: z.string().describe("Email del usuario"),
        telefono: z.string().describe("Teléfono del usuario"),
        }),
    }
)