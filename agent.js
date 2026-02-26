const sql = require('mssql');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const CONFIG = {
  user: process.env.USER_ID,        // SQL username
  password: process.env.PSWD,  // SQL password
  server: process.env.SERVER_NAME,          // SQL server address
  database: process.env.DB_NAME,         // Your DB name
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const RENDER_URL = process.env.RENDER_URL;
const API_KEY = process.env.API_KEY;

async function pollRender() {
  try {
    const response = await axios.get(RENDER_URL, {
      headers: { "x-api-key": API_KEY }
    });

    const requests = response.data;

    if (requests.length === 0) return;

    const pool = await sql.connect(CONFIG);

    for (const req of requests) {
        console.log("Processing student:", req.studentId);
        console.log("for trip id:", req.tripid);
        console.log("at academic year:", req.curyear);

        console.log("DEBUG VALUES:");
        console.log("studentId =", req.studentId, typeof req.studentId);
        console.log("tripid =", req.tripid, typeof req.tripid);
        console.log("curyear =", req.curyear, typeof req.curyear)
        const debugQuery = `
        SELECT ISNULL(SUM(PAIDAMOUNT),0) AS TOTPAID
        FROM [EA-FINANCE].ALSSONACTIVITIES.DBO.AM_TRP_REC
        WHERE CURYEAR='${req.curyear}'
        AND tripid=${req.tripid}
        AND S_CODE='${req.studentId}'
        `;

        //console.log("DEBUG QUERY:", debugQuery);
        console.log(RENDER_URL)

    //   const result = await pool.request()
    //     .input("studentId", sql.VarChar, req.studentId)
    //     .input("curyear", sql.VarChar, req.curyear)
    //     .input("tripid", sql.Int, req.tripid)

    //     .query("SELECT ISNULL(SUM(PAIDAMOUNT),0) AS TOTPAID FROM [EA-FINANCE].ALSSONACTIVITIES.DBO.AM_TRP_REC WHERE CURYEAR=@curyear and tripid=@tripid and S_CODE = @studentId");

const result = await pool.request()
    .input("studentId", sql.VarChar, req.studentId)
    .input("curyear", sql.VarChar, req.curyear)
    .input("tripid", sql.Int, req.tripid)
    .query(`
        SELECT ISNULL(SUM(PAIDAMOUNT),0) AS TOTPAID
        FROM [EA-FINANCE].ALSSONACTIVITIES.DBO.AM_TRP_REC
        WHERE CURYEAR = @curyear
          AND tripid = @tripid
          AND S_CODE = @studentId
    `);
        await axios.post(RENDER_URL, {
        requestId: req.requestId,
        data: result.recordset
      }, {
        headers: { "x-api-key": API_KEY }
      });
    }

    pool.close();

  } catch (err) {
    console.error("Error:", err.message);
  }
}

setInterval(pollRender, 5000);
console.log("Bridge Agent Started...");
