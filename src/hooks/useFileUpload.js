import { useState, useRef } from "react";

async function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(",")[1]);
    reader.onerror = () => rej(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsDataURL(file);
  });
}

const ALLOWED_DOC_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export default function useFileUpload() {
  const [docName, setDocName] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const fileRef = useRef(null);
  const camRef = useRef(null);

  async function processFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("הקובץ גדול מדי — עד 10MB בלבד.");
    }

    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";
    const isDoc = ALLOWED_DOC_TYPES.includes(file.type);

    if (!isImage && !isPDF && !isDoc) {
      throw new Error("ניתן לצרף PDF, תמונה, Word, Excel או טקסט.");
    }

    let base64, mediaType;

    if (isImage) {
      const compressed = await compressImage(file);
      if (compressed) {
        base64 = compressed.base64;
        mediaType = compressed.mediaType;
      } else {
        base64 = await readFileAsBase64(file);
        mediaType = file.type;
      }
    } else {
      base64 = await readFileAsBase64(file);
      mediaType = file.type;
    }

    if (base64.length > 3_500_000) {
      throw new Error("הקובץ גדול מדי לעיבוד — נסה לצלם מחדש באיכות נמוכה יותר.");
    }

    const userContent = [
      isImage
        ? { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }
        : { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: `צירפתי מסמך רפואי (${file.name}). אנא נתח אותו ומצא: אחוזי נכות, אבחנות רפואיות, תאריך פגיעה, וכל מידע רלוונטי לחישוב פיצויים.` },
    ];

    return { userContent, displayName: file.name };
  }

  return { docName, setDocName, showFilePicker, setShowFilePicker, fileRef, camRef, processFile };
}
