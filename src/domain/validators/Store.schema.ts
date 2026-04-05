import { z } from 'zod';

export const createStoreSchema = z.object({
    body: z.object({
        name: z.string().min(3, "El nombre es muy corto"),
        description: z.string().max(500).optional(),
        category: z.enum(['ALIMENTOS', 'BEBIDAS_Y_NOCHE', 'COMERCIO', 'ENTRETENIMIENTO', 'SERVICIOS', 'CULTURA', 'COMPRAS']),
        venueType: z.enum(['STAND', 'AMBULANTE', 'LOCAL_FIJO', 'MARCA_PREMIUM']),
        lat: z.string().refine(v => !isNaN(parseFloat(v)), "Latitud inválida"),
        lng: z.string().refine(v => !isNaN(parseFloat(v)), "Longitud inválida"),
        // logo viene como archivo, no se valida aquí
    })
});