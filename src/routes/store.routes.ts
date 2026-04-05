import { Router, Response } from "express";
import { mongoClient } from "../server";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validateResource } from "../middleware/validateResource";
import { createStoreSchema } from "../domain/validators/Store.schema";
import { sendStoreNotification } from "../services/emailService";

const router = Router();

const getCollection = () => mongoClient.db("fnsm").collection("stores");

// POST /api/stores
// verifyToken → validateResource → upload → handler
// igual que Spring: @Valid antes del @RequestBody
router.post(
    "/",
    verifyToken,
    upload.single("photo"),
    validateResource(createStoreSchema),
    async (req: AuthRequest, res: Response) => {
        try {
            const { name, description, category, venueType, lat, lng } = req.body;

            const logoUrl = req.file ? `/uploads/${req.file.filename}` : "";

            const newStore = {
                name,
                description,
                logo: logoUrl,
                category,
                venueType,
                // GeoJSON igual que el modelo Store.ts
                location: {
                    type: "Point" as const,
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                payment_status: {
                    status: "FREE_TIER",
                    isExpired: false,
                },
                status: "PENDIENTE",
                ownerId: req.user?.userId,
                createdAt: new Date()
            };

            await getCollection().insertOne(newStore);
            await sendStoreNotification({ ...newStore, lat, lng });

            res.status(201).json({
                message: "Solicitud enviada correctamente",
                store: newStore
            });

        } catch (error) {
            console.error("Error al registrar negocio:", error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    }
);

export default router;