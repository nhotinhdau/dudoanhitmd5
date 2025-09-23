const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CẤU HÌNH ---
const HISTORY_API_URL = 'https://kkja.onrender.com/api/taixiumd5';

// --- THUẬT TOÁN DỰ ĐOÁN MỚI ---
/**
 * Thuật toán dự đoán Tài/Xỉu kết hợp Tần suất, EMA và Markov.
 * @param {Array<string>} history - Mảng chứa chuỗi "Tài" hoặc "Xỉu" của lịch sử kết quả.
 * @returns {object} - Đối tượng chứa dự đoán và tỷ lệ tin cậy.
 */
function vipPredictTX(history) {
  const N = 30; // Số phiên lịch sử được sử dụng để phân tích
  const emaLambda = 0.25; // Hằng số làm mượt cho EMA
  const baselineConf = 0.9; // Tỷ lệ tin cậy cơ bản

  const slice = history.slice(-N);
  if (slice.length === 0) return { du_doan: "Tài", ty_le_thanh_cong: "50.0%" };

  // 1. Phân tích Tần suất
  const countTai = slice.filter(x => x === "Tài").length;
  const freqTai = countTai / slice.length;

  // 2. Phân tích EMA (Exponential Moving Average)
  let ema = (slice[0] === "Tài") ? 1 : 0;
  for (let i = 1; i < slice.length; i++) {
    const v = (slice[i] === "Tài") ? 1 : 0;
    ema = ema * (1 - emaLambda) + v * emaLambda;
  }

  // 3. Phân tích Markov
  let t_TtoT = 0, t_TtoX = 0, t_XtoT = 0, t_XtoX = 0;
  for (let i = 0; i < slice.length - 1; i++) {
    const a = slice[i], b = slice[i + 1];
    if (a === "Tài" && b === "Tài") t_TtoT++;
    if (a === "Tài" && b === "Xỉu") t_TtoX++;
    if (a === "Xỉu" && b === "Tài") t_XtoT++;
    if (a === "Xỉu" && b === "Xỉu") t_XtoX++;
  }
  const sumT = t_TtoT + t_TtoX || 1;
  const sumX = t_XtoT + t_XtoX || 1;
  const last = slice[slice.length - 1];
  const markovTai = last === "Tài" ? t_TtoT / sumT : t_XtoT / sumX;

  // 4. Tổng hợp các chỉ số để tính điểm dự đoán cho "Tài"
  const scoreTai = 0.4 * freqTai + 0.3 * ema + 0.3 * markovTai;
  const pTai = scoreTai;
  const prediction = pTai >= 0.5 ? "Tài" : "Xỉu";

  // 5. Tính Tỷ lệ tin cậy (Confidence)
  const gap = Math.abs(pTai - 0.5) * 2;
  const conf = baselineConf + (1 - baselineConf) * gap;
  const confPercent = (conf * 100).toFixed(1) + "%";

  return { du_doan: prediction, ty_le_thanh_cong: confPercent };
}

// --- ENDPOINT DỰ ĐOÁN ---
app.get('/api/2k15', async (req, res) => {
  try {
    const response = await axios.get(HISTORY_API_URL);
    const data = Array.isArray(response.data) ? response.data : [response.data];
    if (!data || data.length === 0) throw new Error("Không có dữ liệu");

    const currentData = data[0];
    const nextSession = currentData.Phien + 1;
    
    // Lấy toàn bộ lịch sử kết quả để phân tích
    const historyResults = data.map(d => d.Ket_qua);
    
    // Sử dụng thuật toán mới
    const predictionResult = vipPredictTX(historyResults);

    res.json({
      id: "@cskhtoollxk",
      phien_truoc: currentData.Phien,
      xuc_xac: [currentData.Xuc_xac_1, currentData.Xuc_xac_2, currentData.Xuc_xac_3],
      tong_xuc_xac: currentData.Tong,
      ket_qua: currentData.Ket_qua,
      phien_sau: nextSession,
      du_doan: predictionResult.du_doan,
      do_tin_cay: predictionResult.ty_le_thanh_cong,
      giai_thich: "Dự đoán dựa trên phân tích thống kê Tần suất, EMA và Markov"
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      id: "@cskhtoollxk",
      error: "Lỗi hệ thống hoặc không thể lấy dữ liệu",
      du_doan: "Không thể dự đoán",
      do_tin_cay: "0%",
      giai_thich: "Đang chờ dữ liệu lịch sử"
    });
  }
});

app.get('/', (req, res) => {
  res.send("Chào mừng đến API dự đoán Tài Xỉu! Truy cập /api/2k15 để xem dự đoán.");
});

app.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));
  
