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
    const language = req.body.language || "english";

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let languageInstruction = language === "roman_urdu"
      ? "Roman Urdu mein jawab do — simple aur clear. Technical terms English mein rakh sakte ho."
      : "Answer in clear, simple English.";

    let subjectInstruction = "Physics, Math, Chemistry, and English";
    if (subject === "Physics")   subjectInstruction = "Physics only";
    if (subject === "Math")      subjectInstruction = "Math only";
    if (subject === "Chemistry") subjectInstruction = "Chemistry only";
    if (subject === "English")   subjectInstruction = "English only";

    let prompt;

    if (mode === "mcq") {
      prompt = `You are an ECAT preparation assistant for Pakistani students.
The student wants a practice MCQ from: ${subjectInstruction}.

Create one ECAT-style multiple choice question. Use this exact format:

**Question:** [question here]

A) [option]
B) [option]
C) [option]
D) [option]

Only provide the question and options — do NOT reveal the answer yet.
${languageInstruction}
For math/physics/chemistry equations use LaTeX: $E = mc^2$ (inline) or $$x = \\frac{-b}{2a}$$ (display).`;

    } else if (mode === "mcq_answer") {
      prompt = `You are an ECAT preparation assistant.
The question was:
${req.body.previousQuestion}

The student selected: ${userMessage}

Tell the student whether their answer is correct or wrong, then give the correct answer with a brief clear explanation.
${languageInstruction}
For equations use LaTeX format ($...$ or $$...$$).`;

    } else {
      prompt = `You are an ECAT preparation assistant for Pakistani students.
Only answer ECAT-related questions about: ${subjectInstruction}.
${languageInstruction}
For math/physics/chemistry equations use LaTeX: $E = mc^2$ (inline) or $$x = \\frac{-b}{2a}$$ (display).
Student's question: ${userMessage}`;
    }

    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    res.json({ reply });

  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ reply: "Something went wrong. Please try again." });
  }
});

app.listen(3000, () => {
  console.log("ECAT Bot running on port 3000!");
});
