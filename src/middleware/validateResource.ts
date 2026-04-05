import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodError } from "zod";

export const validateResource = (schema: ZodObject) => 
    (req: Request, res: Response, next: NextFunction): void => {
        try {
            schema.parse({ body: req.body, params: req.params, query: req.query });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    message: "Error de validación",
                    errors: error.issues.map(e => ({
                        field: e.path.join("."),
                        message: e.message
                    }))
                });
                return;
            }
            next(error);
        }
    };