// Google Apps Script backend for order intake from GitHub Pages front-end
// - Accepts FormData with a field named "payload" (JSON string)
// - Stores order in Google Sheet
// - Sends confirmation email with full details

/**
 * Handle POST requests from front-end
 * Front-end sends FormData: payload=<JSON>
 */
function doPost(e) {
  try {
    var rawPayload = '';
    // Prefer FormData param 'payload'
    if (e && e.parameter && e.parameter.payload) {
      rawPayload = e.parameter.payload;
    } else if (e && e.postData && e.postData.contents) {
      // Fallback: JSON body
      rawPayload = e.postData.contents;
    } else {
      throw new Error('No payload found in request');
    }

/**
 * Health check endpoint: open the Web App URL in a browser to see 'ok'.
 */
function doGet(e){
  return ContentService
    .createTextOutput('ok')
    .setMimeType(ContentService.MimeType.TEXT);
}

    var body = JSON.parse(rawPayload);

    var EMAIL_TO = 'qarsatnahlah@gmail.com'; // Your email (updated)
    var SHEET_ID = ''; // Optional: put your Google Sheet ID here. If left blank, a file named 'Orders' will be used/created.
    var SHEET_NAME = 'Orders';

    var sheet = getOrCreateSheet(SHEET_ID, SHEET_NAME);
    writeOrderToSheet(sheet, body);
    Logger.log('Wrote order to sheet: %s', body.orderId);
    sendOrderEmail(EMAIL_TO, body);
    Logger.log('Sent email to: %s for order %s', EMAIL_TO, body.orderId);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get or create a Google Sheet to store orders
 */
function getOrCreateSheet(sheetId, sheetName){
  var ss;
  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    var files = DriveApp.getFilesByName('Orders');
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create('Orders');
    }
  }
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  var header = [
    'Timestamp','Order ID','Full Name','Phone','Address','City','Email','Payment Method',
    'Items JSON','Total Before','Total After','Site'
  ];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
  }
  return sheet;
}

/**
 * Append one order row into the sheet.
 */
function writeOrderToSheet(sheet, body){
  var row = [
    body.timestamp || new Date().toISOString(),
    body.orderId || '',
    (body.customer && body.customer.fullName) || '',
    (body.customer && body.customer.phone) || '',
    (body.customer && body.customer.address) || '',
    (body.customer && body.customer.city) || '',
    (body.customer && body.customer.email) || '',
    body.paymentMethod || '',
    JSON.stringify(body.items || []),
    (body.totals && body.totals.totalBefore) || 0,
    (body.totals && body.totals.totalAfter) || 0,
    body.site || ''
  ];
  sheet.appendRow(row);
}

/**
 * Send a detailed email with the order information.
 */
function sendOrderEmail(emailTo, body){
  var subject = 'طلب جديد #' + (body.orderId || '');
  var lines = [];
  lines.push('وصل طلب جديد بالتفاصيل التالية:\n');
  lines.push('رقم الطلب: ' + (body.orderId || ''));
  lines.push('التاريخ: ' + (body.timestamp || ''));
  lines.push('--------------------------');
  lines.push('الاسم: ' + ((body.customer && body.customer.fullName) || ''));
  lines.push('الهاتف: ' + ((body.customer && body.customer.phone) || ''));
  lines.push('العنوان: ' + ((body.customer && body.customer.address) || '') + ', ' + ((body.customer && body.customer.city) || ''));
  lines.push('البريد الإلكتروني: ' + ((body.customer && body.customer.email) || ''));
  lines.push('طريقة الدفع: ' + (body.paymentMethod || ''));
  lines.push('--------------------------');
  lines.push('تفاصيل المنتجات:');
  var items = body.items || [];
  for (var i=0; i<items.length; i++){
    var it = items[i];
    lines.push((i+1) + ') ' + it.title);
    lines.push('- سعر الوحدة: ' + it.unitPrice + ' | الكمية: ' + it.qty + ' | الإجمالي: ' + it.lineTotalAfter);
    if (it.origUnitPrice && it.origUnitPrice !== it.unitPrice){
      lines.push('- قبل الخصم: ' + it.origUnitPrice + ' × ' + it.qty + ' = ' + it.lineTotalBefore);
    }
  }
  lines.push('--------------------------');
  lines.push('الإجمالي قبل الخصم: ' + ((body.totals && body.totals.totalBefore) || 0));
  if ((body.totals && body.totals.totalBefore) !== (body.totals && body.totals.totalAfter)){
    lines.push('الإجمالي بعد الخصم: ' + ((body.totals && body.totals.totalAfter) || 0));
  } else {
    lines.push('الإجمالي: ' + ((body.totals && body.totals.totalAfter) || 0));
  }
  lines.push('\nمع تحياتي.');

  MailApp.sendEmail({
    to: emailTo,
    subject: subject,
    htmlBody: '<pre style="font-family:inherit; white-space:pre-wrap">' + lines.join('\n') + '</pre>'
  });
}
