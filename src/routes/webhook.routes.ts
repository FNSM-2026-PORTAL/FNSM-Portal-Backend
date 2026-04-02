import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { mongoClient } from "../server";
import { ObjectId } from "mongodb";
import express from "express";

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

// Express raw body parser ONLY for Stripe validation.
router.post("/", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    let event;

    try {
        event = getStripe().webhooks.constructEvent(
            req.body, // This is the raw buffer from express.raw()
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

        // Recuperamos el userId que inyectamos antes del pago
        const userId = session.client_reference_id; 

        if (userId) {
            // Asigna el plan con base al monto pagado: 50 pesos = plata, 150 pesos = oro
            const amount_total = session.amount_total;
            let plan = null;

            if (amount_total === 5000) {
                plan = "plata";
            } else if (amount_total === 7500) {
                plan = "oro";
            }

            if (plan) {
                try {
                    const collection = mongoClient.db("fnsm").collection("users");
                    await collection.updateOne(
                        { _id: new ObjectId(userId) },
                        { $set: { plan: plan, hasLifetimeAccess: true } }
                    );
                    console.log(`Usuario ${userId} actualizado a plan ${plan} vitalicio con éxito en MongoDB.`);
                } catch (dbError) {
                    console.error("Error al actualizar la base de datos tras pago:", dbError);
                }
            }
        }
    }

    res.status(200).json({ received: true });
});

export default router;
