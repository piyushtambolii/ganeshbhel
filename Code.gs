// Google Apps Script Code for POS Backend
// ==========================================
// SETUP INSTRUCTIONS:
// 1. Create a new Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Paste this ENTIRE code into Code.gs (delete old code).
// 4. Run the 'setup' function once. (Select 'setup' from the dropdown and click Run).
//    - This will create 'Items' and 'Orders' sheets if they don't exist.
//    - Grant permissions when asked.
// 5. Click 'Deploy' > 'New deployment'.
//    - Select type: 'Web app'.
//    - Description: 'v2'
//    - Execute as: 'Me' (Verify this!)
//    - Who has access: 'Anyone' (Verify this!)
// 6. Copy the new Web App URL.
// 7. Paste the URL into your local 'script.js' file as the API_URL.

// --- CONFIGURATION ---
const SHEET_ITEMS = "Items";
const SHEET_ORDERS = "Orders";

// --- DO NOT EDIT BELOW UNLESS YOU KNOW GAS ---

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // Wait up to 30 seconds for other processes to finish.
  lock.tryLock(30000);

  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- ACTION: GET ITEMS ---
    if (action === "getItems") {
      const sheet = ss.getSheetByName(SHEET_ITEMS);
      if (!sheet) return errorResponse("Items sheet not found. Run setup.");

      const data = sheet.getDataRange().getValues();
      const headers = data.shift(); // Remove headers

      const items = data
        .map((row) => ({
          code: String(row[0]),
          name: row[1],
          price: Number(row[2]),
          type: row[3],
          image: row[4] || "",
        }))
        .filter((i) => i.code && i.name); // Filter empty rows

      return successResponse(items);
    }

    // --- ACTION: CREATE INVOICE ---
    if (action === "createInvoice") {
      const sheet = ss.getSheetByName(SHEET_ORDERS);
      if (!sheet) return errorResponse("Orders sheet not found");

      const billNo = e.parameter.id;
      const date = new Date().toLocaleString("en-IN"); // India format
      const customer = e.parameter.customerName || "Walk-in";
      const total = e.parameter.total;
      const itemsJson = e.parameter.items;

      // Parse items to create a readable string
      let itemsSummary = "";
      try {
        const items = JSON.parse(itemsJson);
        itemsSummary = items.map((i) => `${i.name} x${i.qty}`).join(", ");
      } catch (err) {
        itemsSummary = itemsJson;
      }

      sheet.appendRow([date, billNo, customer, itemsSummary, total, itemsJson]);
      return successResponse({ id: billNo, row: sheet.getLastRow() });
    }

    // --- ACTION: GET HISTORY ---
    if (action === "getHistory") {
      const sheet = ss.getSheetByName(SHEET_ORDERS);
      if (!sheet) return successResponse([]);

      const data = sheet.getDataRange().getValues();
      data.shift(); // remove header

      // Get last 50 orders
      const history = data
        .reverse()
        .slice(0, 50)
        .map((r) => ({
          date: r[0],
          id: r[1],
          customer: r[2],
          // simple object structure
          total: r[4],
        }));

      return successResponse(history);
    }

    return errorResponse("Unknown action: " + action);
  } catch (error) {
    return errorResponse(error.toString());
  } finally {
    lock.releaseLock();
  }
}

// --- HELPER FUNCTIONS ---

function successResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function errorResponse(msg) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "error", message: msg })
  ).setMimeType(ContentService.MimeType.JSON);
}

// --- SETUP FUNCTION ---
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Setup Items Sheet
  let itemsSheet = ss.getSheetByName(SHEET_ITEMS);
  if (!itemsSheet) {
    itemsSheet = ss.insertSheet(SHEET_ITEMS);
    // Add some default items to help the user get started
    itemsSheet.appendRow([
      "Code",
      "Item Name",
      "Price",
      "Category",
      "Image URL",
    ]);
    itemsSheet.appendRow(["1", "Bhel Puri", "60", "Bhel", ""]);
    itemsSheet.appendRow(["2", "Pani Puri", "40", "Pani Puri", ""]);
    itemsSheet.appendRow(["3", "SPDP", "80", "Chaat", ""]);
    itemsSheet.setFrozenRows(1);
  }

  // Setup Orders Sheet
  let ordersSheet = ss.getSheetByName(SHEET_ORDERS);
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet(SHEET_ORDERS);
    ordersSheet.appendRow([
      "Date",
      "Bill No",
      "Customer Name",
      "Items Summary",
      "Total Amount",
      "Items JSON",
    ]);
    ordersSheet.setFrozenRows(1);
  }
}
