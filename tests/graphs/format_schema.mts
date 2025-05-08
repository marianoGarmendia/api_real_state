import { z } from "zod"
import { ChatOpenAI } from "@langchain/openai"
import dotenv from "dotenv"
dotenv.config()


export const formatSchema = async (toolArgs:any) => {
   const  schema = z.object({
          prompt: z
            .string()
            .describe("Consulta del usuario sobre el producto buscado"),
          props: z
            .array(z.string())
            .describe("Atributos del producto que se pueden filtrar"),
        })

        const llm = new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            temperature: 0.7,
            model: "gpt-4o",
        }).withStructuredOutput(schema).withConfig({tags: ["nostream"]});


        const prompt = `En base a los siguiente argumentos de busqueda dame una repsuesta completa los campos:
            prompt: 'Consulta del usuario sobre el producto buscado',
            props: 'Atributos del producto que se pueden filtrar',

            los argumentos de busqueda del ususario son: ${JSON.stringify(toolArgs)}
        `

        const response = await llm.invoke(prompt)

        console.log("response", response)
        
        return response;
        




}