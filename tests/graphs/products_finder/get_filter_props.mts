import fetch from "node-fetch";
import https from "https";
import fs from "fs";
import PDFDocument from "pdfkit";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

type Propiedad = any;

async function descargarPropiedades() {
  const url = "https://propiedades_test.techbank.ai:4002/public/productos?limit=1000";

  try {
    const response = await fetch(url, { agent });
    if (!response.ok) {
      throw new Error(`Error en la respuesta: ${response.status} ${response.statusText}`);
    }

    const propiedades: Propiedad[] = await response.json();

    const propiedadesFiltradas = propiedades
      .filter((p) => p?.PRODUCT_PROPS?.estado === "Disponible")
      .map((p) => {
        const props = p.PRODUCT_PROPS;
        return {
          ref: props.ref,
          zona: props.zona,
          provincia: props.provincia,
          codigo_postal: props.codigo_postal,
          precio: `${props.precio} ${props.moneda}`,
          dormitorios: props.dormitorios,
          banios: props.banios,
          superficie: props?.superficie?.built || "N/A",
          piscina: props.piscina === "1" ? "Sí" : "No",
          estado: props.estado,
          descripcion: props.descripcion,
          geolocalizacion: props.geolocalizacion,
          imagen: p.R_IMG?.[0]?.LOCATION || null
        };
      });

    await generarPDF(propiedadesFiltradas);
    console.log("PDF generado correctamente");

  } catch (error) {
    console.error("Error al procesar propiedades:", error);
  }
}

async function generarPDF(propiedades: any[]) {
  const doc = new PDFDocument({ margin: 30 });
  const stream = fs.createWriteStream("propiedades_filtradas.pdf");
  doc.pipe(stream);

  doc.fontSize(20).text("Propiedades Disponibles", { align: "center" }).moveDown();

  propiedades.forEach((p, index) => {
    doc
      .fontSize(14)
      .text(`Referencia: ${p.ref}`)
      .text(`Zona: ${p.zona}, Provincia: ${p.provincia} (${p.codigo_postal})`)
      .text(`Precio: ${p.precio}`)
      .text(`Dormitorios: ${p.dormitorios}, Baños: ${p.banios}`)
      .text(`Superficie construida: ${p.superficie} m2`)
      .text(`Piscina: ${p.piscina}`)
      .text(`Descripción: ${p.descripcion}`)
      .moveDown();

    if (p.imagen) {
      try {
        doc.image(p.imagen, { fit: [500, 300] }).moveDown();
      } catch {
        doc.text("[Imagen no disponible]").moveDown();
      }
    }

    if (index < propiedades.length - 1) {
      doc.addPage();
    }
  });

  doc.end();
}
descargarPropiedades();
