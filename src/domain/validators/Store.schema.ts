import { z } from 'zod';

export const createStoreSchema = z.object({
  body: z.object({
    name: z.string().min(3, "El nombre es muy corto"),
    description: z.string().max(500),
    logo: z.string().url("El logo debe ser una URL válida"),
    category: z.enum(['ALIMENTOS', 'BEBIDAS_Y_NOCHE', 'COMERCIO', 'ENTRETENIMIENTO', 'SERVICIOS', 'CULTURA', 'COMPRAS']),
    venueType: z.enum(['STAND', 'AMBULANTE', 'LOCAL_FIJO', 'MARCA_PREMIUM']),
    location: z.object({
      lng: z.number().min(-180).max(180),
      lat: z.number().min(-90).max(90)
    })
  })
});