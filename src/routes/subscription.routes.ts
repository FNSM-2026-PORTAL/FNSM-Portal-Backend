import { Router, Response } from "express";
import Stripe from "stripe";
import { verifyToken, AuthRequest } from "../middleware/auth";

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

const PLAN_PRICES = {
    plata: 50 * 100,
    oro: 150 * 100
};

router.post("/create-checkout-session", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { planId } = req.body;

        if (!planId || (planId !== "plata" && planId !== "oro")) {
            res.status(400).json({ message: "Plan inválido. Debe ser 'plata' o 'oro'." });
            return;
        }

        const amount = PLAN_PRICES[planId as keyof typeof PLAN_PRICES];

        const session = await getStripe().checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "mxn",
                        product_data: {
                            name: `Suscripción FERIA HUB 2026 Plan ${planId.toUpperCase()}`,
                            description: planId === "oro"
                                ? "La experiencia definitiva con colección absoluta."
                                : "Para ti que buscas una app limpia y un detalle sorpresa."
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/suscripciones`,
            client_reference_id: req.user?.userId
        });

        res.status(200).json({ url: session.url });
    } catch (error: any) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ message: error.message || "Error interno del servidor" });
    }
});

export default router;
