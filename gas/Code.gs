/**
 * G-Flow Approval System - Main Entry Point
 * Web App + API Handler
 */

function doGet(e) {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('G-Flow Approval System')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>' + error.message + '</p>');
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function apiCall(jsonString) {
  const response = { success: false, data: null, error: null };

  try {
    const request = JSON.parse(jsonString);
    const { action, params } = request;
    const args = params || {};

    switch (action) {
      // System
      case 'isSystemConfigured':
        response.data = { configured: isSystemConfigured() };
        response.success = true;
        break;
      case 'setupSystem':
        response.data = setupSystem(args.spreadsheetId);
        break;
      case 'bootstrapDatabase':
        response.data = bootstrapDatabase();
        break;
      case 'getConfigStatus':
        response.data = getConfigStatus();
        response.success = true;
        break;
      case 'getDashboardStats':
        response.data = getDashboardStats(args.token);
        break;

      // Auth
      case 'login':
        response.data = login(args.email, args.password);
        break;
      case 'logout':
        response.data = logout(args.token);
        break;
      case 'getSession':
        response.data = getSession(args.token);
        break;
      case 'changePassword':
        response.data = changePassword(args.token, args.oldPassword, args.newPassword);
        break;

      // Users
      case 'getAllUsers':
        response.data = getAllUsers(args.token);
        break;
      case 'createUser':
        response.data = createUser(args.token, args.email, args.password, args.role, args.displayName);
        break;
      case 'updateUser':
        response.data = updateUser(args.token, args.email, args.updates);
        break;

      // Flows
      case 'getFlows':
        response.data = getFlows(args.token);
        break;
      case 'getFlowById':
        response.data = getFlowById(args.token, args.flowId);
        break;
      case 'createFlow':
        response.data = createFlow(args.token, args.flowData);
        break;
      case 'updateFlow':
        response.data = updateFlow(args.token, args.flowId, args.flowData);
        break;
      case 'deleteFlow':
        response.data = deleteFlow(args.token, args.flowId);
        break;

      // Entities
      case 'getEntities':
        response.data = getEntities(args.token);
        break;
      case 'createEntity':
        response.data = createEntity(args.token, args.entityData);
        break;
      case 'updateEntity':
        response.data = updateEntity(args.token, args.entityId, args.entityData);
        break;
      case 'deleteEntity':
        response.data = deleteEntity(args.token, args.entityId);
        break;

      // Audit
      case 'getAuditLogs':
        response.data = getAuditLogs(args.token, args.filters);
        break;

      // Flow Engine
      case 'startExecution':
        response.data = startExecution(args.token, args.flowId, args.formData, args.files);
        break;
      case 'getExecutions':
        response.data = getExecutions(args.token, args.flowId);
        break;
      case 'getApprovals':
        response.data = getApprovals(args.token);
        break;
      case 'processApproval':
        response.data = processApproval(args.token, args.executionId, args.action, args.comment);
        break;
      case 'getExecutionDetail':
        response.data = getExecutionDetail(args.token, args.executionId);
        break;
      case 'getGmailAliases':
        response.data = getGmailAliases();
        break;
      case 'sendFlowEmail':
        response.data = sendFlowEmail(args.token, args.config);
        break;
      case 'saveToSheet':
        response.data = saveToSheet(args.token, args.spreadsheetId, args.sheetName, args.data);
        break;
      case 'saveFileToDrive':
        response.data = saveFileToDrive(args.token, args.fileData, args.folderPath, args.fileName);
        break;

      // Bootstrap
      case 'forceBootstrap':
        response.data = forceBootstrap(args.token);
        break;

      default:
        response.error = 'Unknown action: ' + action;
    }

    response.success = response.data && response.data.success !== undefined ? response.data.success : !response.error;
  } catch (error) {
    response.error = error.message || 'Unknown error';
    response.success = false;
  }

  return response;
}

/**
 * Dashboard statistics
 */
function getDashboardStats(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();

    // Count flows
    const flowsSheet = ss.getSheetByName('FLOWS');
    let activeFlows = 0;
    if (flowsSheet) {
      const flowsData = flowsSheet.getDataRange().getValues();
      for (let i = 1; i < flowsData.length; i++) {
        if (flowsData[i][6] === true || flowsData[i][6] === 'TRUE') activeFlows++;
      }
    }

    // Count approvals by status
    const approvalsSheet = ss.getSheetByName('APPROVALS');
    let pendingApprovals = 0, approvedToday = 0, rejectedToday = 0;
    if (approvalsSheet) {
      const approvalsData = approvalsSheet.getDataRange().getValues();
      const today = new Date().toDateString();
      for (let i = 1; i < approvalsData.length; i++) {
        if (approvalsData[i][3] === 'Pending') pendingApprovals++;
        if (approvalsData[i][3] === 'Approved' && new Date(approvalsData[i][8]).toDateString() === today) approvedToday++;
        if (approvalsData[i][3] === 'Rejected' && new Date(approvalsData[i][8]).toDateString() === today) rejectedToday++;
      }
    }

    // Count entities
    const entitiesSheet = ss.getSheetByName('ENTITIES');
    let totalEntities = 0;
    if (entitiesSheet) {
      const entitiesData = entitiesSheet.getDataRange().getValues();
      for (let i = 1; i < entitiesData.length; i++) {
        if (entitiesData[i][4] === true || entitiesData[i][4] === 'TRUE') totalEntities++;
      }
    }

    // Count users
    const usersSheet = ss.getSheetByName('USERS');
    let totalUsers = 0;
    if (usersSheet) {
      const usersData = usersSheet.getDataRange().getValues();
      totalUsers = Math.max(0, usersData.length - 1);
    }

    // Get recent audit logs
    const recentLogs = [];
    const auditSheet = ss.getSheetByName('AUDIT_LOG');
    if (auditSheet) {
      const auditData = auditSheet.getDataRange().getValues();
      for (let i = Math.max(1, auditData.length - 5); i < auditData.length; i++) {
        if (auditData[i][0]) {
          recentLogs.push({
            timestamp: auditData[i][0],
            actorEmail: auditData[i][2],
            action: auditData[i][3],
            details: auditData[i][4],
          });
        }
      }
    }

    return {
      success: true,
      stats: {
        pendingApprovals,
        approvedToday,
        rejectedToday,
        activeFlows,
        totalEntities,
        totalUsers,
      },
      recentLogs: recentLogs.reverse(),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}