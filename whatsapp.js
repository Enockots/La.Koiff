// La.Koiff : envoi et réception de messages WhatsApp (API WhatsApp Cloud de Meta).
// Sans WHATSAPP_TOKEN, les messages sont seulement affichés dans la console (mode test).
const crypto = require("node:crypto");

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const LANG = process.env.WHATSAPP_TEMPLATE_LANG || "fr";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const enabled = !!(TOKEN && PHONE_ID);

async function call(payload) {
  if (!enabled) { console.log("[WhatsApp test]", JSON.stringify(payload)); return { test: true }; }
  const res = await fetch(`https://graph.facebook.com/${VERSION}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error?.message || "erreur inconnue"}`);
  return data;
}

/* Message modèle (obligatoire pour écrire en premier à quelqu'un). Les paramètres remplacent {{1}}, {{2}}… */
function sendTemplate(to, name, params = []) {
  return call({
    to: String(to).replace(/\D/g, ""), type: "template",
    template: { name, language: { code: LANG }, components: [{ type: "body", parameters: params.map(t => ({ type: "text", text: String(t).slice(0, 1000) })) }] }
  });
}
/* Code de vérification (modèle WhatsApp de catégorie « Authentification », avec bouton « Copier le code ») */
function sendAuthCode(to, code) {
  return call({
    to: String(to).replace(/\D/g, ""), type: "template",
    template: { name: process.env.WHATSAPP_CODE_TEMPLATE || "lk_code", language: { code: LANG }, components: [
      { type: "body", parameters: [{ type: "text", text: code }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] }
    ] }
  });
}
/* Message libre (seulement dans les 24 h qui suivent un message de la personne) */
function sendText(to, body) {
  return call({ to: String(to).replace(/\D/g, ""), type: "text", text: { body: String(body).slice(0, 4000) } });
}

/* Vérifie que le webhook vient bien de Meta (en-tête X-Hub-Signature-256) */
function checkSignature(raw, header) {
  if (!APP_SECRET) return true;
  if (!header || !Buffer.isBuffer(raw)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  return expected.length === header.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}

/* Extrait les messages reçus : [{from, text}] */
function incomingMessages(body) {
  const out = [];
  for (const e of body?.entry || []) for (const c of e.changes || []) for (const m of c.value?.messages || []) {
    const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title;
    if (m.from && text) out.push({ from: String(m.from), text });
  }
  return out;
}

module.exports = { enabled, sendTemplate, sendAuthCode, sendText, checkSignature, incomingMessages };
