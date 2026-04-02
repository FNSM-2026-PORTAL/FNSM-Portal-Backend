import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mongoClient } from "../server";
import { User } from "../models/User";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { ObjectId } from "mongodb";
import { upload } from "../middleware/upload";
import nodemailer from "nodemailer";

const router = Router();

const getCollection = () => {
    return mongoClient.db("fnsm").collection<User>("users");
}


router.post("/register", async (req: Request, res: Response) => {
    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ message: "Nombre, email y contraseña son requeridos" });
            return;
        }

        const collection = getCollection();

        const existingUser = await collection.findOne({ email: email });
        if (existingUser) {
            res.status(409).json({ message: "Ya existe una cuenta con ese email" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser: User = {
            name,
            email,
            password: hashedPassword,
            role: "user",
            createdAt: new Date(),
            plan: "free",
            hasLifetimeAccess: false
        };

        const result = await collection.insertOne(newUser);

        const token = jwt.sign(
            { userId: result.insertedId, role: newUser.role },
            process.env.JWT_SECRET as string,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            message: "Cuenta creada exitosamente",
            token,
            user: {
                id: result.insertedId,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                profileImage: newUser.profileImage,
                plan: newUser.plan,
                hasLifetimeAccess: newUser.hasLifetimeAccess,
            },
        });

    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ message: "Email y contraseña son requeridos" });
            return;
        }

        const collection = getCollection();

        const user = await collection.findOne({ email: email });

        if (!user) {
            res.status(401).json({ message: "Credenciales inválidas" });
            return;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ message: "Credenciales inválidas" });
            return;
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            message: "Sesión iniciada correctamente",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                plan: user.plan || "free",
                hasLifetimeAccess: user.hasLifetimeAccess || false,
            },
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});


router.get("/me", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: "Usuario no autenticado" });
            return;
        }

        const collection = getCollection();
        const user = await collection.findOne({ _id: new ObjectId(userId) });

        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
                plan: user.plan || "free",
                hasLifetimeAccess: user.hasLifetimeAccess || false,
            }
        });
    } catch (error) {
        console.error("Error al obtener perfil:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.post("/changeImage", verifyToken, upload.single("image"), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: "Usuario no autenticado" });
            return;
        }

        if (!req.file) {
            res.status(400).json({ message: "No se proporcionó ninguna imagen" });
            return;
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        const collection = getCollection();

        const result = await collection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { profileImage: imageUrl } }
        );

        if (result.matchedCount === 0) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        res.status(200).json({
            message: "Imagen actualizada correctamente",
            profileImage: imageUrl
        });
    } catch (error) {
        console.error("Error al cambiar imagen:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.put("/update", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({ message: "Usuario no autenticado" });
            return;
        }

        const { name } = req.body;

        if (!name || name.trim() === "") {
            res.status(400).json({ message: "El nombre de usuario es requerido" });
            return;
        }

        const collection = getCollection();

        const existingUser = await collection.findOne({ name: name.trim() });
        if (existingUser && existingUser._id?.toString() !== userId) {
            res.status(409).json({ message: "Ese nombre de usuario ya está en uso" });
            return;
        }

        const result = await collection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { name: name.trim() } }
        );

        if (result.matchedCount === 0) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        res.status(200).json({
            message: "Usuario actualizado correctamente",
            user: { name }
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.post("/sendRecoveryCode", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ message: "El email es requerido" });
            return;
        }

        const collection = getCollection();
        const user = await collection.findOne({ email: email });

        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + 15);

        await collection.updateOne(
            { _id: user._id },
            { $set: { resetCode: code, resetCodeExpires: expires } }
        );

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Código PIN para recuperar contraseña",
            text: `Tu código PIN de recuperación es: ${code}\n\nEste código es válido por 15 minutos. Ingresa este código en la aplicación para restablecer tu contraseña.`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Código enviado correctamente" });
    } catch (error) {
        console.error("Error al enviar código:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.post("/verify-code", async (req: Request, res: Response) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            res.status(400).json({ message: "Email y código son requeridos" });
            return;
        }

        const collection = getCollection();
        const user = await collection.findOne({ email: email });

        if (!user || !user.resetCode || !user.resetCodeExpires) {
            res.status(400).json({ message: "No hay una solicitud de recuperación activa para este usuario" });
            return;
        }

        if (user.resetCode !== code) {
            res.status(400).json({ message: "Código incorrecto" });
            return;
        }

        if (new Date() > user.resetCodeExpires) {
            res.status(400).json({ message: "El código ha expirado" });
            return;
        }

        res.status(200).json({ message: "Código verificado correctamente" });
    } catch (error) {
        console.error("Error al verificar código:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

router.post("/reset-password-code", async (req: Request, res: Response) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            res.status(400).json({ message: "Email, código y nueva contraseña son requeridos" });
            return;
        }

        const collection = getCollection();
        const user = await collection.findOne({ email: email });

        if (!user || user.resetCode !== code || new Date() > (user.resetCodeExpires || new Date(0))) {
            res.status(400).json({ message: "Código inválido o expirado" });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await collection.updateOne(
            { _id: user._id },
            { 
                $set: { password: hashedPassword },
                $unset: { resetCode: "", resetCodeExpires: "" }
            }
        );

        res.status(200).json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
        console.error("Error al restablecer contraseña:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

export default router;
