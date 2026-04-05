import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { mongoClient } from "../server";
import { ObjectId } from "mongodb";
import express from "express";
import { PackId, ALL_PACKS } from "../models/User";

const router = Router();

let stripe: Stripe;
const getStripe = () => {
    if (!stripe) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
            apiVersion: "2026-03-25.dahlia"
        });
    }
    return stripe;
};

/**
 * Selecciona un pack al azar de los que el usuario NO tiene todavía.
 * Si ya tiene todos, retorna null.
 */
function getRandomPackForUser(ownedPacks: PackId[]): PackId | null {
    const available = ALL_PACKS.filter(p => !ownedPacks.includes(p));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}

router.post("/", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    let event;

    try {
        event = getStripe().webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET || ""
        );
    } catch (err: any) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const metadata = session.metadata || {};

        if (!userId) {
            res.status(200).json({ received: true });
            return;
        }

        const collection = mongoClient.db("fnsm").collection("users");

        // ── CASO 1: Compra de pack individual ──────────────────────────────
        if (metadata.type === "pack_purchase" && metadata.packId) {
            const packId = metadata.packId as PackId;
            try {
                await collection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $addToSet: { ownedPacks: packId } }
                );
                console.log(`Pack '${packId}' añadido a usuario ${userId}`);
            } catch (dbError) {
                console.error("Error al registrar pack comprado:", dbError);
            }

            res.status(200).json({ received: true });
            return;
        }

        // ── CASO 2: Compra de plan de suscripción ──────────────────────────
        const amount_total = session.amount_total;
        let plan: string | null = null;

        if (amount_total === 5000) {
            plan = "plata"; // $50 pesos
        } else if (amount_total === 7500) {
            plan = "oro";   // $75 pesos
        }

        if (plan) {
            try {
                const user = await collection.findOne({ _id: new ObjectId(userId) });
                const ownedPacks: PackId[] = (user?.ownedPacks as PackId[]) || [];

                const updateFields: Record<string, any> = {
                    plan,
                    hasLifetimeAccess: true,
                };

                if (plan === "plata") {
                    // Asignar 1 pack al azar (de los que aún no tiene)
                    const randomPack = getRandomPackForUser(ownedPacks);
                    if (randomPack) {
                        await collection.updateOne(
                            { _id: new ObjectId(userId) },
                            {
                                $set: updateFields,
                                $addToSet: { ownedPacks: randomPack }
                            }
                        );
                        console.log(`Usuario ${userId} → plan plata | pack regalo: '${randomPack}'`);
                    } else {
                        // Ya tiene todos los packs, solo actualizar plan
                        await collection.updateOne(
                            { _id: new ObjectId(userId) },
                            { $set: updateFields }
                        );
                        console.log(`Usuario ${userId} → plan plata (ya tenía todos los packs)`);
                    }
                } else if (plan === "oro") {
                    // Asignar todos los packs
                    await collection.updateOne(
                        { _id: new ObjectId(userId) },
                        {
                            $set: {
                                ...updateFields,
                                ownedPacks: ALL_PACKS
                            }
                        }
                    );
                    console.log(`Usuario ${userId} → plan oro | todos los packs asignados`);
                }
            } catch (dbError) {
                console.error("Error al actualizar plan/packs:", dbError);
            }
        }
    }

    res.status(200).json({ received: true });
});

export default router;
