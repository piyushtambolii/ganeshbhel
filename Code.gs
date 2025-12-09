function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getInventory') {
    return ContentService.createTextOutput(JSON.stringify(getInventory())).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getDishes') {
    return ContentService.createTextOutput(JSON.stringify(getDishes())).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getHistory') {
     return ContentService.createTextOutput(JSON.stringify(getHistory())).setMimeType(ContentService.MimeType.JSON);
  } else if(action === 'addInventory') {
     addInventory(e.parameter);
     return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  } else if(action === 'addDish') {
     addDish(e.parameter);
     return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  } else if(action === 'createInvoice') {
     createInvoice(e.parameter);
     return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput("Ganesh Bhel API Active");
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Init headers if new
    if(name === 'Inventory') sheet.appendRow(['Name', 'Qty', 'Unit', 'Cost', 'Price']);
    if(name === 'Dishes') sheet.appendRow(['Name', 'Price', 'IngredientsJSON']);
    if(name === 'Invoices') sheet.appendRow(['ID', 'Customer', 'Mobile', 'Date', 'Total', 'ItemsJSON']);
  }
  return sheet;
}

function getInventory() {
  const sheet = getSheet('Inventory');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => ({ name: row[0], qty: row[1], unit: row[2], cost: row[3], price: row[4] }));
}

function getDishes() {
  const sheet = getSheet('Dishes');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => ({ name: row[0], price: row[1], ingredients: row[2] })); // ingredients stored as JSON string
}

function getHistory() {
   const sheet = getSheet('Invoices');
   const data = sheet.getDataRange().getValues();
   const headers = data.shift();
   // Return last 20
   return data.slice(-20).reverse().map(row => ({
       id: row[0], customerName: row[1], date: row[3], total: row[4]
   }));
}

function addInventory(params) {
  const sheet = getSheet('Inventory');
  sheet.appendRow([params.name, params.qty, params.unit, params.cost, params.price]);
}

function addDish(params) {
  const sheet = getSheet('Dishes');
  sheet.appendRow([params.name, params.price, params.ingredients]);
}

function createInvoice(params) {
  const sheet = getSheet('Invoices');
  const id = Utilities.getUuid();
  sheet.appendRow([id, params.customerName, params.customerMobile, params.date, params.total, params.items]);
  
  // Deduct Stock
  const items = JSON.parse(params.items);
  const dishSheet = getSheet('Dishes');
  const dishes = getDishes();
  const invSheet = getSheet('Inventory');
  const invData = invSheet.getDataRange().getValues();
  
  items.forEach(billItem => {
      // Find dish ingredients
      const dishObj = dishes.find(d => d.name === billItem.name);
      if(dishObj && dishObj.ingredients) {
          const ingredients = JSON.parse(dishObj.ingredients);
          ingredients.forEach(ing => {
               // Reduce inv stock
               // Find row in inventory
               for(let i=1; i<invData.length; i++) {
                   if(invData[i][0] === ing.item) {
                       const deduction = ing.qty * billItem.qty;
                       const currentQty = invData[i][1];
                       const newQty = currentQty - deduction;
                       invSheet.getRange(i+1, 2).setValue(newQty);
                       break;
                   }
               }
          });
      }
  });
}
