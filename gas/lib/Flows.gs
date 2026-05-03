/**
 * Flows.gs - CRUD Operations for Workflows
 */

/**
 * API: Get all flows
 */
function getFlows(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    if (!sheet) return { success: true, flows: [] };

    const data = sheet.getDataRange().getValues();
    const flows = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        let steps = [];
        try { steps = JSON.parse(data[i][3] || '[]'); } catch (e) { /* ignore */ }

        flows.push({
          flowId: data[i][0],
          flowName: data[i][1],
          description: data[i][2],
          steps: steps,
          createdBy: data[i][4],
          createdAt: data[i][5],
          isActive: data[i][6] === true || data[i][6] === 'TRUE',
        });
      }
    }

    return { success: true, flows: flows };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Create a new flow
 */
function createFlow(token, flowData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'SuperApprover'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    if (!sheet) return { success: false, error: 'FLOWS sheet not found' };

    const flowId = 'FLOW-' + new Date().getTime();
    const now = new Date().toISOString();

    sheet.appendRow([
      flowId,
      flowData.name,
      flowData.description || '',
      JSON.stringify(flowData.steps || []),
      session.email,
      now,
      true,
    ]);

    logAuditAction(flowId, session.email, 'CREATED', 'Flow created: ' + flowData.name);

    return { success: true, flowId: flowId, message: 'Flow created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Update a flow
 */
function updateFlow(token, flowId, flowData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'SuperApprover'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === flowId) {
        if (flowData.name) sheet.getRange(i + 1, 2).setValue(flowData.name);
        if (flowData.description !== undefined) sheet.getRange(i + 1, 3).setValue(flowData.description);
        if (flowData.steps) sheet.getRange(i + 1, 4).setValue(JSON.stringify(flowData.steps));
        if (flowData.isActive !== undefined) sheet.getRange(i + 1, 7).setValue(flowData.isActive);
        logAuditAction(flowId, session.email, 'UPDATED', 'Flow updated: ' + flowId);
        return { success: true, message: 'Flow updated' };
      }
    }

    return { success: false, error: 'Flow not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Delete a flow (soft delete)
 */
function deleteFlow(token, flowId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === flowId) {
        sheet.getRange(i + 1, 7).setValue(false);
        logAuditAction(flowId, session.email, 'DEACTIVATED', 'Flow deactivated: ' + flowId);
        return { success: true, message: 'Flow deactivated' };
      }
    }

    return { success: false, error: 'Flow not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Get a single flow by ID
 */
function getFlowById(token, flowId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === flowId) {
        let steps = [];
        try { steps = JSON.parse(data[i][3] || '[]'); } catch (e) { /* ignore */ }

        return {
          success: true,
          flow: {
            flowId: data[i][0],
            flowName: data[i][1],
            description: data[i][2],
            steps: steps,
            createdBy: data[i][4],
            createdAt: data[i][5],
            isActive: data[i][6] === true || data[i][6] === 'TRUE',
          },
        };
      }
    }

    return { success: false, error: 'Flow not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}