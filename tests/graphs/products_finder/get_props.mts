import fetch from "node-fetch";
import { writeFile } from "fs/promises";
import https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false, // ⚠️ Ignora errores de certificado SSL
});

async function descargarPropiedades() {
//   const url = "https://www.propiedades.techbank.ai:4001/public/productos";
  const url = "https://propiedades_test.techbank.ai:4002/public/productos?limit=1000"

  try {
    const response = await fetch(url, { agent });
    if (!response.ok) {
      throw new Error(`Error en la respuesta: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    await writeFile("propiedades.json", JSON.stringify(data, null, 2), "utf-8");
    console.log("Propiedades guardadas exitosamente en propiedades.json");
  } catch (error) {
    console.error("Error al descargar o guardar las propiedades:", error);
  }
}

descargarPropiedades();
