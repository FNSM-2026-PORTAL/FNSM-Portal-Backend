import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { mongoClient } from "../server";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { Post, Comment, Reaction } from "../models/Post";
import path from "path";
import fs from "fs";

const router = Router();

// Aseguramos que exista la carpeta de posts
const postsUploadDir = path.join(process.cwd(), "uploads", "posts");
if (!fs.existsSync(postsUploadDir)) {
    fs.mkdirSync(postsUploadDir, { recursive: true });
}

// Multer configurado para subir imágenes a /uploads/posts/
import multer from "multer";
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, postsUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const uploadPost = multer({
    storage: postStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para imágenes de posts
    fileFilter: (req, file, cb) => {
        const mimetypes = /image\/jpeg|image\/png|image\/webp|image\/jpg/;
        if (mimetypes.test(file.mimetype)) return cb(null, true);
        cb(new Error("Solo se permiten imágenes (jpeg, png, webp)"));
    }
});

const getCollection = () => mongoClient.db("fnsm").collection<Post>("posts");
const getUsersCollection = () => mongoClient.db("fnsm").collection("users");

// Límites de posts por plan
const POST_LIMITS: Record<string, number> = {
    free: 10,
    plata: 50,
    oro: Infinity,
};

// ─────────────────────────────────────────────
// GET /api/posts?page=1  →  Feed Global paginado
// ─────────────────────────────────────────────
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const posts = await getCollection()
            .find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        const formatted = posts.map(post => ({
            id: post._id,
            author: {
                name: post.authorName,
                handle: post.authorHandle,
                avatar: post.authorAvatar,
                image: post.authorImage,
                plan: post.authorPlan,
            },
            time: post.createdAt,
            content: post.content,
            image: post.image ? `/uploads/posts/${post.image}` : null,
            likes: post.likes.length,
            userLiked: post.likes.includes(userId || ""),
            reactions: post.reactions.map(r => ({
                type: r.type,
                count: r.count,
                userReacted: r.userIds.includes(userId || ""),
            })),
            comments: post.comments.map(c => ({
                id: c._id,
                author: {
                    name: c.authorName,
                    handle: c.authorHandle,
                    avatar: c.authorAvatar,
                    image: c.authorImage,
                    plan: c.authorPlan,
                },
                text: c.text,
                time: c.createdAt,
            })),
            isOwn: post.authorId === userId,
        }));

        res.status(200).json({ posts: formatted, page, hasMore: posts.length === limit });
    } catch (error) {
        console.error("Error al obtener posts:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// GET /api/posts/mine  →  Solo mis posts
// ─────────────────────────────────────────────
router.get("/mine", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const posts = await getCollection()
            .find({ authorId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        const formatted = posts.map(post => ({
            id: post._id,
            author: {
                name: post.authorName,
                handle: post.authorHandle,
                avatar: post.authorAvatar,
                image: post.authorImage,
                plan: post.authorPlan,
            },
            time: post.createdAt,
            content: post.content,
            image: post.image ? `/uploads/posts/${post.image}` : null,
            likes: post.likes.length,
            userLiked: post.likes.includes(userId || ""),
            reactions: post.reactions.map(r => ({
                type: r.type,
                count: r.count,
                userReacted: r.userIds.includes(userId || ""),
            })),
            comments: post.comments.map(c => ({
                id: c._id,
                author: {
                    name: c.authorName,
                    handle: c.authorHandle,
                    avatar: c.authorAvatar,
                    image: c.authorImage,
                    plan: c.authorPlan,
                },
                text: c.text,
                time: c.createdAt,
            })),
            isOwn: true,
        }));

        res.status(200).json({ posts: formatted, page, hasMore: posts.length === limit });
    } catch (error) {
        console.error("Error al obtener mis posts:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// POST /api/posts  →  Crear post
// ─────────────────────────────────────────────
router.post("/", verifyToken, uploadPost.single("image"), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { content } = req.body;

        if (!content?.trim() && !req.file) {
            res.status(400).json({ message: "El post debe tener contenido o imagen." });
            return;
        }

        // Buscar datos actualizados del usuario (para desnormalizar correctamente)
        const user = await getUsersCollection().findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        // Verificar límite de posts diarios por plan
        const plan = user.plan || "free";
        const limit = POST_LIMITS[plan];

        if (limit !== Infinity) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const postsToday = await getCollection().countDocuments({
                authorId: userId,
                createdAt: { $gte: startOfDay }
            });
            if (postsToday >= limit) {
                res.status(429).json({
                    message: `Has alcanzado tu límite de ${limit} posts por día. ¡Mejora tu plan para publicar más!`
                });
                return;
            }
        }

        const avatar = (user.name as string).slice(0, 2).toUpperCase();
        const handle = "@" + (user.name as string).toLowerCase().replace(/\s+/g, "");

        const newPost: Post = {
            authorId: userId!,
            authorName: user.name,
            authorHandle: handle,
            authorAvatar: avatar,
            authorImage: user.profileImage,
            authorPlan: plan,
            content: content?.trim() || "",
            image: req.file ? req.file.filename : undefined,
            likes: [],
            reactions: [],
            comments: [],
            createdAt: new Date(),
        };

        const result = await getCollection().insertOne(newPost);

        res.status(201).json({
            message: "Post publicado exitosamente",
            post: {
                id: result.insertedId,
                ...newPost,
                image: newPost.image ? `/uploads/posts/${newPost.image}` : null,
                likes: 0,
                userLiked: false,
                isOwn: true,
            }
        });
    } catch (error) {
        console.error("Error al crear post:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/posts/:id  →  Eliminar post (solo el autor)
// ─────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const postId = req.params.id as string;

        const post = await getCollection().findOne({ _id: new ObjectId(postId) });
        if (!post) {
            res.status(404).json({ message: "Post no encontrado" });
            return;
        }
        if (post.authorId !== userId) {
            res.status(403).json({ message: "No tienes permiso para eliminar este post" });
            return;
        }

        // Borrar imagen del disco si existía
        if (post.image) {
            const imgPath = path.join(postsUploadDir, post.image);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }

        await getCollection().deleteOne({ _id: new ObjectId(postId) });
        res.status(200).json({ message: "Post eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar post:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// POST /api/posts/:id/like  →  Toggle like
// ─────────────────────────────────────────────
router.post("/:id/like", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId!;
        const postId = req.params.id as string;

        const post = await getCollection().findOne({ _id: new ObjectId(postId) });
        if (!post) {
            res.status(404).json({ message: "Post no encontrado" });
            return;
        }

        const alreadyLiked = post.likes.includes(userId);
        const update = alreadyLiked
            ? { $pull: { likes: userId } }
            : { $addToSet: { likes: userId } };

        await getCollection().updateOne({ _id: new ObjectId(postId) }, update as any);

        res.status(200).json({ liked: !alreadyLiked });
    } catch (error) {
        console.error("Error al dar like:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// POST /api/posts/:id/reaction  →  Toggle Reaction (❤️😂😮😢😡)
// ─────────────────────────────────────────────
router.post("/:id/reaction", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId!;
        const postId = req.params.id as string;
        const { type } = req.body;

        const validReactions = ["like", "love", "haha", "wow", "sad", "angry"];
        if (!type || !validReactions.includes(type)) {
            res.status(400).json({ message: "Tipo de reacción inválido" });
            return;
        }

        const post = await getCollection().findOne({ _id: new ObjectId(postId) });
        if (!post) {
            res.status(404).json({ message: "Post no encontrado" });
            return;
        }

        const reactions = [...(post.reactions || [])];
        const existingIdx = reactions.findIndex(r => r.type === type);

        if (existingIdx !== -1) {
            const userIdx = reactions[existingIdx].userIds.indexOf(userId);
            if (userIdx !== -1) {
                // Quitar reacción
                reactions[existingIdx].userIds.splice(userIdx, 1);
                reactions[existingIdx].count -= 1;
                if (reactions[existingIdx].count <= 0) reactions.splice(existingIdx, 1);
            } else {
                // Añadir reacción
                reactions[existingIdx].userIds.push(userId);
                reactions[existingIdx].count += 1;
            }
        } else {
            reactions.push({ type: type as any, count: 1, userIds: [userId] });
        }

        await getCollection().updateOne({ _id: new ObjectId(postId) }, { $set: { reactions } });

        const formatted = reactions.map(r => ({
            type: r.type,
            count: r.count,
            userReacted: r.userIds.includes(userId),
        }));

        res.status(200).json({ reactions: formatted });
    } catch (error) {
        console.error("Error al reaccionar:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

// ─────────────────────────────────────────────
// POST /api/posts/:id/comment  →  Añadir comentario
// ─────────────────────────────────────────────
router.post("/:id/comment", verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId!;
        const postId = req.params.id as string;
        const { text } = req.body;

        if (!text?.trim()) {
            res.status(400).json({ message: "El comentario no puede estar vacío" });
            return;
        }

        const user = await getUsersCollection().findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        const comment: Comment = {
            _id: new ObjectId(),
            authorId: userId,
            authorName: user.name,
            authorHandle: "@" + (user.name as string).toLowerCase().replace(/\s+/g, ""),
            authorAvatar: (user.name as string).slice(0, 2).toUpperCase(),
            authorImage: user.profileImage,
            authorPlan: user.plan || "free",
            text: text.trim(),
            createdAt: new Date(),
        };

        await getCollection().updateOne(
            { _id: new ObjectId(postId) },
            { $push: { comments: comment } }
        );

        res.status(201).json({
            comment: {
                id: comment._id,
                author: {
                    name: comment.authorName,
                    handle: comment.authorHandle,
                    avatar: comment.authorAvatar,
                    image: comment.authorImage,
                    plan: comment.authorPlan,
                },
                text: comment.text,
                time: comment.createdAt,
            }
        });
    } catch (error) {
        console.error("Error al comentar:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});

export default router;
