import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod'; // Cambia AnyZodObject por ZodSchema

export const validate = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // ZodSchema tiene el método .parse, así que esto funcionará perfecto
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (e: any) {
      if (e instanceof ZodError) {
        return res.status(400).json({
          status: "fail",
          errors: e.issues.map((err) => ({
            // Usamos una validación simple por si el path está vacío
            field: err.path.length > 1 ? err.path[1] : err.path[0],
            message: err.message,
          })),
        });
      }
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };