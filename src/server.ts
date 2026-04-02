import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "path";
import authRoutes from "./routes/auth.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import webhookRoutes from "./routes/webhook.routes";
import postRoutes from "./routes/post.routes";
import planRoutes from "./routes/plan.routes";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir cualquier origen en desarrollo
      if (!origin) return callback(null, true);

      // Permitir localhost para desarrollo
      if (origin.includes("localhost")) return callback(null, true);

      // Permitir el dominio de producción
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        "http://localhost:4321",
        "http://localhost:3000",
        "http://localhost:5173",
      ];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("/api/webhook", webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (req, res) => {
  res.json({ 
    message: "API Working", 
    timestamp: new Date().toISOString(),
    status: "healthy"
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/plans", planRoutes);

if (!process.env.MONGODB_URI) {
  throw new Error("Please provide a MongoDB URI");
}

export const mongoClient = new MongoClient(process.env.MONGODB_URI, {
    ssl: true,
    tls: true,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 20000,
    maxPoolSize: 10,
    minPoolSize: 1
});

async function start() {
  try {
    await mongoClient.connect();
    console.log("MongoDB conectado");

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error);
    process.exit(1);
  }
}

start();

export default app;
