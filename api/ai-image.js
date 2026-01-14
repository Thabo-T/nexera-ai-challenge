export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { base64Image, catalog } = req.body || {};
    if (!base64Image || !Array.isArray(catalog) || catalog.length === 0) {
      return res.status(400).json({ error: "Missing base64Image or catalog" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const system = `
You are helping choose a 3D training asset based on an uploaded image.
Return ONLY JSON:
{
  "chosenId": "<one of the catalog ids>",
  "summary": "<2-3 educational sentences>"
}
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Pick the best catalog item for this image." },
              { type: "image_url", image_url: { url: base64Image } },
              { type: "text", text: "Catalog: " + JSON.stringify(catalog) }
            ]
          }
        ]
      })
    });

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    const validIds = new Set(catalog.map(x => x.id));
    if (!validIds.has(parsed.chosenId)) parsed.chosenId = catalog[0].id;

    if (!parsed.summary || typeof parsed.summary !== "string" || parsed.summary.trim().length < 10) {
      parsed.summary = "This object can be used in training to teach correct identification and safe usage.";
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
