export default async function handler(req, res) {
  try {
    const { userText, catalog } = req.body;

    // IMPORTANT: set your OPENAI_API_KEY in Vercel env vars (not in code)
    const apiKey = process.env.OPENAI_API_KEY;

    // Simple prompt: choose best model id + write short training summary
    const system = `
You are helping choose a 3D training asset and write a short educational summary.
Return ONLY valid JSON with keys:
- chosenId: one of the catalog ids
- summary: 2-3 sentences, simple, educational, safety/training tone
`;

    const user = `
User request: "${userText}"

Catalog (choose ONE id):
${catalog.map(x => `- id: ${x.id}, label: ${x.label}, tags: ${x.tags.join(", ")}`).join("\n")}
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.3
      })
    });

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    // Parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { chosenId: catalog[0]?.id || "hard_hat", summary: "This is a common safety item used in training." };
    }

    // Validate chosenId
    const validIds = new Set(catalog.map(x => x.id));
    if (!validIds.has(parsed.chosenId)) parsed.chosenId = catalog[0]?.id || "hard_hat";

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}
