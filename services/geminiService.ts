
/**
 * CRITICAL MODULE: TRÍ TUỆ ĐỊA LÍ THÔNG MINH
 * STATUS: OPTIMIZED FOR NANO BANANA PRO & REAL-TIME RAG
 */

import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { DocumentChunk, Topic } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

let localKnowledgeBase: DocumentChunk[] = [];

const GEOGRAPHY_TEACHER_INSTRUCTION = `
ROLE:
Bạn là một Giáo viên Địa lí (viết đúng chính tả: Địa lí) tận tâm và giàu kinh nghiệm. 
Nhiệm vụ của bạn là giải đáp thắc mắc cho học sinh theo chuẩn giáo dục 2018.

QUY TẮC TRÌNH BÀY (BẮT BUỘC):
1. TIÊU ĐỀ KHUNG: **[TRỢ LÝ HỌC TẬP ĐỊA LÍ - GALAXY RAG]**
2. CHỦ ĐỀ: **CHỦ ĐỀ:** [Xác định tên chủ đề phù hợp, viết hoa]

3. HỆ THỐNG PHÂN CẤP MỤC: 
   - **I. TIÊU ĐỀ LỚN (TÔ ĐẬM)**
   - **1. Mục nhỏ (TÔ ĐẬM)**
   - **a) Ý chi tiết (TÔ ĐẬM từ khóa)**
   - (+ / -) Các gạch đầu dòng cụ thể. **TÔ ĐẬM** từ khóa ngay đầu dòng.

4. VĂN PHONG & XƯNG HÔ: 
   Sử dụng "Thầy/Cô" và "Em". Thân thiện, khoa học, sư phạm.

5. ĐỊNH DẠNG:
   - Sử dụng BẢNG để so sánh dữ liệu.
   - Luôn kết thúc bằng khung:
   ---
   ⚠️ **GHI NHỚ TRỌNG TÂM:**
   [Tóm tắt 1-2 ý cốt lõi]
   ---
`;

export const retrieveRelevantContext = (query: string): string => {
  if (!query) return "";
  const matches = localKnowledgeBase.filter(chunk => 
    chunk.content.toLowerCase().includes(query.toLowerCase()) ||
    chunk.metadata.topic.toLowerCase().includes(query.toLowerCase())
  );
  return matches.map(m => m.content).join('\n\n');
};

export const processDocumentToChunks = async (fileName: string, content: string, fileId: string): Promise<DocumentChunk[]> => {
  const mockChunks: DocumentChunk[] = [
    {
      id: `${fileId}-1`,
      fileId,
      content: `Nội dung từ ${fileName}: Kiến thức Địa lí đã được hệ thống hóa.`,
      metadata: { topic: "Tài liệu học tập", keywords: ["địa lí", "kiến thức"] }
    }
  ];
  localKnowledgeBase = [...localKnowledgeBase, ...mockChunks];
  return mockChunks;
};

export const generateGeographyAnswerStream = async (
  prompt: string, 
  context: string, 
  progress: number | null,
  imageData?: { data: string, mimeType: string }
) => {
  const ai = getAI();
  
  let backgroundContext = "";
  if (progress !== null && progress < 100) {
    backgroundContext = `\n[THÔNG TIN HỆ THỐNG]: Thầy/Cô hiện mới nạp được ${progress}% tri thức từ tài liệu của em. Nếu em hỏi về kiến thức trong tài liệu mà Thầy/Cô chưa trả lời được sâu, hãy nói nhẹ nhàng rằng Thầy/Cô vẫn đang nghiên cứu thêm tài liệu em gửi (hiện tại là ${progress}%) để bổ sung chi tiết nhé.`;
  } else if (progress === 100 || (progress === null && localKnowledgeBase.length > 0)) {
    backgroundContext = `\n[THÔNG TIN HỆ THỐNG]: Thầy/Cô đã nạp xong 100% tri thức từ tài liệu. Hãy trả lời dựa trên cả tài liệu và kiến thức chuyên môn của mình.`;
  }

  const systemPrompt = GEOGRAPHY_TEACHER_INSTRUCTION + backgroundContext + "\nƯu tiên sử dụng kiến thức từ tài liệu học sinh đã nạp nếu có.";
  
  const parts: any[] = [];
  if (context) {
    parts.push({ text: `Tài liệu nạp thêm từ kho lưu trữ:\n${context}` });
  }
  if (imageData) {
    parts.push({ inlineData: imageData });
  }
  parts.push({ text: `Câu hỏi của học sinh: ${prompt || "Hãy phân tích hình ảnh này dưới góc độ địa lí."}` });

  return await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
      systemInstruction: systemPrompt
    }
  });
};

export const generateGeographyInfographic = async (userQuery: string, knowledgeText: string): Promise<string | null> => {
  const ai = getAI();
  
  const infographicPrompt = `Bạn là một chuyên gia thiết kế đồ họa thông tin giáo dục địa lý.
Nhiệm vụ: Tạo một hình ảnh 4K giải thích kiến thức dựa trên 2 nguồn dữ liệu sau:
1. Câu hỏi người dùng: "${userQuery}"
2. VĂN BẢN KIẾN THỨC ĐOẠN TEXT TRẢ VỀ: "${knowledgeText}"

YÊU CẦU PHÉP CHIẾU BẢN ĐỒ (ORTHOGRAPHIC NADIR):
- Bạn PHẢI sử dụng góc nhìn thẳng 90 độ từ trên xuống (Nadir view).
- Loại bỏ hoàn toàn góc nghiêng 45 độ, không có chiều sâu phối cảnh gây sai lệch hướng.
- Hướng Bắc (North) PHẢI LUÔN nằm ở chính giữa phía trên của khung hình (vị trí 12 giờ).
- Ảnh nền: Chọn một bức ảnh vệ tinh thực tế hoặc phong cảnh thực địa chất lượng cao, phẳng và nhìn thẳng.

NỘI DUNG CHÚ THÍCH (LỚP PHẤN TRẮNG):
- Bước 1 (Phân tích): Tự động xác định các TIÊU MỤC LỚN, xác định QUY TRÌNH chuyển động (mũi tên hướng gió, hướng núi, dòng chảy) hoặc các BỘ PHẬN địa lý từ văn bản RAG và câu hỏi người dùng.
- Bước 2 (Vẽ): Vẽ sơ đồ, mũi tên chỉ quy trình hoặc các nhãn dán trực quan (labels) bằng nét PHẤN TRẮNG (White Chalk) để giải thích rõ kiến thức ngay trên hình ảnh nền.
- Bước 3 (Thẩm mỹ): Phong cách Blueprint Aesthetic. Chữ viết Tiếng Việt 100%. Tiêu đề nằm trong ô vẽ box ở góc ảnh.

BẢO TỒN ĐỊA LÍ VIỆT NAM:
- Nếu liên quan đến Việt Nam, nhãn "Dãy Trường Sơn" phải uốn lượn sát hướng núi về phía Đông. Đảm bảo vị trí địa lí chính xác tuyệt đối.

THÔNG SỐ: Tỷ lệ 16:9, độ phân giải 4K, model Gemini 3 Pro Image.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: infographicPrompt }] },
      config: { 
        imageConfig: { 
          aspectRatio: "16:9", 
          imageSize: "4K" 
        } 
      },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) { 
    console.error("Lỗi tạo Infographic:", e); 
  }
  return null;
};

export const getExamMatrix = async (topic: string, grade: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Thiết kế ma trận đề thi Địa lí chuẩn (CV7991) cho: "${topic}", ${grade}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            subject: { type: Type.STRING },
            questionType: { type: Type.STRING },
            quantity: { type: Type.INTEGER },
            levels: {
              type: Type.OBJECT,
              properties: {
                remember: { type: Type.INTEGER },
                understand: { type: Type.INTEGER },
                apply: { type: Type.INTEGER },
                highApply: { type: Type.INTEGER },
              },
              required: ["remember", "understand", "apply", "highApply"]
            }
          },
          required: ["name", "subject", "questionType", "quantity", "levels"]
        }
      },
    }
  });
  return JSON.parse(response.text || "[]");
};

export const generateExamSets = async (topics: Topic[], topicInput: string, grade: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Soạn đề thi Địa lí cho ${grade}, chủ đề "${topicInput}" dựa trên ma trận: ${JSON.stringify(topics)}.`,
    config: { thinkingConfig: { thinkingBudget: 8000 } }
  });
  return response.text || "";
};

export const extractMatrixFromText = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Trích xuất ma trận đề thi sang JSON: \n\n ${text}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "[]");
};

export const extractMatrixFromMedia = async (base64: string, mimeType: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ inlineData: { data: base64, mimeType } }, { text: "Trích xuất ma trận đề thi sang JSON." }] }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "[]");
};
