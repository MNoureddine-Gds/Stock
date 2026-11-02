(function () {
  const headers = [
    'Code article',
    'Désignation',
    'Magasin',
    'Division',
    'Emplacement',
    'Quantité initiale',
    'Code barre',
    'Date inventaire'
  ];
  const requiredHeaders = [
    'Code article',
    'Magasin',
    'Division',
    'Emplacement',
    'Quantité initiale'
  ];
  const aliases = {
    'Code article': 'articlecode',
    'Désignation': 'designation',
    'Magasin': 'storename',
    'Division': 'divisionname',
    'Emplacement': 'address',
    'Quantité initiale': 'quantity',
    'Code barre': 'barcode',
    'Date inventaire': 'inventorydate'
  };
  const positionAliases = {
    articlecode: ['articlecode', 'name'],
    storename: ['storename', 'storecode', 'magasin'],
    divisionname: ['divisionname', 'divisioncode', 'division'],
    address: ['address', 'emplacement', 'location']
  };
  const pageSize = 500;
  const writeGroupSize = 400;
  const errorsPerPage = 100;
  const historyPageSize = 20;

  function element(id) {
    return document.getElementById(id);
  }

  function setStatus(target, message, isError, isSuccess) {
    target.textContent = message;
    target.classList.remove('hidden', 'error', 'success');
    if (isError) target.classList.add('error');
    if (isSuccess) target.classList.add('success');
  }

  function clearStatus(target) {
    target.textContent = '';
    target.classList.add('hidden');
    target.classList.remove('error', 'success');
  }

  function textValue(cell) {
    return cell && cell.v !== undefined && cell.v !== null ? cell.v : null;
  }

  function isBlank(value) {
    return value === undefined || value === null || value === '';
  }

  function normalizedText(cell, label, errors, required) {
    const value = textValue(cell);
    if (isBlank(value)) {
      if (required) errors.push('« ' + label + ' » est obligatoire.');
      return '';
    }
    if (!cell || cell.t !== 's' || typeof value !== 'string') {
      errors.push('« ' + label + ' » doit être une cellule texte.');
      return '';
    }
    const normalized = value.trim();
    if (required && !normalized) errors.push('« ' + label + ' » est obligatoire.');
    return normalized;
  }

  function optionalText(cell, label, errors, trimValue) {
    const value = textValue(cell);
    if (isBlank(value)) return '';
    if (!cell || cell.t !== 's' || typeof value !== 'string') {
      errors.push('« ' + label + ' » doit être une cellule texte.');
      return '';
    }
    return trimValue ? value.trim() : value;
  }

  function validCalendarDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  function dateValue(cell, errors) {
    const value = textValue(cell);
    if (isBlank(value)) return '';
    if (cell && cell.t === 'd' && value instanceof Date && Number.isFinite(value.getTime())) {
      const year = value.getUTCFullYear();
      const month = value.getUTCMonth() + 1;
      const day = value.getUTCDate();
      if (validCalendarDate(year, month, day)) {
        return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      }
    }
    if (cell && cell.t === 's' && typeof value === 'string') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (match && validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) return value;
    }
    errors.push('« Date inventaire » doit être une date Excel ou un texte AAAA-MM-JJ valide.');
    return '';
  }

  function quantityValue(cell, errors) {
    const value = textValue(cell);
    if (!cell || cell.t !== 'n' || typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push('« Quantité initiale » doit être une cellule numérique.');
      return null;
    }
    if (value < 0) {
      errors.push('« Quantité initiale » ne peut pas être négative.');
      return null;
    }
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
      errors.push('« Quantité initiale » ne peut pas contenir plus de deux décimales.');
      return null;
    }
    return value;
  }

  function positionKey(values) {
    return JSON.stringify([
      values.articlecode,
      values.storename,
      values.divisionname,
      values.address
    ]);
  }

  function rowHasFormula(sheet, row, startColumn, endColumn, XLSX) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.f) return true;
    }
    return false;
  }

  function rowHasContent(sheet, row, startColumn, endColumn, XLSX) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && (!isBlank(cell.v) || cell.f)) return true;
    }
    return false;
  }

  function analyzeWorkbook(workbook, XLSX) {
    const errors = [];
    const warnings = [];
    const matchingSheets = [];
    const ignoredSheets = [];

    workbook.SheetNames.forEach((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet || !sheet['!ref']) {
        ignoredSheets.push(name);
        return;
      }
      const range = XLSX.utils.decode_range(sheet['!ref']);
      const headerRow = range.s.r;
      const headerValues = [];
      const headerColumns = {};
      let hasAllRequired = true;

      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c: column })];
        const value = textValue(cell);
        const label = typeof value === 'string' ? value.trim() : '';
        headerValues.push({ column, label });
        if (requiredHeaders.includes(label)) headerColumns[label] = column;
      }
      if (requiredHeaders.some(label => headerColumns[label] === undefined)) hasAllRequired = false;
      if (hasAllRequired) matchingSheets.push({ name, sheet, range, headerRow, headerValues, headerColumns });
      else ignoredSheets.push(name);
    });

    if (matchingSheets.length > 1) {
      throw new Error('Le classeur est ambigu : plusieurs feuilles contiennent les en-têtes obligatoires.');
    }
    if (matchingSheets.length === 0) {
      throw new Error('Aucune feuille ne contient toutes les en-têtes obligatoires attendues.');
    }

    const selected = matchingSheets[0];
    const seenHeaders = new Set();
    for (const header of selected.headerValues) {
      if (!header.label) continue;
      if (Object.prototype.hasOwnProperty.call(aliases, header.label)) {
        if (seenHeaders.has(header.label)) {
          throw new Error('L’en-tête « ' + header.label + ' » apparaît plusieurs fois dans la feuille « ' + selected.name + ' ».');
        }
        seenHeaders.add(header.label);
        selected.headerColumns[header.label] = header.column;
      } else {
        warnings.push('Colonne inconnue ignorée : « ' + header.label + ' ».');
      }
    }
    for (const required of requiredHeaders) {
      if (!seenHeaders.has(required)) {
        throw new Error('L’en-tête obligatoire « ' + required + ' » est absente ou répétée.');
      }
    }
    if (ignoredSheets.length) {
      warnings.push('Feuilles ignorées sans toutes les en-têtes obligatoires : ' + ignoredSheets.join(', ') + '.');
    }

    const rows = [];
    const duplicateGroups = new Map();
    let rowsRead = 0;
    for (let rowNumber = selected.headerRow + 1; rowNumber <= selected.range.e.r; rowNumber += 1) {
      if (!rowHasContent(selected.sheet, rowNumber, selected.range.s.c, selected.range.e.c, XLSX)) continue;
      rowsRead += 1;
      const line = rowNumber + 1;
      const rowErrors = [];
      const formulaPresent = rowHasFormula(selected.sheet, rowNumber, selected.range.s.c, selected.range.e.c, XLSX);
      const values = {};
      let key = '';

      for (const label of requiredHeaders) {
        if (label === 'Quantité initiale') continue;
        const cell = selected.sheet[XLSX.utils.encode_cell({
          r: rowNumber,
          c: selected.headerColumns[label]
        })];
        values[aliases[label]] = normalizedText(cell, label, rowErrors, true);
      }
      if (values.articlecode && values.storename && values.divisionname && values.address) {
        key = positionKey(values);
      }

      const designationColumn = selected.headerColumns['Désignation'];
      if (designationColumn !== undefined) {
        const cell = selected.sheet[XLSX.utils.encode_cell({ r: rowNumber, c: designationColumn })];
        values.designation = optionalText(cell, 'Désignation', rowErrors, false);
      }

      const barcodeColumn = selected.headerColumns['Code barre'];
      if (barcodeColumn !== undefined) {
        const cell = selected.sheet[XLSX.utils.encode_cell({ r: rowNumber, c: barcodeColumn })];
        values.barcode = optionalText(cell, 'Code barre', rowErrors, true).replace(/\*/g, '').trim();
      }

      const dateColumn = selected.headerColumns['Date inventaire'];
      if (dateColumn !== undefined) {
        const cell = selected.sheet[XLSX.utils.encode_cell({ r: rowNumber, c: dateColumn })];
        values.inventorydate = dateValue(cell, rowErrors);
      }

      const quantityColumn = selected.headerColumns['Quantité initiale'];
      values.quantity = quantityValue(
        selected.sheet[XLSX.utils.encode_cell({ r: rowNumber, c: quantityColumn })],
        rowErrors
      );

      if (formulaPresent) rowErrors.push('Les cellules de formule ne sont pas acceptées.');
      const result = { line, key, values, errors: rowErrors, disposition: 'new' };
      rows.push(result);
      if (key) {
        if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
        duplicateGroups.get(key).push(result);
      }
    }

    const duplicateKeys = new Set();
    duplicateGroups.forEach((group, key) => {
      if (group.length > 1) {
        duplicateKeys.add(key);
        group.forEach(row => row.errors.push('Cette clé de position apparaît plusieurs fois dans le fichier.'));
      }
    });

    rows.forEach((row) => {
      row.rejected = row.errors.length > 0 || duplicateKeys.has(row.key);
      row.errors.forEach(message => errors.push({ line: row.line, message }));
    });

    return {
      rows,
      rowsRead,
      errors,
      warnings,
      sheetName: selected.name,
      rejectedCount: new Set(errors.map(error => error.line)).size
    };
  }

  function firstExistingValue(data, names) {
    for (const name of names) {
      const value = data[name];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  }

  function existingPositionKey(data) {
    const values = {};
    for (const field of Object.keys(positionAliases)) {
      values[field] = firstExistingValue(data, positionAliases[field]);
      if (!values[field]) return '';
    }
    return positionKey(values);
  }

  function importErrorMessage(error) {
    const code = error && error.code ? error.code : '';
    if (code === 'permission-denied' || code === 'unauthenticated') {
      return 'Firestore a refusé une lecture ou une écriture. Vérifiez les règles publiées et le droit du responsable.';
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      return 'Firestore est temporairement inaccessible. Vérifiez la connexion puis renvoyez le fichier, les positions déjà créées seront ignorées.';
    }
    if (code === 'aborted') {
      return 'Une création concurrente n’a pas pu être résolue après trois tentatives. Les groupes déjà enregistrés restent disponibles.';
    }
    if (error instanceof RangeError || /memory|allocation/i.test(error && error.message ? error.message : '')) {
      return 'Le navigateur n’a plus assez de mémoire pour traiter ce classeur. Fermez les autres onglets ou utilisez un classeur plus petit.';
    }
    return 'L’opération a échoué. Les groupes déjà enregistrés sont conservés. Détail : ' +
      (code || (error && error.message) || 'erreur inconnue');
  }

  function ensureSession(auth, user, generation, currentGeneration) {
    if (
      currentGeneration() !== generation ||
      !user ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      const error = new Error('La session a changé pendant l’import.');
      error.code = 'stock-import/session-changed';
      throw error;
    }
  }

  function dateForExpiry() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  async function deterministicId(key) {
    if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      throw new Error('Le navigateur ne permet pas de calculer les identifiants sécurisés. Ouvrez l’application sur HTTPS ou localhost.');
    }
    const bytes = new TextEncoder().encode(key);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
  }

  function positionDocument(row, batchId) {
    const data = {
      articlecode: row.values.articlecode,
      storename: row.values.storename,
      divisionname: row.values.divisionname,
      address: row.values.address,
      importBatchId: batchId,
      initialqy: row.values.quantity,
      currentqy: row.values.quantity,
      quantity: row.values.quantity
    };
    if (row.values.designation && row.values.designation.trim()) data.designation = row.values.designation;
    if (row.values.barcode) data.barcodes = [row.values.barcode];
    if (row.values.inventorydate) {
      data.inventorydate = row.values.inventorydate;
      data.dateinventaire = row.values.inventorydate;
    }
    return data;
  }

  function renderCounters(preview) {
    const target = element('stockImportCounters');
    target.replaceChildren();
    const counters = [
      ['Lignes lues', preview.rowsRead],
      ['Nouvelles positions', preview.candidates.length],
      ['Déjà présentes', preview.skippedCount],
      ['Rejetées', preview.rejectedCount]
    ];
    counters.forEach(([label, count]) => {
      const field = document.createElement('div');
      field.className = 'field';
      const strong = document.createElement('strong');
      strong.textContent = label;
      const value = document.createElement('span');
      value.textContent = String(count);
      field.append(strong, value);
      target.appendChild(field);
    });
  }

  function renderPreviewTable(preview) {
    const target = element('stockImportPreviewTable');
    target.replaceChildren();
    const table = document.createElement('table');
    table.className = 'stock-import-table';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Ligne', 'Code article', 'Magasin', 'Division', 'Emplacement', 'Quantité', 'Résultat'].forEach((label) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      headerRow.appendChild(cell);
    });
    head.appendChild(headerRow);
    table.appendChild(head);
    const body = document.createElement('tbody');
    preview.validRows.filter(row => !row.rejected).slice(0, 20).forEach((row) => {
      const tr = document.createElement('tr');
      const result = row.disposition === 'skip' ? 'Déjà présente' : row.disposition === 'ambiguous' ? 'Position ambiguë' : 'À ajouter';
      [
        row.line,
        row.values.articlecode,
        row.values.storename,
        row.values.divisionname,
        row.values.address,
        row.values.quantity,
        result
      ].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    target.appendChild(table);
    if (preview.validRows.every(row => row.rejected)) {
      const message = document.createElement('p');
      message.className = 'small';
      message.textContent = 'Aucune ligne valide à afficher.';
      target.appendChild(message);
    }
  }

  function renderErrorPage(preview) {
    const section = element('stockImportErrorSection');
    const pageCount = Math.max(1, Math.ceil(preview.errors.length / errorsPerPage));
    const page = Math.min(preview.errorPage, pageCount - 1);
    preview.errorPage = page;
    section.classList.toggle('hidden', preview.errors.length === 0);
    const list = element('stockImportErrors');
    list.replaceChildren();
    preview.errors.slice(page * errorsPerPage, (page + 1) * errorsPerPage).forEach((error) => {
      const item = document.createElement('li');
      item.textContent = 'Ligne ' + error.line + ' : ' + error.message;
      list.appendChild(item);
    });
    element('stockImportErrorPage').textContent = 'Page ' + (page + 1) + ' sur ' + pageCount;
    element('stockImportErrorPrevious').disabled = page === 0;
    element('stockImportErrorNext').disabled = page >= pageCount - 1;
  }

  function renderPreview(preview) {
    element('stockImportPreview').classList.remove('hidden');
    renderCounters(preview);
    renderPreviewTable(preview);
    renderErrorPage(preview);
    element('stockImportWarnings').textContent = preview.warnings.join(' ');
    element('stockImportWarnings').classList.toggle('hidden', preview.warnings.length === 0);
    element('stockImportConfirmBtn').disabled = preview.candidates.length === 0 || preview.importing;
  }

  function setHistoryMessage(message, isError, isSuccess) {
    setStatus(element('stockImportHistoryStatus'), message, isError, isSuccess);
  }

  function initializeStockImport(options) {
    const auth = options.auth;
    const db = options.db;
    const panel = element('stockImportPanel');
    const content = element('stockImportContent');
    const mobileNotice = element('stockImportMobileNotice');
    const accessStatus = element('stockImportAccessStatus');
    const fileInput = element('stockImportFile');
    const importStatus = element('stockImportStatus');
    const historyList = element('stockImportHistory');
    let generation = 0;
    let activePreview = null;
    let activeRunRef = null;
    let cancelRequested = false;
    let historyPage = 0;
    let historyCursors = [null];
    let historyHasNext = false;
    let historyLoading = false;
    let activeUser = null;
    let managerUnsubscribe = null;

    function currentGeneration() {
      return generation;
    }

    function isMobile() {
      return window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    }

    function updateDeviceView() {
      const mobile = isMobile();
      content.classList.toggle('hidden', mobile);
      mobileNotice.classList.toggle('hidden', !mobile);
    }

    function resetImportView() {
      activePreview = null;
      activeRunRef = null;
      cancelRequested = false;
      fileInput.value = '';
      element('stockImportPreview').classList.add('hidden');
      element('stockImportConfirmBtn').disabled = true;
      element('stockImportCancelBtn').classList.add('hidden');
      clearStatus(importStatus);
    }

    function revokeImportAccess() {
      generation += 1;
      panel.classList.add('hidden');
      activeUser = null;
      resetImportView();
      setStatus(accessStatus, 'Le droit d’import a été retiré ou ne peut plus être vérifié. Les fonctions de recherche restent disponibles.', true);
    }

    async function verifyManager(user, expectedGeneration) {
      const manager = await db.collection('stockImportManagers').doc(user.uid).get({ source: 'server' });
      ensureSession(auth, user, expectedGeneration, currentGeneration);
      return manager.exists;
    }

    function watchManagerAccess(user, expectedGeneration) {
      managerUnsubscribe = db.collection('stockImportManagers').doc(user.uid).onSnapshot((manager) => {
        if (expectedGeneration !== generation) return;
        if (!manager.exists) {
          revokeImportAccess();
          return;
        }
        activeUser = user;
        clearStatus(accessStatus);
        panel.classList.remove('hidden');
        updateDeviceView();
      }, (error) => {
        if (expectedGeneration !== generation) return;
        console.error('Échec du suivi du droit d’import :', error);
        revokeImportAccess();
        setStatus(accessStatus,
          'Le droit d’import ne peut plus être vérifié. Réessayez lorsque la connexion sera rétablie.',
          true
        );
      });
    }

    async function loadHistory(reset) {
      if (!activeUser || historyLoading) return;
      const user = activeUser;
      const requestGeneration = generation;
      historyLoading = true;
      element('stockImportHistoryBtn').disabled = true;
      setHistoryMessage('Lecture de l’historique…');
      try {
        if (!(await verifyManager(user, requestGeneration))) {
          revokeImportAccess();
          return;
        }
        if (reset) {
          historyPage = 0;
          historyCursors = [null];
        }
        let query = db.collection('stockImportRuns')
          .orderBy('createdAt', 'desc')
          .limit(historyPageSize);
        const cursor = historyCursors[historyPage];
        if (cursor) query = query.startAfter(cursor);
        const snapshot = await query.get({ source: 'server' });
        ensureSession(auth, user, requestGeneration, currentGeneration);
        historyList.replaceChildren();
        snapshot.forEach((runDocument) => {
          const data = runDocument.data();
          const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate()
            : null;
          let status = data.status;
          if (status === 'in_progress' && createdAt && Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000) {
            status = 'partial';
          }
          const item = document.createElement('li');
          const date = createdAt ? createdAt.toLocaleString('fr-FR') : 'Date indisponible';
          item.textContent = date + ' · ' + status +
            ' · ' + (data.createdCount || 0) + ' créée(s)' +
            ' · ' + (data.skippedCount || 0) + ' ignorée(s)' +
            ' · ' + (data.rejectedCount || 0) + ' rejetée(s)';
          historyList.appendChild(item);
        });
        historyHasNext = snapshot.size === historyPageSize;
        if (historyHasNext && !historyCursors[historyPage + 1]) {
          historyCursors[historyPage + 1] = snapshot.docs[snapshot.docs.length - 1];
        }
        element('stockImportHistoryPrevious').classList.toggle('hidden', historyPage === 0);
        element('stockImportHistoryNext').classList.toggle('hidden', !historyHasNext);
        if (snapshot.empty) {
          setHistoryMessage(historyPage === 0 ? 'Aucun import enregistré.' : 'Aucun autre résumé à afficher.', false, true);
        } else {
          setHistoryMessage('Page ' + (historyPage + 1) + ' chargée.', false, true);
        }
      } catch (error) {
        console.error('Échec de lecture de l’historique des imports :', error);
        setHistoryMessage(importErrorMessage(error), true);
      } finally {
        historyLoading = false;
        element('stockImportHistoryBtn').disabled = false;
      }
    }

    async function analyzeSelectedFile(file) {
      const user = activeUser;
      const requestGeneration = generation;
      resetImportView();
      if (!file) return;
      if (!/\.xlsx$/i.test(file.name)) {
        setStatus(importStatus, 'Sélectionnez un fichier Excel au format .xlsx.', true);
        return;
      }
      if (!window.XLSX) {
        setStatus(importStatus, 'La bibliothèque Excel ne s’est pas chargée. Vérifiez la connexion puis réessayez.', true);
        return;
      }
      setStatus(importStatus, 'Lecture et vérification du classeur dans le navigateur…');
      try {
        ensureSession(auth, user, requestGeneration, currentGeneration);
        const buffer = await file.arrayBuffer();
        ensureSession(auth, user, requestGeneration, currentGeneration);
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellFormula: true });
        const analysis = analyzeWorkbook(workbook, XLSX);
        const validRows = analysis.rows.filter(row => !row.rejected);
        const allPositions = new Map();
        let lastDocument = null;
        let readCount = 0;
        while (true) {
          ensureSession(auth, user, requestGeneration, currentGeneration);
          let query = db.collection('stockPositions')
            .orderBy(firebase.firestore.FieldPath.documentId())
            .limit(pageSize);
          if (lastDocument) query = query.startAfter(lastDocument);
          const snapshot = await query.get({ source: 'server' });
          ensureSession(auth, user, requestGeneration, currentGeneration);
          snapshot.forEach((document) => {
            readCount += 1;
            const key = existingPositionKey(document.data());
            if (!key) return;
            if (!allPositions.has(key)) allPositions.set(key, []);
            allPositions.get(key).push(document.id);
          });
          setStatus(importStatus, 'Vérification des positions existantes : ' + readCount + ' lue(s)…');
          if (snapshot.size < pageSize) break;
          lastDocument = snapshot.docs[snapshot.docs.length - 1];
        }
        let skippedCount = 0;
        validRows.forEach((row) => {
          const matches = allPositions.get(row.key) || [];
          if (matches.length > 1) {
            row.disposition = 'ambiguous';
            row.rejected = true;
            row.errors.push('Plusieurs positions existantes correspondent à cette clé.');
            analysis.errors.push({ line: row.line, message: row.errors[row.errors.length - 1] });
          } else if (matches.length === 1) {
            row.disposition = 'skip';
            skippedCount += 1;
          }
        });
        const candidates = validRows.filter(row => !row.rejected && row.disposition === 'new');
        analysis.rejectedCount = new Set(analysis.errors.map(error => error.line)).size;
        activePreview = {
          rowsRead: analysis.rowsRead,
          validRows,
          candidates,
          skippedCount,
          rejectedCount: analysis.rejectedCount,
          errors: analysis.errors,
          warnings: analysis.warnings,
          errorPage: 0,
          importing: false,
          createdCount: 0
        };
        renderPreview(activePreview);
        setStatus(importStatus,
          'Vérification terminée : ' + candidates.length + ' position(s) à ajouter, ' +
          skippedCount + ' déjà présente(s), ' + activePreview.rejectedCount + ' rejetée(s).',
          false,
          true
        );
      } catch (error) {
        console.error('Échec de la vérification du classeur :', error);
        setStatus(importStatus, importErrorMessage(error), true);
      }
    }

    async function hashCandidateRows(rows, user, requestGeneration) {
      for (const row of rows) {
        ensureSession(auth, user, requestGeneration, currentGeneration);
        row.documentId = await deterministicId(row.key);
      }
    }

    async function createTransaction(group, counters, user, requestGeneration, runRef) {
      let remaining = group.slice();
      let collidedCount = 0;
      let attempts = 0;
      while (attempts < 3) {
        ensureSession(auth, user, requestGeneration, currentGeneration);
        attempts += 1;
        try {
          const outcome = await db.runTransaction(async (transaction) => {
            const references = remaining.map(row => db.collection('stockPositions').doc(row.documentId));
            const reads = references.map(reference => transaction.get(reference));
            reads.push(transaction.get(runRef));
            const snapshots = await Promise.all(reads);
            ensureSession(auth, user, requestGeneration, currentGeneration);
            const runSnapshot = snapshots[snapshots.length - 1];
            const existing = snapshots.slice(0, -1);
            const newRows = remaining.filter((row, index) => !existing[index].exists);
            const skippedThisTransaction = remaining.length - newRows.length;
            if (!runSnapshot.exists && newRows.length === 0) {
              return { created: 0, skipped: skippedThisTransaction, summaryExists: false };
            }

            if (runSnapshot.exists && runSnapshot.data().status !== 'in_progress') {
              const error = new Error('Le résumé de cet import n’est plus en cours.');
              error.code = 'failed-precondition';
              throw error;
            }

            newRows.forEach((row) => {
              const reference = db.collection('stockPositions').doc(row.documentId);
              transaction.set(reference, positionDocument(row, runRef.id));
            });

            const createdCount = counters.createdCount + newRows.length;
            const skippedCount = counters.skippedCount + counters.racedSkippedCount + collidedCount + skippedThisTransaction;
            const summary = {
              status: 'in_progress',
              rowsRead: counters.rowsRead,
              createdCount,
              skippedCount,
              rejectedCount: counters.rejectedCount
            };
            if (!runSnapshot.exists) {
              summary.createdAt = firebase.firestore.FieldValue.serverTimestamp();
              summary.expiresAt = firebase.firestore.Timestamp.fromDate(dateForExpiry());
              transaction.set(runRef, summary);
            } else {
              transaction.update(runRef, summary);
            }
            return {
              created: newRows.length,
              skipped: skippedThisTransaction,
              summaryExists: true
            };
          }, { maxAttempts: 1 });
          outcome.skipped += collidedCount;
          return outcome;
        } catch (error) {
          if (error.code !== 'aborted') throw error;
          ensureSession(auth, user, requestGeneration, currentGeneration);
          const references = remaining.map(row => db.collection('stockPositions').doc(row.documentId));
          const snapshots = await Promise.all(references.map(reference => reference.get({ source: 'server' })));
          ensureSession(auth, user, requestGeneration, currentGeneration);
          const stillNew = [];
          snapshots.forEach((snapshot, index) => {
            if (snapshot.exists) collidedCount += 1;
            else stillNew.push(remaining[index]);
          });
          remaining = stillNew;
          if (remaining.length === 0) {
            if (counters.runCreated) {
              await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(runRef);
                ensureSession(auth, user, requestGeneration, currentGeneration);
                if (snapshot.exists && snapshot.data().status === 'in_progress') {
                  transaction.update(runRef, {
                    rowsRead: counters.rowsRead,
                    createdCount: counters.createdCount,
                    skippedCount: counters.skippedCount + counters.racedSkippedCount + collidedCount,
                    rejectedCount: counters.rejectedCount
                  });
                }
              }, { maxAttempts: 1 });
            }
            return { created: 0, skipped: collidedCount, summaryExists: Boolean(activeRunRef && counters.runCreated) };
          }
        }
      }
      const exhausted = new Error('Conflit de création après trois tentatives.');
      exhausted.code = 'aborted';
      throw exhausted;
    }

    async function setRunStatus(runRef, user, requestGeneration, status) {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(runRef);
        ensureSession(auth, user, requestGeneration, currentGeneration);
        if (snapshot.exists && snapshot.data().status === 'in_progress') {
          transaction.update(runRef, { status });
        }
      }, { maxAttempts: 1 });
    }

    async function confirmImport() {
      const preview = activePreview;
      const user = activeUser;
      const requestGeneration = generation;
      if (!preview || !user || preview.candidates.length === 0 || preview.importing) return;
      preview.importing = true;
      cancelRequested = false;
      element('stockImportConfirmBtn').disabled = true;
      element('stockImportCancelBtn').classList.remove('hidden');
      setStatus(importStatus, 'Préparation des identifiants de position…');
      const runRef = db.collection('stockImportRuns').doc();
      activeRunRef = runRef;
      const counters = {
        rowsRead: preview.rowsRead,
        createdCount: 0,
        skippedCount: preview.skippedCount,
        rejectedCount: preview.rejectedCount,
        racedSkippedCount: 0,
        runCreated: false
      };
      try {
        if (!(await verifyManager(user, requestGeneration))) {
          revokeImportAccess();
          return;
        }
        await hashCandidateRows(preview.candidates, user, requestGeneration);
        const groups = [];
        for (let start = 0; start < preview.candidates.length; start += writeGroupSize) {
          groups.push(preview.candidates.slice(start, start + writeGroupSize));
        }
        for (let index = 0; index < groups.length; index += 1) {
          if (cancelRequested) break;
          ensureSession(auth, user, requestGeneration, currentGeneration);
          if (!(await verifyManager(user, requestGeneration))) {
            revokeImportAccess();
            return;
          }
          const outcome = await createTransaction(
            groups[index],
            counters,
            user,
            requestGeneration,
            runRef
          );
          counters.createdCount += outcome.created;
          counters.racedSkippedCount += outcome.skipped;
          counters.runCreated = counters.runCreated || outcome.summaryExists;
          preview.createdCount = counters.createdCount;
          preview.skippedCount += outcome.skipped;
          renderCounters(preview);
          setStatus(importStatus,
            'Import en cours : ' + counters.createdCount + ' créée(s), ' +
            preview.skippedCount + ' ignorée(s), ' + counters.rejectedCount + ' rejetée(s)…'
          );
        }

        if (cancelRequested) {
          if (counters.runCreated) await setRunStatus(runRef, user, requestGeneration, 'partial');
          setStatus(importStatus,
            'Import arrêté après le groupe en cours. ' + counters.createdCount +
            ' position(s) enregistrée(s), ' + preview.skippedCount + ' ignorée(s). Vous pouvez renvoyer le fichier.',
            false,
            true
          );
          if (counters.runCreated) await loadHistory(true);
        } else if (counters.runCreated) {
          await setRunStatus(runRef, user, requestGeneration, 'completed');
          setStatus(importStatus,
            'Import terminé : ' + counters.createdCount + ' position(s) créée(s), ' +
            preview.skippedCount + ' ignorée(s), ' + counters.rejectedCount + ' rejetée(s).',
            false,
            true
          );
          await loadHistory(true);
        } else {
          setStatus(importStatus,
            'Aucune nouvelle position n’a été créée. Les positions ajoutées en parallèle ont été ignorées.',
            false,
            true
          );
        }
        preview.candidates = [];
        renderPreview(preview);
      } catch (error) {
        console.error('Échec de l’import du stock :', error);
        if (counters.runCreated && auth.currentUser && auth.currentUser.uid === user.uid) {
          try {
            await setRunStatus(runRef, user, requestGeneration, 'partial');
            await loadHistory(true);
          } catch (statusError) {
            console.error('Impossible de marquer le lot comme partiel :', statusError);
          }
        }
        if (error.code === 'stock-import/session-changed') {
          setStatus(importStatus, 'Import interrompu, car la session a changé. Les groupes déjà enregistrés sont conservés.', true);
        } else {
          setStatus(importStatus,
            importErrorMessage(error) + (counters.createdCount > 0
              ? ' ' + counters.createdCount + ' position(s) restent enregistrées.'
              : ' Aucune position n’a été confirmée comme enregistrée.'),
            true
          );
        }
      } finally {
        preview.importing = false;
        element('stockImportCancelBtn').classList.add('hidden');
        element('stockImportConfirmBtn').disabled = preview.candidates.length === 0;
        activeRunRef = null;
      }
    }

    function stopImport() {
      if (!activePreview || !activePreview.importing) return;
      cancelRequested = true;
      element('stockImportCancelBtn').disabled = true;
      setStatus(importStatus, 'Arrêt demandé. Le groupe en cours va se terminer avant l’arrêt.');
    }

    element('stockImportTemplateBtn').addEventListener('click', () => {
      if (!window.XLSX) {
        setStatus(importStatus, 'La bibliothèque Excel ne s’est pas chargée. Vérifiez la connexion puis réessayez.', true);
        return;
      }
      try {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers]), 'Stock');
        XLSX.writeFile(workbook, 'Modele_Stock_Initial.xlsx');
        setStatus(importStatus, 'Le modèle Excel a été téléchargé.', false, true);
      } catch (error) {
        console.error('Échec de création du modèle Excel :', error);
        setStatus(importStatus, 'Impossible de créer le modèle Excel. Détail : ' + (error.message || 'erreur inconnue'), true);
      }
    });
    fileInput.addEventListener('change', event => analyzeSelectedFile(event.target.files[0]));
    element('stockImportConfirmBtn').addEventListener('click', confirmImport);
    element('stockImportCancelBtn').addEventListener('click', stopImport);
    element('stockImportErrorPrevious').addEventListener('click', () => {
      if (!activePreview) return;
      activePreview.errorPage -= 1;
      renderErrorPage(activePreview);
    });
    element('stockImportErrorNext').addEventListener('click', () => {
      if (!activePreview) return;
      activePreview.errorPage += 1;
      renderErrorPage(activePreview);
    });
    element('stockImportHistoryBtn').addEventListener('click', () => loadHistory(true));
    element('stockImportHistoryPrevious').addEventListener('click', () => {
      if (historyPage === 0 || historyLoading) return;
      historyPage -= 1;
      loadHistory(false);
    });
    element('stockImportHistoryNext').addEventListener('click', () => {
      if (!historyHasNext || historyLoading) return;
      historyPage += 1;
      loadHistory(false);
    });

    if (window.matchMedia) {
      const media = window.matchMedia('(max-width: 600px)');
      if (media.addEventListener) media.addEventListener('change', updateDeviceView);
      else if (media.addListener) media.addListener(updateDeviceView);
    }
    updateDeviceView();

    auth.onAuthStateChanged(async (user) => {
      generation += 1;
      const thisGeneration = generation;
      if (managerUnsubscribe) {
        managerUnsubscribe();
        managerUnsubscribe = null;
      }
      activeUser = user;
      clearStatus(accessStatus);
      panel.classList.add('hidden');
      historyList.replaceChildren();
      resetImportView();
      if (!user) {
        activeUser = null;
        clearStatus(accessStatus);
        return;
      }
      try {
        const authorized = await verifyManager(user, thisGeneration);
        if (thisGeneration !== generation) return;
        if (!authorized) {
          activeUser = null;
          setStatus(accessStatus,
            'Ce compte ne figure pas dans la liste des responsables autorisés à importer.',
            true
          );
          return;
        }
        clearStatus(accessStatus);
        watchManagerAccess(user, thisGeneration);
      } catch (error) {
        if (thisGeneration !== generation) return;
        console.error('Impossible de vérifier le droit d’import :', error);
        setStatus(accessStatus,
          'Les droits de l’import ne peuvent pas être vérifiés. Vérifiez que les règles Firestore publiées autorisent la lecture du document du responsable.',
          true
        );
        activeUser = null;
      }
    }, (error) => {
      panel.classList.add('hidden');
      activeUser = null;
      console.error('Échec du suivi de session pour l’import :', error);
      setStatus(accessStatus, 'La session ne peut pas être vérifiée pour l’import. Reconnectez vous et vérifiez les règles Firebase.', true);
    });
  }

  window.initializeStockImport = initializeStockImport;
})();
