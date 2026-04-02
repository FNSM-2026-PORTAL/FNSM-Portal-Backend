import { Router, Response } from "express";
import { ObjectId } from "mongodb";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { mongoClient } from "../server";
import { Plan } from "../models/Plan";

const router = Router();

const PLAN_LIMITS: Record<string, number> = {
    free: 3,
    plata: 6,
    oro: 10,
};

// POST /api/plans — Crear un nuevo plan
router.post("/", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "No autorizado." });
            return;
        }

        const usersCollection = mongoClient.db("fnsm").collection("users");
        const plansCollection = mongoClient.db("fnsm").collection<Plan>("plans");

        // Obtener datos del usuario para saber su plan de suscripción
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado." });
            return;
        }

        const userPlan = (user.plan as string)?.toLowerCase() || "free";
        const limit = PLAN_LIMITS[userPlan] ?? 3;

        // Contar cuántos planes ya tiene este usuario
        const existingCount = await plansCollection.countDocuments({ authorId: userId });
        if (existingCount >= limit) {
            res.status(403).json({
                message: `Has alcanzado el límite de ${limit} planes para tu suscripción ${userPlan}.`,
                limit,
                current: existingCount,
            });
            return;
        }

        const { name, style, activityCount, activities, date, time, location, recommendation } = req.body;

        // Validaciones básicas
        if (!name || !style || !activities || !date || !time || !location) {
            res.status(400).json({ message: "Faltan campos obligatorios." });
            return;
        }

        const newPlan: Plan = {
            authorId: userId,
            authorName: user.nombre || "Explorador FNSM",
            name,
            style,
            activityCount: activityCount ?? activities.length,
            activities,
            date,
            time,
            location,
            recommendation: recommendation || "",
            createdAt: new Date(),
        };

        const result = await plansCollection.insertOne(newPlan);

        res.status(201).json({
            message: "Plan creado con éxito.",
            plan: { ...newPlan, _id: result.insertedId },
        });
    } catch (error: any) {
        console.error("Error al crear plan:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor." });
    }
});

// GET /api/plans/my-plans — Obtener todos los planes del usuario autenticado
router.get("/my-plans", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "No autorizado." });
            return;
        }

        const plansCollection = mongoClient.db("fnsm").collection<Plan>("plans");
        const plans = await plansCollection
            .find({ authorId: userId })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).json({ plans });
    } catch (error: any) {
        console.error("Error al obtener planes:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor." });
    }
});

// DELETE /api/plans/:id — Eliminar un plan del usuario autenticado
router.delete("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "No autorizado." });
            return;
        }

        const planId = req.params.id as string;
        if (!ObjectId.isValid(planId)) {
            res.status(400).json({ message: "ID de plan inválido." });
            return;
        }

        const plansCollection = mongoClient.db("fnsm").collection<Plan>("plans");

        // Solo el autor puede eliminar su plan
        const result = await plansCollection.deleteOne({
            _id: new ObjectId(planId),
            authorId: userId,
        });

        if (result.deletedCount === 0) {
            res.status(404).json({ message: "Plan no encontrado o no tienes permiso para eliminarlo." });
            return;
        }

        res.status(200).json({ message: "Plan eliminado con éxito." });
    } catch (error: any) {
        console.error("Error al eliminar plan:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor." });
    }
});

export default router;
