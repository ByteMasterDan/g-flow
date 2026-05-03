/**
 * FlowEngine.gs - Execution Engine for Workflows
 * Manages flow execution state machine
 */

const EXECUTION_SHEET = 'EXECUTIONS';

/**
 * Initialize EXECUTIONS sheet if not exists
 */
function initExecutionsSheet() {
  const ss = CONFIG.getSpreadsheet();
  let sheet = ss.getSheetByName(EXECUTION_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(EXECUTION_SHEET);
    sheet.getRange(1, 1, 1, 10).setValues([
      ['ExecutionId', 'FlowId', 'FlowName', 'SubmittedBy', 'CurrentStep', 'Status', 'FormData', 'StartedAt', 'CompletedAt', 'Notes']
    ]).setFontWeight('bold');
  }
  return sheet;
}

/**
 * API: Start a new execution of a flow
 */
function startExecution(token, flowId, formData, files) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const sheet = initExecutionsSheet();
    const executionId = 'EXEC-' + new Date().getTime();
    const now = new Date().toISOString();

    sheet.appendRow([
      executionId,
      flowId,
      '',
      session.email,
      0,
      'Pending',
      JSON.stringify(formData || {}),
      now,
      '',
      JSON.stringify({ files: files || [] }),
    ]);

    logAuditAction(executionId, session.email, 'EXECUTION_STARTED', 'Flow execution started: ' + flowId);

    return { success: true, executionId: executionId, message: 'Execution started' };
  } catch (e) {
    return { success: false, error: 'startExecution error: ' + e.message };
  }
}

/**
 * API: Get all executions (for Admin/SuperApprover)
 */
function getExecutions(token, flowId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: true, executions: [] };

    const data = sheet.getDataRange().getValues();
    const executions = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        let formData = {};
        try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

        const exec = {
          executionId: data[i][0],
          flowId: data[i][1],
          flowName: data[i][2],
          submittedBy: data[i][3],
          currentStep: data[i][4],
          status: data[i][5],
          formData: formData,
          startedAt: data[i][7],
          completedAt: data[i][8],
          notes: data[i][9],
        };

        if (!flowId || exec.flowId === flowId) {
          executions.push(exec);
        }
      }
    }

    executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return { success: true, executions: executions };
  } catch (e) {
    return { success: false, error: 'getExecutions error: ' + e.message };
  }
}

/**
 * API: Get pending approvals for current user
 */
function getApprovals(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: true, approvals: [] };

    const data = sheet.getDataRange().getValues();
    const approvals = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][5] === 'Pending') {
        let formData = {};
        try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

        approvals.push({
          executionId: data[i][0],
          flowId: data[i][1],
          flowName: data[i][2],
          submittedBy: data[i][3],
          currentStep: data[i][4],
          status: data[i][5],
          formData: formData,
          startedAt: data[i][7],
        });
      }
    }

    return { success: true, approvals: approvals };
  } catch (e) {
    return { success: false, error: 'getApprovals error: ' + e.message };
  }
}

/**
 * API: Process an approval action
 */
function processApproval(token, executionId, action, comment) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === executionId) {
        const newStatus = action === 'APPROVE' ? 'Approved' : action === 'REJECT' ? 'Rejected' : 'Pending';
        sheet.getRange(i + 1, 6).setValue(newStatus);

        if (action !== 'REQUEST_REVISION') {
          sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
        }

        sheet.getRange(i + 1, 10).setValue(comment || '');

        logAuditAction(executionId, session.email, action, 'Execution ' + action.toLowerCase() + ': ' + executionId);

        return { success: true, message: 'Execution ' + action.toLowerCase() };
      }
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'processApproval error: ' + e.message };
  }
}

/**
 * API: Get execution detail
 */
function getExecutionDetail(token, executionId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === executionId) {
        let formData = {};
        try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

        return {
          success: true,
          execution: {
            executionId: data[i][0],
            flowId: data[i][1],
            flowName: data[i][2],
            submittedBy: data[i][3],
            currentStep: data[i][4],
            status: data[i][5],
            formData: formData,
            startedAt: data[i][7],
            completedAt: data[i][8],
            notes: data[i][9],
          },
        };
      }
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'getExecutionDetail error: ' + e.message };
  }
}

/**
 * API: Get Gmail aliases for email From dropdown
 */
function getGmailAliases() {
  try {
    const aliases = GmailApp.getAliases();
    const defaultEmail = Session.getActiveUser().getEmail();
    return { success: true, aliases: [defaultEmail, ...aliases] };
  } catch (e) {
    return { success: false, error: 'getGmailAliases error: ' + e.message };
  }
}

/**
 * API: Send email via Gmail
 */
function sendFlowEmail(token, config) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const fromAlias = config.from || Session.getActiveUser().getEmail();
    const subject = config.subject || 'No Subject';
    const body = config.body || '';
    const htmlBody = config.htmlBody || body;

    const options = {
      from: fromAlias,
      name: config.fromName || 'G-Flow Approval System',
    };

    if (config.cc && config.cc.length > 0) {
      options.cc = config.cc.join(',');
    }
    if (config.bcc && config.bcc.length > 0) {
      options.bcc = config.bcc.join(',');
    }

    if (config.attachments && config.attachments.length > 0) {
      options.attachments = config.attachments;
    }

    GmailApp.sendEmail(config.to.join(','), subject, body, options);

    if (config.executionId) {
      logAuditAction(config.executionId, session.email, 'EMAIL_SENT', 'Email sent to: ' + config.to.join(', '));
    }

    return { success: true, message: 'Email sent' };
  } catch (e) {
    return { success: false, error: 'sendFlowEmail error: ' + e.message };
  }
}

/**
 * API: Save data to a specific spreadsheet/sheet
 */
function saveToSheet(token, spreadsheetId, sheetName, data) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      let headers = [];
      const lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      }
      
      const newKeys = Object.keys(data).filter(k => !headers.includes(k));
      if (newKeys.length > 0) {
        headers.push(...newKeys);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      }

      const values = headers.map(h => data[h] !== undefined ? data[h] : '');

      if (sheet.getLastRow() === 1 && sheet.getLastColumn() === 1 && sheet.getRange(1, 1).getValue() === '') {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.getRange(2, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
    }

    return { success: true, message: 'Data saved to ' + sheetName };
  } catch (e) {
    return { success: false, error: 'saveToSheet error: ' + e.message };
  }
}

/**
 * API: Save file to Drive folder
 */
function saveFileToDrive(token, fileData, folderPath, fileName) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    let rootFolderId = PROPS.getProperty('ROOT_DRIVE_FOLDER_ID');

    if (!rootFolderId) {
      const rootFolder = DriveApp.getRootFolder();
      rootFolderId = rootFolder.getId();
    }

    let parentFolder = DriveApp.getFolderById(rootFolderId);
    const pathParts = folderPath.split('/').filter(Boolean);

    for (const part of pathParts) {
      let found = false;
      const folders = parentFolder.getFoldersByName(part);
      if (folders.hasNext()) {
        parentFolder = folders.next();
        found = true;
      }
      if (!found) {
        parentFolder = parentFolder.createFolder(part);
      }
    }

    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData.base64),
      fileData.mimeType || 'application/octet-stream',
      fileName || fileData.name
    );

    const file = parentFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      message: 'File saved to Drive',
    };
  } catch (e) {
    return { success: false, error: 'saveFileToDrive error: ' + e.message };
  }
}

/**
 * API: Create a new spreadsheet for flow
 */
function createSpreadsheetForFlow(token, name) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = SpreadsheetApp.create(name || 'New Flow Spreadsheet');
    const file = DriveApp.getFileById(ss.getId());
    
    // Attempt to move to root folder if configured
    let rootFolderId = PROPS.getProperty('ROOT_DRIVE_FOLDER_ID');
    if (rootFolderId) {
      const folder = DriveApp.getFolderById(rootFolderId);
      file.moveTo(folder);
    }
    
    return { success: true, spreadsheetId: ss.getId(), url: ss.getUrl() };
  } catch (e) {
    return { success: false, error: 'createSpreadsheet error: ' + e.message };
  }
}

/**
 * API: Get submitted documents
 */
function getDocuments(token, filterEntity) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('APPROVALS');
    if (!sheet) return { success: true, documents: [] };

    const data = sheet.getDataRange().getValues();
    const documents = [];

    // APPROVALS schema: ['ApprovalID', 'FlowID', 'CurrentStep', 'Status', 'SubmittedBy', 'EntityTag', 'Files', 'SubmittedAt', 'CompletedAt']
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      
      const entityTag = data[i][5];
      if (filterEntity && entityTag.toLowerCase() !== filterEntity.toLowerCase() && 
          !entityTag.toLowerCase().includes(filterEntity.toLowerCase())) {
        continue;
      }
      
      let files = [];
      try { 
        files = JSON.parse(data[i][6] || '[]'); 
      } catch (e) { }

      if (files.length > 0) {
        documents.push({
          approvalId: data[i][0],
          flowId: data[i][1],
          status: data[i][3],
          submittedBy: data[i][4],
          entityTag: entityTag,
          files: files,
          submittedAt: data[i][7],
        });
      }
    }

    return { success: true, documents };
  } catch (e) {
    return { success: false, error: 'getDocuments error: ' + e.message };
  }
}