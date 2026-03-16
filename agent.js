const sql = require('mssql');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const CONFIG = {
  user: process.env.USER_ID,
  password: process.env.PSWD,
  server: process.env.SERVER_NAME,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const RENDER_URL = process.env.RENDER_URL;
const API_KEY = process.env.API_KEY;

console.log("Render URL:", RENDER_URL);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollRender() {
  let pool;

  try {
    const response = await axios.get(`${RENDER_URL}/pending`, {
      headers: { "x-api-key": API_KEY },
      timeout: 30000
    });

    const requests = response.data || [];

    if (requests.length === 0) {
      console.log("No pending requests.");
      return;
    }

    pool = await sql.connect(CONFIG);

    for (const req of requests) {
      console.log("Processing student:", req.studentId);
      console.log("Trip:", req.tripid, "Year:", req.curyear);

      const result = await pool.request()
        .input("studentId", sql.VarChar, req.studentId)
        .input("curyear", sql.VarChar, req.curyear)
        .input("tripid", sql.Int, req.tripid)
        .query(`SELECT 
        ISNULL((SELECT ISNULL(SUM(PAIDAMOUNT),0) AS TOTPAID FROM [EA-FINANCE].ALSSONACTIVITIES.DBO.AM_TRP_REC 
        WHERE CURYEAR=@CURYEAR
        AND tripid=@tripid
        AND S_CODE=@studentId),0)
        +
        ISNULL((SELECT ISNULL(SUM(PAIDAMOUNT),0) AS TOTPAID FROM [EA-FINANCE].ALSSONACTIVITIES.DBO.BR_TRP_REC 
        WHERE CURYEAR=@CURYEAR
        AND tripid=@tripid
        AND S_CODE=@studentId),0)     
        AS TOTPAID 
        `);

      await axios.post(`${RENDER_URL}/pending`, {
        requestId: req.requestId,
        data: result.recordset
      }, {
        headers: { "x-api-key": API_KEY },
        timeout: 30000
      });

      // small pause between POSTs if multiple requests exist
      await delay(500);
    }

  } catch (err) {
    if (err.response) {
      console.error("HTTP Error:", err.response.status, err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (e) {}
    }
  }
}

async function startAgent() {
  console.log("Bridge Agent Started...");

  while (true) {
    await pollRender();

    // wait AFTER current poll completes
    await delay(10000); // 10 sec (safer than 5 sec)
  }
}

startAgent();
