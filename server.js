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

    let languageInstruction = language === "english"
      ? "Answer in clear, simple English."
      : "Roman Urdu mein jawab do — simple aur clear.";

    let subjectInstruction = "Physics, Math, Chemistry, aur English";
    if (subject === "Physics") subjectInstruction = "sirf Physics";
    if (subject === "Math") subjectInstruction = "sirf Math";
    if (subject === "Chemistry") subjectInstruction = "sirf Chemistry";
    if (subject === "English") subjectInstruction = "sirf English";

    let prompt;

    if (mode === "mcq") {
      prompt = `
Tu ek ECAT preparation assistant hai Pakistan ke students ke liye.
Student ne ${subjectInstruction} se ek practice MCQ maanga hai.

Ek ECAT-style multiple choice question banao (${subjectInstruction} se, agar "All" hai to koi bhi subject choose kar lo).
Format bilkul yeh follow karo:

**Sawal:** [question yahan]

A) [option]
B) [option]
C) [option]
D) [option]

Sirf sawal aur options do — jawab mat batao abhi. ${languageInstruction} (technical terms English mein rakh sakte ho).
Agar koi math/physics equation ho to use LaTeX format mein likho, jaise $E = mc^2$ ya $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$
      `;
    } else if (mode === "mcq_answer") {
      prompt = `
Tu ek ECAT preparation assistant hai. Yeh tha sawal jo tum ne diya tha:
${req.body.previousQuestion}

Student ka jawab: ${userMessage}

Bolo ke jawab sahi hai ya ghalat, phir sahi answer aur uski short explanation do. ${languageInstruction} Agar equation ho to LaTeX format mein likho ($...$ ya $$...$$).
      `;
    } else {
      prompt = `
Tu ek ECAT preparation assistant hai Pakistan ke students ke liye.
Sirf ECAT related sawaalon ka jawab do — ${subjectInstruction}.
${languageInstruction}
Agar koi math ya physics/chemistry equation ho to use LaTeX format mein likho, jaise $E = mc^2$ ya $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$ — taake properly render ho sake.
Agar student past papers ke baare mein pooche, to unhe bata do ke "Practice Mode" use karke practice MCQs try kar sakte hain.
Student ka sawal: ${userMessage}
      `;
    }

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    res.json({ reply: response });

  } catch (error) {
    console.error("Error:", error.message);
    res.json({ reply: "Thodi der baad try karo — server busy hai! 🙏" });
  }
});

app.listen(3000, () => {
  console.log("ECAT Bot chal raha hai — port 3000 pe!");
});