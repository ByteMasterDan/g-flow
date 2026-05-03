/**
 * Bootstrap.gs - Auto-Bootstrapping & Initialization
 * Creates required sheets and default admin user
 */

const SCHEMAS = {
  USERS: ['Email', 'PasswordHash', 'Role', 'DisplayName', 'Skills', 'CreatedAt', 'IsActive', 'LastLogin', 'Notes'],
  FLOWS: ['FlowID', 'FlowName', 'Description', 'Steps', 'FormData', 'FormLink', 'CreatedBy', 'CreatedAt', 'IsActive'],
  APPROVALS: ['ApprovalID', 'FlowID', 'CurrentStep', 'Status', 'SubmittedBy', 'EntityTag', 'Files', 'SubmittedAt', 'CompletedAt'],
  ENTITIES: ['EntityID', 'EntityType', 'DisplayName', 'VerifiedEmail', 'IsActive', 'CreatedAt'],
  SKILLS: ['SkillID', 'SkillName', 'Description', 'IsActive'],
  AUDIT_LOG: ['Timestamp', 'ApprovalID', 'ActorEmail', 'Action', 'Details', 'Metadata'],
};

/**
 * API: Setup the system with the provided spreadsheet ID
 */
function setupSystem(spreadsheetId) {
  if (!spreadsheetId) {
    return { success: false, error: 'Spreadsheet ID is required' };
  }

  try {
    // Validate spreadsheet access
    const ss = SpreadsheetApp.openById(spreadsheetId);
    if (!ss) {
      return { success: false, error: 'Cannot access spreadsheet. Check permissions.' };
    }

    // Save configuration
    CONFIG.setSpreadsheetId(spreadsheetId);

    // Bootstrap database
    const bootstrapResult = bootstrapDatabase();

    return {
      success: true,
      message: 'System configured successfully!',
      spreadsheetId: spreadsheetId,
      bootstrapResult: bootstrapResult,
    };
  } catch (e) {
    return { success: false, error: 'Setup failed: ' + e.message };
  }
}

/**
 * Bootstrap database - create required sheets and headers
 */
function bootstrapDatabase() {
  const result = { sheets: [], admin: null, errors: [] };

  try {
    const ss = CONFIG.getSpreadsheet();

    // Create required sheets
    for (const sheetName of Object.keys(SCHEMAS)) {
      try {
        let sheet = ss.getSheetByName(sheetName);

        // Create sheet if missing
        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
          result.sheets.push('Created: ' + sheetName);
        }

        // Inject headers if missing
        const headers = getHeaders(sheet);
        const expected = SCHEMAS[sheetName];

        if (!headers || headers.length === 0 || !expected[0] || !headers.includes(expected[0])) {
          sheet.getRange(1, 1, 1, expected.length).setValues([expected]).setFontWeight('bold');
          result.sheets.push('Headers added: ' + sheetName);
        }
      } catch (e) {
        result.errors.push(sheetName + ': ' + e.message);
      }
    }

    // Create default admin user if not exists
    try {
      const adminResult = createDefaultAdmin(ss);
      result.admin = adminResult;
    } catch (e) {
      result.errors.push('Admin creation: ' + e.message);
    }

    // Delete default "Sheet1" if exists
    try {
      const defaultSheet = ss.getSheetByName('Sheet1');
      if (defaultSheet && ss.getSheets().length > 1) {
        ss.deleteSheet(defaultSheet);
      }
    } catch (e) {
      // Ignore - might not exist
    }

    result.success = result.errors.length === 0;
  } catch (e) {
    result.errors.push('Bootstrap failed: ' + e.message);
    result.success = false;
  }

  return result;
}

/**
 * Create default admin user
 */
function createDefaultAdmin(ss) {
  const sheet = ss.getSheetByName('USERS');
  if (!sheet) return 'USERS sheet not found';

  const data = sheet.getDataRange().getValues();
  const adminEmail = 'admin@g-flow.local';

  // Check if admin already exists
  for (let i = 1; i < data.length; i++) {
    if ((data[i][0] || '').toString().toLowerCase() === adminEmail) {
      return 'Admin already exists';
    }
  }

  // Create admin user
  const passwordHash = hashPassword('admin123');
  sheet.appendRow([
    adminEmail,        // Email
    passwordHash,      // PasswordHash
    'Admin',           // Role
    'System Admin',    // DisplayName
    'all',             // Skills
    new Date().toISOString(), // CreatedAt
    true,              // IsActive
    '',                // LastLogin
    'Default admin - change password!', // Notes
  ]);

  return 'Admin created: ' + adminEmail + ' / admin123';
}

/**
 * Get headers from a sheet (Row 1)
 */
function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
}

/**
 * API: Force re-bootstrap (Admin only)
 */
function forceBootstrap(token) {
  if (!hasRole(token, 'Admin')) {
    return { success: false, error: 'Access denied' };
  }
  return bootstrapDatabase();
}