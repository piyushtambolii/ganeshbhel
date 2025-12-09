// Google Apps Script Code
// 1. Create a new Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Paste this code into Code.gs
// 4. Run 'setupSheet' function once to create headers.
// 5. Deploy as Web App:
//    - Description: "v1"
//    - Execute as: "Me"
//    - Who has access: "Anyone"
// 6. Copy the URL and paste it into script.js API_URL

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const action = e.parameter.action;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    
    if (action === 'createInvoice') {
      const data = JSON.parse(e.parameter.items); // Array of items
      const billNo = e.parameter.id;
      const customer = e.parameter.customerName;
      const total = e.parameter.total;
      const date = new Date().toLocaleString();
      
      // Store plain row: [Date, BillNo, Customer, Items_Summary, Total]
      const itemsSummary = data.map(i => `${i.name} (${i.qty})`).join(', ');
      
      sheet.appendRow([date, billNo, customer, itemsSummary, total]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', row: sheet.getLastRow() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getHistory') {
       const rows = sheet.getDataRange().getValues();
       const headers = rows.shift();
       const history = rows.map((r, i) => ({
         date: r[0],
         id: r[1],
         customer: r[2],
         items: r[3],
         total: r[4]
       })).reverse().slice(0, 20); // Last 20
       
       return ContentService.createTextOutput(JSON.stringify(history))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Orders');
  if (!sheet) {
    sheet = ss.insertSheet('Orders');
    sheet.appendRow(['Date', 'Bill No', 'Customer Name', 'Items', 'Total Amount']);
  }
}
