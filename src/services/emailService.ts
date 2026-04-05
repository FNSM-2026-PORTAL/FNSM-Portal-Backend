import nodemailer from "nodemailer";

export const sendStoreNotification = async (store: any) => {
    console.log("ENTRÓ AL SERVICE DE CORREO!!")
    // Crear el transporter aquí — ya tiene las variables cargadas
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    console.log("Nombre de la tienda!",store.name);

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: [process.env.ADMIN_EMAIL_1, process.env.ADMIN_EMAIL_2].join(","),
        subject: `🏪 Nueva solicitud: ${store.name}`,
        html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
                <h2 style="color:#3951cf">Nueva solicitud de negocio</h2>
                <table style="width:100%;border-collapse:collapse">
                    <tr><td style="padding:8px;color:#666">Nombre</td><td style="padding:8px"><b>${store.name}</b></td></tr>
                    <tr><td style="padding:8px;color:#666">Categoría</td><td style="padding:8px">${store.category}</td></tr>
                    <tr><td style="padding:8px;color:#666">Tipo</td><td style="padding:8px">${store.venueType}</td></tr>
                    <tr><td style="padding:8px;color:#666">Descripción</td><td style="padding:8px">${store.description}</td></tr>
                    <tr><td style="padding:8px;color:#666">Ubicación</td><td style="padding:8px">${store.lat}, ${store.lng}</td></tr>
                </table>
                <a href="${process.env.ADMIN_PANEL_URL}/locales"
                   style="display:inline-block;margin-top:20px;padding:12px 24px;background:#3951cf;color:white;text-decoration:none;border-radius:12px;font-weight:bold">
                    Revisar en el panel admin →
                </a>
            </div>
        `,
    });
};

// Aquí después agregas más funciones de email
// export const sendApprovalEmail = async (store, ownerEmail) => { ... }
// export const sendRejectionEmail = async (store, ownerEmail, reason) => { ... }