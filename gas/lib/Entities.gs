/**
 * Entities.gs - CRUD Operations for Entity Directory (DLP)
 */

/**
 * API: Get all entities
 */
function getEntities(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('ENTITIES');
    if (!sheet) return { success: true, entities: [] };

    const data = sheet.getDataRange().getValues();
    const entities = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        entities.push({
          entityId: data[i][0],
          entityType: data[i][1],
          displayName: data[i][2],
          verifiedEmail: data[i][3],
          isActive: data[i][4] === true || data[i][4] === 'TRUE',
          createdAt: data[i][5],
        });
      }
    }

    return { success: true, entities: entities };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Create a new entity
 */
function createEntity(token, entityData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'Operator'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('ENTITIES');
    if (!sheet) return { success: false, error: 'ENTITIES sheet not found' };

    const entityId = 'ENT-' + new Date().getTime();
    const now = new Date().toISOString();

    sheet.appendRow([
      entityId,
      entityData.type || 'Client',
      entityData.name,
      entityData.email,
      true,
      now,
    ]);

    return { success: true, entityId: entityId, message: 'Entity created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Update an entity
 */
function updateEntity(token, entityId, entityData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'Operator'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('ENTITIES');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === entityId) {
        if (entityData.type) sheet.getRange(i + 1, 2).setValue(entityData.type);
        if (entityData.name) sheet.getRange(i + 1, 3).setValue(entityData.name);
        if (entityData.email) sheet.getRange(i + 1, 4).setValue(entityData.email);
        if (entityData.isActive !== undefined) sheet.getRange(i + 1, 5).setValue(entityData.isActive);
        return { success: true, message: 'Entity updated' };
      }
    }

    return { success: false, error: 'Entity not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Delete an entity (soft delete)
 */
function deleteEntity(token, entityId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('ENTITIES');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === entityId) {
        sheet.getRange(i + 1, 5).setValue(false);
        return { success: true, message: 'Entity deactivated' };
      }
    }

    return { success: false, error: 'Entity not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}