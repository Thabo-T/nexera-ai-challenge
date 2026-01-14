export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { userText, catalog } = req.body || {};
    if (!userText || !Array.isArray(catalog)) {
      return res.status(400).json({ error: "Missing userText or catalog" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });
    }

    const systemPrompt = `
You choose the best 3D training asset from a catalog and write a short educational summary.

Return ONLY JSON in this exact format:
{
  "chosenId": "one of the catalog ids",
  "summary": "2-3 simple educational sentences"
}
No extra text.
`;

    const userPrompt = `
User request: "${userText}"

Catalog:
${catalog.map(x => `- id: ${x.id}, label: ${x.label}, tags: ${x.tags?.join(", ") || ""}`).join("\n")}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        chosenId: catalog[0]?.id || "hard_hat",
        summary: "This is a training item used in safety education."
      };
    }

    // validate chosenId
    const validIds = new Set(catalog.map(x => x.id));
    if (!validIds.has(parsed.chosenId)) parsed.chosenId = catalog[0]?.id || "hard_hat";

    // validate summary
    if (!parsed.summary || typeof parsed.summary !== "string") {
      parsed.summary = "This item is commonly used in training scenarios to improve workplace safety.";
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}

