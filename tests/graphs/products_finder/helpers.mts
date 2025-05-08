import { fromPairs, toPairs } from "lodash-es";
import z from "zod";
import { ConditionSchema } from "./schemas.mjs";

/**
 * Genera un filtro de consulta en el formato esperado por Pinecone a partir de un objeto de consulta.
 * @param rawQuery - Objeto de consulta que contiene las propiedades y condiciones de la consulta.
 * @returns
 */
export const buildFilter = <T extends Record<string, any>>(rawQuery: T) => {
  const queryPairs = toPairs(rawQuery) 
    .filter(([key, value]) => value !== null)
    .map(([key, conditions]) => {
      const value = fromPairs(
        (conditions as z.infer<typeof ConditionSchema>[]).map(
          ({ operator, value }) => [operator, value],
        ),
      );
      return [key, value];
    });

  return fromPairs(queryPairs); 
};


export const contextPrompt = `

  Tu zona de trabajo se centra en la provincia de Barcelona, especialmente en el área del Baix Llobregat, incluyendo las siguientes localidades: Gavà, Castelldefels, Viladecans, El Prat de Llobregat, Sant Boi de Llobregat, Cornellà de Llobregat, L’Hospitalet de Llobregat, y ocasionalmente Barcelona ciudad. A continuación, se detalla información clave para cada zona que te ayudará a asesorar mejor según las preferencias del cliente:

 Castelldefels
 Cerca del mar, cuenta con una de las mejores playas del área metropolitana de Barcelona.

 Zona residencial de alto nivel, muy demandada por familias y expatriados.

 Buen equilibrio entre naturaleza (Parque Natural del Garraf) y servicios.

 Buenas conexiones con Barcelona (tren 25 min aprox.).

Ideal para quienes buscan tranquilidad, cercanía al mar y calidad de vida.

### Gavà
 También junto al mar (Gavà Mar), con urbanizaciones exclusivas.

 Más tranquilo que Castelldefels, pero con un perfil similar en algunas zonas.

 Próximo a colegios internacionales.

👨‍👩‍👧 Muy valorado por familias y compradores con alto poder adquisitivo.

Conectividad buena pero no tan directa como Castelldefels.

### Viladecans
 No está directamente frente al mar, aunque tiene acceso cercano a la costa.

 Zona más urbana y accesible económicamente.
 Cuenta con un gran centro comercial (Viladecans The Style Outlets).
Perfil de familias jóvenes, clase media.

 Buena conexión con transporte público y accesos a Barcelona.

### El Prat de Llobregat
Zona próxima al aeropuerto (ideal para quienes viajan frecuentemente).

Dispone de zonas verdes como el Delta del Llobregat.

Perfil más urbano y económico, con buena oferta de servicios.

No es zona de playa, aunque está próxima al mar.

Conectividad excelente con trenes, metro y autopistas.

### Sant Boi de Llobregat
Zona más interior, sin playa pero con buena calidad de vida.

Mayor oferta de viviendas con espacio (chalets, casas adosadas).

 Ideal para quienes buscan un entorno más tranquilo y familiar.

 Buena conexión en transporte público.

Precio medio-bajo en comparación con zonas costeras.

Cornellà de Llobregat
Más urbana, próxima a zonas industriales y comerciales.

Muchos pisos, menos zonas verdes o residenciales.

Ideal para trabajadores que buscan cercanía con Barcelona a precios accesibles.

Conexión directa en metro (L5) y tren.

### L’Hospitalet de Llobregat
Ciudad densa y urbana, segunda más poblada de Cataluña.

Muy próxima a Barcelona, ideal para quien trabaja en la ciudad.

Precios aún algo más bajos que en Barcelona pero subiendo.

Gran conectividad con metro y tren.

Buen punto de entrada para inversores o compradores primerizos.

### Barcelona Ciudad (opcional, sólo en algunos casos)
Playas, vida cultural y laboral muy activa.

 Precios elevados, especialmente en zonas como Eixample, Gràcia, Les Corts, etc.

Ideal para perfiles profesionales o jóvenes que buscan vida urbana intensa.
`
