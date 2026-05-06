// Operation Pivot stores student names unencrypted — decrypt is a passthrough
function decrypt(val) { return val || ''; }
function decryptRows(rows, fields) { return rows; }
module.exports = { decrypt, decryptRows };
