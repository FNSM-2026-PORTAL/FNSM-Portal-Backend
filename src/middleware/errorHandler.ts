import { Request, Response, NextFunction } from "express";

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error("Error no manejado:", err);

    // Error de multer — archivo muy grande o tipo inválido
    if (err.message.includes("Solo se permiten imágenes")) {
        res.status(400).json({ message: err.message });
        return;
    }

    if (err.message.includes("File too large")) {
        res.status(400).json({ message: "La imagen no puede superar 5MB" });
        return;
    }

    res.status(500).json({ message: "Error interno del servidor" });
};