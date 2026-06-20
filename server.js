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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
Tu ek ECAT preparation assistant hai Pakistan ke students ke liye.
Sirf ECAT related sawaalon ka jawab do — Physics, Math, Chemistry.
Roman Urdu mein jawab do — simple aur clear.
Student ka sawal: ${userMessage}
    `;

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