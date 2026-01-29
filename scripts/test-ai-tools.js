// Native fetch is available in recent Node versions

// Configuration
const BASE_URL = 'http://localhost:3000';
const USER_ID = 'C1cszVza1vUwUh5VrnhkHdsNbmN2';
// Note: You might need to change the USER_ID to one that actually exists in your Firestore emulator/db

async function testAIChat(message) {
    console.log(`\n--- Sending: "${message}" ---`);
    try {
        const response = await fetch(`${BASE_URL}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': USER_ID 
            },
            body: JSON.stringify({
                message: message,
                conversationHistory: []
            })
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return null;
        }

        const data = await response.json();
        // console.log("Full Response:", JSON.stringify(data, null, 2));

        if (data.success) {
            console.log("Response:", data.data?.response || data.response);
            console.log("Tools Used:", data.toolsUsed || data.data?.toolsUsed || []);
            return data;
        } else {
            console.error("API Error:", data.error);
            return null;
        }

    } catch (e) {
        console.error("Request Failed:", e.message);
        return null;
    }
}

async function runTests() {
    console.log("Starting AI Tools Test Suite...");
    
    // Test 1: Bag Search
    console.log("\n[Test 1] Searching for 'bags'...");
    const bagResult = await testAIChat("Do you have any bags?");
    if (bagResult) {
        // Assert
        const tools = bagResult.toolsUsed || bagResult.data?.toolsUsed;
        if (tools && tools.includes('search_products')) {
             console.log("✅ PASS: Used search_products tool");
        } else {
             console.log("❌ FAIL: Did not use search_products tool");
        }
    }

    // Test 2: General Stock
    console.log("\n[Test 2] Checking general stock...");
    await testAIChat("What is in stock?");

    // Test 3: No Results
    console.log("\n[Test 3] Search for non-existent item...");
    await testAIChat("Do you have any dinosaurs?");

    // Test 4: Customer Search
    console.log("\n[Test 4] Searching for customers...");
    const customerResult = await testAIChat("Do we have a customer named John?");
    if (customerResult) {
         const tools = customerResult.toolsUsed || customerResult.data?.toolsUsed;
         if (tools && tools.includes('search_customers')) {
              console.log("✅ PASS: Used search_customers tool");
         } else {
              console.log("❌ FAIL: Did not use search_customers tool");
         }
    }

    console.log("\nTest Suite Completed.");
}

runTests();
