const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Try to load .env manually since we are running with node
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.log("Could not load .env file directly", e.message);
}

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No GEMINI_API_KEY found in .env");
        process.exit(1);
    }

    console.log("Using API Key length:", apiKey.length);

    try {
        // 1. Fetch available models via REST API
        console.log("Fetching available models list...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (!response.ok) {
            console.error(`Failed to list models: ${response.status} ${response.statusText}`);
            const errText = await response.text();
            console.error(errText);
        } else {
            const data = await response.json();
            if (data.models) {
                console.log("Available Models:");
                data.models.forEach(m => {
                    // Filter for 'generateContent' supported models
                    if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
                    }
                });
            } else {
                console.log("No models returned in list.");
            }
        }

        // 2. Test User Suggestion
        console.log("\nTesting specific candidate: gemini-2.5-flash (User Suggestion)...");
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent("Hello");
            console.log("Success with gemini-2.5-flash!", result.response.text());
        } catch(e) {
            console.log("Failed with gemini-2.5-flash:", e.message.split('[404]')[0]); // Shorten error
        }

    } catch (error) {
        console.error("Script Error:", error);
    }
}

listModels();
