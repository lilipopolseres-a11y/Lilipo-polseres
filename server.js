const express = require("express");
const path = require("path");
const { Resend } = require("resend");

const app = express();
const PORT = process.env.PORT || 10000;

const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL || "lilipo.polseres@gmail.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function clean(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

app.post("/api/proposals", async (req, res) => {
  try {
    const name = clean(req.body.name, 120);
    const email = clean(req.body.email, 200);
    const braceletName = clean(req.body.braceletName, 160) || "La teva Lilipo";
    const color = clean(req.body.color, 60);
    const detail = clean(req.body.detail, 60);
    const idea = clean(req.body.idea, 3000);

    if (!name || !email || !idea) {
      return res.status(400).json({
        ok: false,
        error: "Falten dades obligatòries."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        ok: false,
        error: "El correu no és vàlid."
      });
    }

    if (!resend || !FROM_EMAIL) {
      console.error("Resend no està configurat.");
      return res.status(500).json({
        ok: false,
        error: "El servei de correu no està configurat."
      });
    }

    const subject = `Nova proposta per a Lilipo — ${braceletName}`;

    const emailHtml = `
      <h2>Nova proposta de polsera ✦</h2>

      <p><strong>Nom:</strong> ${escapeHtml(name)}</p>

      <p><strong>Email:</strong> ${escapeHtml(email)}</p>

      <p><strong>Nom de la polsera:</strong>
      ${escapeHtml(braceletName)}</p>

      <p><strong>Color principal:</strong>
      ${escapeHtml(color)}</p>

      <p><strong>Detall:</strong>
      ${escapeHtml(detail)}</p>

      <p><strong>Idea / història:</strong></p>

      <p>${escapeHtml(idea).replace(/\n/g, "<br>")}</p>
    `;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      replyTo: email,
      subject,
      html: emailHtml
    });

    if (error) {
      console.error("Error de Resend:", error);

      return res.status(502).json({
        ok: false,
        error: "Resend no ha pogut enviar el correu."
      });
    }

    return res.json({ ok: true });

  } catch (error) {
    console.error("Error enviant proposta:", error);

    return res.status(500).json({
      ok: false,
      error: "Error intern enviant la proposta."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Lilipo server escoltant al port ${PORT}`);
});
