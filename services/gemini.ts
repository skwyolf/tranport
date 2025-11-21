import { GoogleGenAI } from "@google/genai";
import { LogisticsProject } from "../types";

/**
 * Uses Gemini to analyze a delivery route or project.
 */
export const analyzeDelivery = async (project: LogisticsProject): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "Błąd konfiguracji: Brak klucza API Gemini (process.env.API_KEY).";

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Jesteś asystentem logistycznym dla firmy rolniczej.
      Analizujesz dostawę:
      Maszyna: ${project.title}
      Klient: ${project.clientName}
      Adres: ${project.address}
      Wartość: ${project.value}

      Podaj krótką, profesjonalną notatkę dla kierowcy (max 3 zdania). 
      Uwzględnij typ maszyny (czy potrzebny specjalny transport/laweta niskopodwoziowa, jeśli wynika to z nazwy) oraz poradę dotyczącą dojazdu do obszarów wiejskich w Polsce.
      Mów po polsku.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Nie udało się wygenerować porady.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Błąd połączenia z asystentem AI.";
  }
};