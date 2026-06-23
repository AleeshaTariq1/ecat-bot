const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JSONFilePreset } = require("lowdb/node");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || "ecat-secret-key-change-this";
const FREE_DAILY_LIMIT = 5;

// ─── Database Setup (lowdb - simple JSON file) ───────────────────────────────
let db;
async function initDB() {
  db = await JSONFilePreset("db.json", { users: [] });
}
initDB();

// ─── Helper: get today's date string ─────────────────────────────────────────
function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── Middleware: verify JWT token ─────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: "Name, email and password required" });

  await db.read();
  const exists = db.data.users.find((u) => u.email === email);
  if (exists) return res.status(400).json({ error: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    name,
    email,
    password: hashed,
    plan: "free",          // "free" or "paid"
    questionsToday: 0,
    lastQuestionDate: "",
  };
  db.data.users.push(user);
  await db.write();

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, name: user.name, plan: user.plan });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const user = db.data.users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ error: "Email not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, name: user.name, plan: user.plan });
});

// ─── GET USER INFO ────────────────────────────────────────────────────────────
app.get("/auth/me", authMiddleware, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    name: user.name,
    email: user.email,
    plan: user.plan,
    questionsToday: user.lastQuestionDate === today() ? user.questionsToday : 0,
    dailyLimit: user.plan === "paid" ? "Unlimited" : FREE_DAILY_LIMIT,
  });
});

// ─── LEMON SQUEEZY WEBHOOK (marks user as paid) ───────────────────────────────
app.post("/webhook/lemonsqueezy", express.raw({ type: "application/json" }), async (req, res) => {
  const event = JSON.parse(req.body);
  const eventName = event?.meta?.event_name;
  const customerEmail = event?.data?.attributes?.user_email;

  if (
    (eventName === "order_created" || eventName === "subscription_created") &&
    customerEmail
  ) {
    await db.read();
    const user = db.data.users.find((u) => u.email === customerEmail);
    if (user) {
      user.plan = "paid";
      await db.write();
    }
  }
  res.sendStatus(200);
});

// ─── CHAT (protected) ────────────────────────────────────────────────────────
app.post("/chat", authMiddleware, async (req, res) => {
  await db.read();
  const user = db.data.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Reset daily count if new day
  if (user.lastQuestionDate !== today()) {
    user.questionsToday = 0;
    user.lastQuestionDate = today();
  }

  // Check free limit
  if (user.plan === "free" && user.questionsToday >= FREE_DAILY_LIMIT) {
    return res.status(403).json({
      error: "free_limit_reached",
      message: `You've used all ${FREE_DAILY_LIMIT} free questions for today. Upgrade to ask unlimited questions!`,
    });
  }

  // Increment count
  user.questionsToday += 1;
  await db.write();

  try {
    const { message, subject = "All", mode = "chat", language = "english", previousQuestion } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const languageInstruction =
      language === "roman_urdu"
        ? "IMPORTANT: You MUST reply in Roman Urdu only (English letters for Urdu words, e.g. 'Yeh formula hai'). Do NOT use Hindi script (देवनागरी). Do NOT use Urdu script (نستعلیق). Technical terms and formulas can stay in English."
        : "IMPORTANT: You MUST reply in English only. Do NOT use Hindi, Urdu, or any other language. Even if the student writes in Urdu or Hindi, your response must be in English only.";

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
A) [option]  B) [option]  C) [option]  D) [option]
Only provide the question and options — do NOT reveal the answer yet.
${languageInstruction}
For equations use LaTeX: $E = mc^2$ (inline) or $$x = \\frac{-b}{2a}$$ (display).`;
    } else if (mode === "mcq_answer") {
      prompt = `You are an ECAT preparation assistant.
The question was: ${previousQuestion}
The student selected: ${message}
Tell whether their answer is correct or wrong, then give the correct answer with a brief explanation.
${languageInstruction}
For equations use LaTeX format ($...$ or $$...$$).`;
    } else {
      prompt = `You are an ECAT preparation assistant for Pakistani students.
Only answer ECAT-related questions about: ${subjectInstruction}.
${languageInstruction}
For equations use LaTeX: $E = mc^2$ (inline) or $$x = \\frac{-b}{2a}$$ (display).
Student's question: ${message}`;
    }

    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    res.json({
      reply,
      questionsToday: user.questionsToday,
      dailyLimit: user.plan === "paid" ? null : FREE_DAILY_LIMIT,
      plan: user.plan,
    });
  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ reply: "Something went wrong. Please try again." });
  }
});

app.listen(3000, () => console.log("ECAT Bot running on port 3000!"));
