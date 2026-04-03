// src/routes/store.routes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth"; // El que ya usas
import multer from "multer";
import { uploadToR2 } from "../services/r2Service"; // Tu lógica de R2
import { getCollection } from "../db/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", verifyToken, upload.single("logo"), async (req: any, res: any) => {
    try {
        const { name, description, category, venueType, lat, lng } = req.body;

        // 1. Validaciones básicas
        if (!name || !lat || !lng) {
            return res.status(400).json({ message: "Nombre y ubicación son obligatorios" });
        }

        // 2. Subir a R2 si hay archivo
        let logoUrl = "";
        if (req.file) {
            logoUrl = await uploadToR2(req.file);
        }

        // 3. Guardar en MongoDB con status 'PENDIENTE'
        const collection = getCollection("stores");
        const newStore = {
            name,
            description,
            category,
            venueType,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            logo: logoUrl,
            status: "PENDIENTE", // <--- Clave para tu flujo de aprobación
            ownerId: req.userId, // ID del usuario que lo registra
            createdAt: new Date()
        };

        await collection.insertOne(newStore);

        // 4. TODO: Aquí llamarías a tu servicio de Email (Nodemailer)
        // enviarCorreoAviso(newStore);

        res.status(201).json({ message: "Solicitud enviada correctamente", store: newStore });

    } catch (error) {
        console.error("Error al registrar negocio:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

export default router;