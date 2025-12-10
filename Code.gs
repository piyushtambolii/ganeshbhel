// Google Apps Script for Ganesh Bhel PWA Backend

// SCRIPT PROPERTIES
const SHEET_ID = ""; // Optional: Hardcode if needed, otherwise uses Active Spreadsheet

// --- SETUP ---
// Run this function once from the Run button above to create all sheets automatically
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Initialize each sheet
  getSheet("Items");
  getSheet("History");
  getSheet("OpenOrders");
  getSheet("DailySummaries");

  Logger.log("Setup Complete. Sheets created with headers.");
}

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const params = e.parameter;
    const action = params.action;

    if (action === "getItems") {
      return getItems();
    } else if (action === "getHistory") {
      return getHistory();
    } else if (action === "getOpenOrders") {
      return getOpenOrders();
    } else if (action === "saveOrder") {
      return saveOrder(params);
    } else if (action === "saveDailySummary") {
      return saveDailySummary(params);
    }

    return jsonResponse({ status: "error", message: "Invalid action" });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- ACTIONS ---

function getItems() {
  const sheet = getSheet("Items");
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // remove header

  // Convert to array of objects
  const items = data
    .map((row) => ({
      code: row[0],
      name: row[1],
      price: row[2],
      type: row[3],
      image: row[4],
    }))
    .filter((i) => i.code && i.name);

  return jsonResponse(items);
}

function getHistory() {
  const sheet = getSheet("History");
  // Get last 100 orders to save bandwidth? Or all.
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const history = data
    .map((row) => ({
      id: row[0],
      date: row[1],
      customer: row[2],
      tableId: row[3],
      status: row[4],
      total: row[5],
      items: parseJSON(row[6]), // Helper to safely parse
    }))
    .reverse()
    .slice(0, 100); // Return last 100

  return jsonResponse(history);
}

function getOpenOrders() {
  const sheet = getSheet("OpenOrders");
  const data = sheet.getDataRange().getValues();
  data.shift();

  const orders = data
    .map((row) => ({
      tableId: row[0],
      order: parseJSON(row[1]),
      updated: row[2],
    }))
    .filter((o) => o.tableId);

  return jsonResponse(orders);
}

function saveOrder(p) {
  // Params: id, tableId, status, total, customer, date, items (JSON)
  const status = p.status || "OPEN";

  if (status === "CLOSED") {
    // Append to History
    const sheet = getSheet("History");
    // Schema: ID, Date, Customer, Table, Status, Total, ItemsJSON
    sheet.appendRow([
      p.id,
      p.date || new Date().toISOString(),
      p.customer,
      p.tableId,
      "CLOSED",
      p.total,
      p.items,
    ]);

    // Remove from OpenOrders if existing
    removeFromOpenOrders(p.tableId);
  } else {
    // Upsert into OpenOrders
    const sheet = getSheet("OpenOrders");
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Find row with tableId
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == p.tableId) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }

    const rowData = [p.tableId, p.items, new Date().toISOString()];

    if (rowIndex > 0) {
      // Update
      sheet.getRange(rowIndex, 1, 1, 3).setValues([rowData]);
    } else {
      // Insert
      sheet.appendRow(rowData);
    }
  }

  return jsonResponse({ status: "success" });
}

function saveDailySummary(p) {
  const sheet = getSheet("DailySummaries");
  // Schema: Date, TotalSales, TotalDishes, HistoryJSON
  sheet.appendRow([p.date, p.totalSales, p.totalDishes, p.history]);
  return jsonResponse({ status: "success" });
}

// --- HELPERS ---

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Init headers
    if (name === "Items")
      sheet.appendRow(["Code", "Name", "Price", "Type", "Image"]);
    if (name === "History")
      sheet.appendRow([
        "Order ID",
        "Date",
        "Customer",
        "Table ID",
        "Status",
        "Total",
        "Items JSON",
      ]);
    if (name === "OpenOrders")
      sheet.appendRow(["Table ID", "Items JSON", "Last Updated"]);
    if (name === "DailySummaries")
      sheet.appendRow(["Date", "Total Sales", "Total Dishes", "Details JSON"]);
  }
  return sheet;
}

function removeFromOpenOrders(tableId) {
  const sheet = getSheet("OpenOrders");
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == tableId) {
      sheet.deleteRow(i + 1);
    }
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return [];
  }
}
