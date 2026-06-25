const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const subject = req.body.subject || "All";
    const mode = req.body.mode || "chat";
    const language = req.body.language || "roman_urdu";

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const languageInstruction = language === "english"
      ? "Answer in clear, simple English."
      : "Roman Urdu mein jawab do — simple aur clear.";

    let subjectInstruction = "Mathematics, Physics, aur Chemistry";
    if (subject === "Mathematics") subjectInstruction = "sirf Mathematics";
    if (subject === "Physics")     subjectInstruction = "sirf Physics";
    if (subject === "Chemistry")   subjectInstruction = "sirf Chemistry";

    let prompt;

    if (mode === "mcq") {
      prompt = `
Tu ek ECAT preparation assistant hai Pakistan ke engineering students ke liye.
Ek ECAT-style MCQ banao — ${subjectInstruction} se.

Format bilkul yeh follow karo:

**Sawal:** [question yahan]

A) [option]
B) [option]
C) [option]
D) [option]

Sirf sawal aur options do — jawab mat batao abhi.
${languageInstruction} (scientific/technical terms English mein rakho).
Agar koi equation ho to LaTeX format mein likho: $E = mc^2$
      `;
    } else if (mode === "mcq_answer") {
      prompt = `
Tu ek ECAT preparation assistant hai.
Yeh tha sawal: ${req.body.previousQuestion}
Student ka jawab: ${userMessage}

Batao ke jawab sahi hai ya ghalat.
Phir:
1. Sahi answer explain karo
2. Ghalat options kyun ghalat hain — ek line mein har ek ke liye
3. Related formula ya concept bhi batao
${languageInstruction}
Agar equation ho to LaTeX format mein likho.
      `;
    } else {
      prompt = `
Tu ek ECAT preparation assistant hai Pakistan ke engineering students ke liye.
Sirf ECAT related sawaalon ka jawab do — ${subjectInstruction}.
${languageInstruction}
Agar koi equation ho to LaTeX format mein likho: $F = ma$
Agar student past papers ke baare mein pooche, Practice MCQ mode suggest karo.
Student ka sawal: ${userMessage}
      `;
    }

    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    res.json({ reply });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ reply: "Thodi der baad try karo — server busy hai! 🙏" });
  }
});

app.listen(3000, () => {
  console.log("ECAT Bot chal raha hai — port 3000 pe!");
});
