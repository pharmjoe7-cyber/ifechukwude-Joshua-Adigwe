import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function diagnoseSymptoms(symptoms: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a medical diagnostic assistant for Community Health Volunteers in rural areas. 
    Analyze the following symptoms and provide a potential diagnosis, urgency level, and recommended immediate actions.
    Focus on common rural illnesses like Malaria, Pneumonia, and Diarrheal diseases.
    
    Symptoms: ${symptoms}
    
    Return the response in JSON format with the following structure:
    {
      "diagnosis": "string",
      "urgency": "low" | "medium" | "high" | "critical",
      "recommendations": ["string"],
      "explanation": "string"
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosis: { type: Type.STRING },
          urgency: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING }
        },
        required: ["diagnosis", "urgency", "recommendations", "explanation"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function detectMalnutrition(imageBase64: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          text: `Analyze this image of a child for signs of malnutrition (e.g., wasting, stunting, edema). 
          Provide an assessment of the malnutrition status and recommended actions.
          
          Return the response in JSON format:
          {
            "status": "Healthy" | "At Risk" | "Moderate Acute Malnutrition" | "Severe Acute Malnutrition",
            "observations": ["string"],
            "recommendations": ["string"]
          }`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ["Healthy", "At Risk", "Moderate Acute Malnutrition", "Severe Acute Malnutrition"] },
          observations: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["status", "observations", "recommendations"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
