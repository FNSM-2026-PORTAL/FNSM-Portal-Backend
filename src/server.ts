import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "path";
import authRoutes from "./routes/auth.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import webhookRoutes from "./routes/webhook.routes";
import postRoutes from "./routes/post.routes";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: function (origin, callback) {
        callback(null, true);
    },
    credentials: true,
}));

app.use("/api/webhook", webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (req, res) => {
    res.json({ message: "API Working" });
});

app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/posts", postRoutes);

if (!process.env.MONGODB_URI) {
    throw new Error("Please provide a MongoDB URI");
}

export const mongoClient = new MongoClient(process.env.MONGODB_URI);

async function start() {
    try {
        await mongoClient.connect();
        console.log("MongoDB conectado");

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
        });

    } catch (error) {
        console.error("Error al conectar a la base de datos:", error);
        process.exit(1)
    }
}

start();

export default app;
