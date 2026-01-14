export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { userText, catalog } = req.body || {};
    if (!userText || !Array.isArray(catalog) || catalog.length === 0) {
      return res.status(400).json({ error: "Missing userText or catalog" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const system = `
Pick the best matching item from the catalog for training.
Return ONLY JSON with exactly:
{
  "chosenId": "<one of the catalog ids>",
  "summary": "<2-3 short educational sentences>"
}
`;

    const user = `
User request: "${userText}"

Catalog:
${catalog.map(x => `- id: ${x.id}, label: ${x.label}, tags: ${(x.tags || []).join(", ")}`).join("\n")}
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
          { role: "user", content: user }
        ]
      })
    });

    const data = await r.json();

    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    // Validate chosenId
    const validIds = new Set(catalog.map(x => x.id));
    if (!validIds.has(parsed.chosenId)) parsed.chosenId = catalog[0].id;

    // Validate summary
    if (!parsed.summary || typeof parsed.summary !== "string" || parsed.summary.trim().length < 10) {
      parsed.summary =
        "This item is commonly used in safety training to improve correct handling and reduce workplace risk.";
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
