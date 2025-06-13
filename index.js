const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

const PORT = 3000;
const SECRET = "cac6dbdb25d105125eaa0e7d7491bef0";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1383186606915059713/fBzEKYE9TdSHb4gh7VeHAKzNuHWxcZvo_fCGElwKt-nYTz_sJG-2isBLXdPSUpKZAfI2";

// Capture rawBody
app.use('/tebex', express.raw({ type: 'application/json' }));

app.post('/tebex', async (req, res) => {
  // 1️⃣ Verificar IP
  const ip = req.headers['x-forwarded-for']?.split(",")[0]?.trim() ||
              req.connection.remoteAddress;

  if (ip !== "18.209.80.3" && ip !== "54.87.231.232") {
    console.warn(`⚡ IP NO AUTORIZADA ${ip}`);
    return res.status(404).send("Not found.");
  }

  // 2️⃣ Verificar firma
  const rawBody = req.body.toString("utf-8");

  // Primero se hace el SHA256 del rawBody
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  // Después el HMAC-SHA256 de dicho hash
  const calculatedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(bodyHash)
    .digest("hex");

  const receivedSignature = req.headers["x-signature"];

  if (calculatedSignature !== receivedSignature) {
    console.warn("⚡ La firma NO COINCIDE.");
    return res.status(403).send("Invalid signature.");
  }

  // 4️⃣ Parseamos el webhook
  let webhook;

  try {
    webhook = JSON.parse(rawBody);
  } catch (err) {
    console.error("Error parsesndo el webhook.", err);
    return res.status(400).send("Invalid webhook.");
  }

  // 5️⃣ Validacion webhook
  if (webhook.type === "validation.webhook") {
    console.log("✅ Validacion webhook.");
    return res.status(200).json({ id: webhook.id });
  }

  // 6️⃣ Notificar a Discord
  const purchase = webhook.subject;

  if (webhook.type === "payment.completed") {
    const username = purchase.customer.username.username ||
      "Jugador Desconocido";

    const packageName = purchase.products.length
      ? purchase.products[0].name
      : "Paquete Desconocido";

    const serverName = "MineBlum";

    const embed = {
      embeds: [
        {
          title: "🛒 ¡Nueva compra en la tienda!",
          color: 0x00ff99,
          fields: [
            { name: "👤 Jugador", value: username, inline: true },
            { name: "🎁 Paquete", value: packageName, inline: true },
            { name: "🌐 Servidor", value: serverName, inline: false },
          ],
          footer: { text: "https://store.mineblum.com" },
          timestamp: new Date().toISOString()
        }
      ]
    };

    try {
      await axios.post(DISCORD_WEBHOOK_URL, embed);
      console.log("✅ Enviado a Discord.");
    } catch (err) {
      console.error("❌ Error al enviar a Discord.", err.message);
    }
  }

  res.status(200).send("OK");

});

// Servidor iniciado
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});
