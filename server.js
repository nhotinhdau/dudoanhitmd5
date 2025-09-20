const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CẤU HÌNH ---
const HISTORY_API_URL = 'https://jaa-0pqn.onrender.com/api/taixiumd5';
let cachedConfidence = null;
let cachedSession = null;

// --- THƯ VIỆN 60 LOẠI CẦU VÀ TRỌNG SỐ ---
const MAU_CAU_LIBRARY = {
  // Cầu bệt (trọng số cao)
  "TTTT": 3, "TTTTT": 4, "TTTTTT": 5,
  "XXXX": 3, "XXXXX": 4, "XXXXXX": 5,

  // Cầu đảo (1-1, 2-2,...)
  "TXTXT": 2, "XTXTX": 2,
  "TTXXTT": 3, "XXTTXX": 3,
  "TTTXXX": 4, "XXXTTT": 4,
  "TTTTXXXX": 5, "XXXXTTTT": 5,
  "TTTTTXXXXX": 6, "XXXXXTTTTT": 6,

  // Cầu xen kẽ phức tạp
  "TXXTXX": 2, "XTTXTT": 2, "TXXTXT": 1, "XTTXTTX": 1,
  "TTXTXT": 1, "XXTXTX": 1, "TXTTXX": -1, "XTTXTT": -1,
  "TTXTT": 1, "XXTXX": 1, "TTXXT": -1, "XXTTX": -1,
  "TXXTT": -2, "XTTXX": -2,

  // Cầu "dây" hoặc "gián đoạn"
  "TTXT": -1, "TXXT": -1, "XXTX": -1,
  "TXXXT": -2, "TTXXT": -2, "TTTXXT": -3,
  "XXTTX": -2, "XXXTTX": -3, "TTTX": -1, "XXXT": -1,

  // Cầu "lộn xộn" hoặc "không rõ ràng" (trọng số âm)
  "TXXTX": -3, "TXTTX": -3, "XXTXX": -3, "XTXTX": -3,
  "TTXTX": -2, "XTTXT": -2, "TXXTT": -2, "TXTTT": -2,
  "XXTTX": -3, "XTXTT": -3, "TXTXX": -3, "XXTXT": -3,
  "TTXXT": -2, "TXXXX": -4, "XTTTT": -4, "TXTTX": -3,
  "XTXXT": -3, "XTTTX": -3, "TTXTT": -2, "XTXTT": -3
};

// --- HÀM HỖ TRỢ ---
function getConfidence(weight) {
  let baseConfidence = 50;
  if (weight > 5) {
    baseConfidence = 75 + Math.min(weight * 2, 15);
  } else if (weight < -5) {
    baseConfidence = 25 + Math.max(weight * 2, -15);
  } else {
    baseConfidence = 50 + Math.random() * 10 - 5;
  }
  return baseConfidence.toFixed(2) + "%";
}

function getBasePrediction(history) {
  if (!history || history.length === 0) return null;

  const lastDice = [history[0].Xuc_xac_1, history[0].Xuc_xac_2, history[0].Xuc_xac_3];
  const total = lastDice.reduce((a, b) => a + b, 0);

  let resultList = [];
  const weights = [0.5, 0.3, 0.2];
  for (let i = 0; i < 3; i++) {
    let tmp = lastDice[i] + total;
    if (tmp === 4 || tmp === 5) tmp -= 4;
    else if (tmp >= 6) tmp -= 6;
    let val = tmp % 2 === 0 ? "Tài" : "Xỉu";
    for (let j = 0; j < weights[i] * 10; j++) resultList.push(val);
  }

  let counts = { "Tài": 0, "Xỉu": 0 };
  resultList.forEach(v => counts[v]++);
  return counts["Tài"] >= counts["Xỉu"] ? "Tài" : "Xỉu";
}

function analyzeMauCau(cauHistory) {
  let totalWeight = 0;
  const recentHistory = cauHistory.join('');

  for (const pattern in MAU_CAU_LIBRARY) {
    let startIndex = 0;
    while (true) {
      const foundIndex = recentHistory.indexOf(pattern, startIndex);
      if (foundIndex === -1) break;
      totalWeight += MAU_CAU_LIBRARY[pattern];
      startIndex = foundIndex + 1;
    }
  }
  return totalWeight;
}

// --- ENDPOINT DỰ ĐOÁN ---
app.get('/api/2k15', async (req,res)=>{
  try{
    const response = await axios.get(HISTORY_API_URL);
    const data = Array.isArray(response.data)?response.data:[response.data];
    if(!data || data.length===0) throw new Error("Không có dữ liệu");

    const currentData = data[0];
    const nextSession = currentData.Phien+1;

    if(cachedSession !== currentData.Phien){
      cachedSession = currentData.Phien;
      cachedConfidence = null;
    }

    // Lấy 15 cầu gần nhất từ lịch sử kết quả để phân tích
    let cauHistory = data.slice(0,15).map(d=>d.Ket_qua==="Tài"?"T":"X");
    
    // Bước 1: Dự đoán cơ sở
    const basePrediction = getBasePrediction(data);

    // Bước 2: Phân tích cầu và tính trọng số
    const totalWeight = analyzeMauCau(cauHistory);

    // Bước 3: Đưa ra quyết định cuối cùng dựa trên trọng số
    let finalPrediction;
    let explanation;
    
    if (totalWeight > 5) {
      finalPrediction = basePrediction;
      explanation = "Cầu đẹp, xu hướng ổn định. Nên vào tiền.";
    } else if (totalWeight < -5) {
      finalPrediction = basePrediction === "Tài" ? "Xỉu" : "Tài";
      explanation = "Cầu đang gãy! Đảo ngược dự đoán.";
    } else {
      finalPrediction = basePrediction;
      explanation = "Cầu không rõ ràng, tiềm ẩn rủi ro.";
    }

    if (!cachedConfidence) {
      cachedConfidence = getConfidence(totalWeight);
    }

    res.json({
      id: "@cskhtoollxk",
      phien_truoc: currentData.Phien,
      xuc_xac: [currentData.Xuc_xac_1, currentData.Xuc_xac_2, currentData.Xuc_xac_3],
      tong_xuc_xac: currentData.Tong,
      ket_qua: currentData.Ket_qua,
      phien_sau: nextSession,
      du_doan: finalPrediction,
      do_tin_cay: cachedConfidence,
      giai_thich: explanation
    });
    
  }catch(err){
    console.error(err.message);
    res.status(500).json({
      id: "@cskhtoollxk",
      error:"Lỗi hệ thống hoặc không thể lấy dữ liệu",
      du_doan:"Không thể dự đoán",
      do_tin_cay:"0%",
      giai_thich:"Đang chờ dữ liệu lịch sử"
    });
  }
});

app.get('/',(req,res)=>{
  res.send("Chào mừng đến API dự đoán Tài Xỉu! Truy cập /api/taixiu/du_doan_68gb để xem dự đoán.");
});

app.listen(PORT,()=>console.log(`Server đang chạy trên cổng ${PORT}`));
        
