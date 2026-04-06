import { Router, Response } from "express";
import Stripe from "stripe";
import { mongoClient } from "../server";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { ObjectId } from "mongodb";
import { User, PackId, ALL_PACKS } from "../models/User";

const router = Router();

const PACK_PRICE = 2500; // $25.00 MXN en centavos

const PACK_NAMES: Record<PackId, string> = {
    juegos: "Paquete Orgullo de Feria",
    toros: "Paquete Fiesta Brava",
    conciertos: "Paquete Noches de Foro",
};

let stripe: Stripe;
const getStripe = () => {
    if (!stripe) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
            apiVersion: "2026-03-25.dahlia",
        });
    }
    return stripe;
};

const getCollection = () =>
    mongoClient.db("fnsm").collection<User>("users");

// GET /api/store/my-packs
// Devuelve los packs que posee el usuario con validación server-side
router.get("/my-packs", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "Usuario no autenticado" });
            return;
        }

        const user = await getCollection().findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        const plan = user.plan || "free";

        // Determinar packs que realmente posee según el plan
        let ownedPacks: PackId[] =
            plan === "oro" || user.role === "seller"
                ? [...ALL_PACKS]
                : [...(user.ownedPacks || [])];

        // Plata sin ningún pack asignado → darle uno al azar gratis (primer fetch)
        if (plan === "plata" && ownedPacks.length === 0) {
            const randomPack = ALL_PACKS[Math.floor(Math.random() * ALL_PACKS.length)];
            await getCollection().updateOne(
                { _id: user._id },
                { $addToSet: { ownedPacks: randomPack } }
            );
            ownedPacks.push(randomPack);
            console.log(`Pack regalo asignado a usuario plata ${userId}: '${randomPack}'`);
        }

        // equippedPack solo es válido si el usuario todavía posee ese pack
        const equippedPack: PackId | null =
            user.equippedPack && ownedPacks.includes(user.equippedPack)
                ? user.equippedPack
                : null;

        // Si el equipped guardado ya no es válido, limpiarlo en DB
        if (user.equippedPack && !equippedPack) {
            await getCollection().updateOne(
                { _id: user._id },
                { $unset: { equippedPack: "" } }
            );
            console.log(`equippedPack inválido limpiado para usuario ${userId}`);
        }

        res.status(200).json({ plan, ownedPacks, equippedPack });
    } catch (error) {
        console.error("Error al obtener packs:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});


router.post("/buy", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ message: "Usuario no autenticado" });
            return;
        }

        const { packId } = req.body as { packId: PackId };

        if (!packId || !ALL_PACKS.includes(packId)) {
            res.status(400).json({ message: "Pack inválido. Debe ser 'juegos', 'toros' o 'conciertos'." });
            return;
        }

        const user = await getCollection().findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        const plan = user.plan || "free";

        // Oro y seller no necesitan comprar nada
        if (plan === "oro" || user.role === "seller") {
            res.status(400).json({ message: "Tu plan ya incluye todos los packs." });
            return;
        }

        // Verificar que no lo tenga ya
        const alreadyOwned = (user.ownedPacks || []).includes(packId);
        if (alreadyOwned) {
            res.status(400).json({ message: "Ya tienes este pack." });
            return;
        }

        // Crear sesión de Stripe
        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "mxn",
                        product_data: {
                            name: PACK_NAMES[packId],
                            description: "Pack exclusivo de Feria Hub 2026",
                        },
                        unit_amount: PACK_PRICE,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/perfil`,
            client_reference_id: userId,
            metadata: {
                type: "pack_purchase",
                packId: packId,
            },
        });

        res.status(200).json({ url: session.url });
    } catch (error: any) {
        console.error("Error al crear sesión de compra de pack:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor" });
    }
});

// PUT /api/store/equip
// Equipa (o desequipa) un pack para el usuario
router.put("/equip", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) { res.status(401).json({ message: "No autenticado" }); return; }

        const { packId } = req.body as { packId: PackId | null };

        // null = desequipar
        if (packId !== null && !ALL_PACKS.includes(packId)) {
            res.status(400).json({ message: "Pack inválido" });
            return;
        }

        if (packId !== null) {
            const user = await getCollection().findOne({ _id: new ObjectId(userId) });
            if (!user) { res.status(404).json({ message: "Usuario no encontrado" }); return; }

            const plan = user.plan || "free";
            const isAllowed =
                plan === "oro" ||
                user.role === "seller" ||
                (user.ownedPacks || []).includes(packId);

            if (!isAllowed) {
                res.status(403).json({ message: "No tienes este pack" });
                return;
            }
        }

        await getCollection().updateOne(
            { _id: new ObjectId(userId) },
            { $set: { equippedPack: packId } }
        );

        res.status(200).json({ equippedPack: packId });
    } catch (error) {
        console.error("Error al equipar pack:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

export default router;
