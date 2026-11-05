(function () {
  const movementPageSize = 20;
  const positionPageSize = 500;
  const historyReadPageSize = 200;
  const movementTypes = ['entry', 'exit', 'transfer'];

  function element(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
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

  function normalize(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  function normalizeSearch(value) {
    return normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  }

  function identityValue(data, field) {
    return typeof data[field] === 'string' ? data[field].trim() : '';
  }

  function positionIdentity(data) {
      const snapshot = {};
      const fields = ['articlecode', 'storename', 'divisionname', 'address', 'designation', 'barcodes'];
      fields.forEach((field) => {
        const value = data[field];
        if (value === undefined || value === null) return;
        if (typeof value === 'string' || Array.isArray(value)) {
          snapshot[field] = value;
        }
      });
      return snapshot;
    }

  function hasValidIdentity(snapshot) {
    const required = ['articlecode', 'storename', 'divisionname', 'address'];
    return required.every((field) => {
      const value = snapshot[field];
      return typeof value === 'string' && value.trim().length > 0;
    });
  }

  function validBalance(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function balanceNumber(value) {
    if (typeof value === 'number') return validBalance(value) ? value : null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const significantDigits = normalized.replace('.', '').replace(/^0+/, '').length || 1;
    if (significantDigits > 15) return null;
    const balance = Number(normalized);
    return validBalance(balance) ? balance : null;
  }

  function displayBalance(value) {
    const balance = balanceNumber(value);
    return balance === null ? value : balance;
  }

  function quantityValue(rawValue) {
    const value = String(rawValue === undefined || rawValue === null ? '' : rawValue).trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
    const quantity = Number(value);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
  }

  function customError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function positionDescription(position) {
    const identity = positionIdentity(position.data);
    return [
      identity.articlecode,
      identity.designation,
      identity.storename,
      identity.divisionname,
      identity.address
    ].filter(Boolean).join(' · ');
  }

  function fieldHtml(label, value) {
    const displayValue = value === undefined || value === null || value === '' ? 'Non renseigné' : value;
    return '<div class="field"><strong>' + escapeHtml(label) + '</strong>' + escapeHtml(displayValue) + '</div>';
  }

  function dateStart(value) {
    if (!value) return null;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(date.getTime()) ||
      date.getFullYear() !== parts[0] ||
      date.getMonth() !== parts[1] - 1 ||
      date.getDate() !== parts[2]
      ? null
      : date;
  }

  function timestampDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function movementLabel(type, originalType) {
    const labels = {
      entry: 'Entrée',
      exit: 'Sortie',
      transfer: 'Transfert',
      reversal: 'Correction'
    };
    if (type === 'reversal' && originalType) {
      const reversedLabels = {
        entry: 'une entrée',
        exit: 'une sortie',
        transfer: 'un transfert'
      };
      return 'Correction d’' + (reversedLabels[originalType] || 'un mouvement');
    }
    return labels[type] || 'Mouvement';
  }

  function initializeStockMovements(options) {
    const auth = options.auth;
    const db = options.db;
    const adminTab = element('stockMovementsTab');
    const searchTab = element('stockSearchTab');
    const searchPanel = element('stockSearchPanel');
    const movementsPanel = element('stockMovementsPanel');
    const accessStatus = element('stockMovementAccessStatus');
    const operationTab = element('stockMovementNewTab');
    const historyTab = element('stockMovementHistoryTab');
    const operationPanel = element('stockMovementNewPanel');
    const historyPanel = element('stockMovementHistoryPanel');
    const operationStatus = element('stockMovementStatus');
    const positionSearchStatus = element('stockMovementPositionStatus');
    const positionResults = element('stockMovementPositionResults');
    const selectedFrom = element('stockMovementFromSelection');
    const selectedTo = element('stockMovementToSelection');
    const previewPanel = element('stockMovementPreview');
    const previewContent = element('stockMovementPreviewContent');
    const confirmButton = element('stockMovementConfirmBtn');
    const historyStatus = element('stockMovementHistoryStatus');
    const historyBody = element('stockMovementHistoryRows');
    const historyPrevious = element('stockMovementHistoryPrevious');
    const historyNext = element('stockMovementHistoryNext');
    const historyPageLabel = element('stockMovementHistoryPage');
    const reversalDialog = element('stockMovementReversalDialog');
    const reversalPreview = element('stockMovementReversalPreview');
    const reversalStatus = element('stockMovementReversalStatus');
    const reversalConfirm = element('stockMovementReversalConfirm');
    const reversalCancel = element('stockMovementReversalCancel');
    const typeInput = element('stockMovementType');
    const quantityInput = element('stockMovementQuantity');
    const noteInput = element('stockMovementNote');
    const historyFilterForm = element('stockMovementHistoryFilters');

    let activeUser = null;
    let activeAdmin = false;
    let authGeneration = 0;
    let adminUnsubscribe = null;
    let selectedSource = null;
    let selectedDestination = null;
    let pendingPreview = null;
    let pendingReversal = null;
    let historyMode = 'server';
    let historyPageIndex = 0;
    let historyPageStarts = [null];
    let historyPageRecords = [];
    let historyHasNext = false;
    let filteredHistoryRecords = null;
    let filteredHistoryPage = 0;
    let historyFilterKey = '';
    let operationBusy = false;

    function showWorkspaceView(name, focusTab) {
      const showingMovements = name === 'movements' && activeAdmin;
      if (showingMovements && options.stopScanner) options.stopScanner();
      searchPanel.classList.toggle('hidden', showingMovements);
      movementsPanel.classList.toggle('hidden', !showingMovements);
      searchTab.setAttribute('aria-selected', String(!showingMovements));
      adminTab.setAttribute('aria-selected', String(showingMovements));
      if (focusTab) (showingMovements ? adminTab : searchTab).focus();
    }

    function showMovementSubView(name, focusTab) {
      const showingHistory = name === 'history';
      operationPanel.classList.toggle('hidden', showingHistory);
      historyPanel.classList.toggle('hidden', !showingHistory);
      operationTab.setAttribute('aria-selected', String(!showingHistory));
      historyTab.setAttribute('aria-selected', String(showingHistory));
      if (focusTab) (showingHistory ? historyTab : operationTab).focus();
      if (showingHistory) loadHistory();
    }

    function resetMovementState() {
      selectedSource = null;
      selectedDestination = null;
      pendingPreview = null;
      pendingReversal = null;
      positionResults.innerHTML = '';
      clearStatus(positionSearchStatus);
      clearStatus(operationStatus);
      previewPanel.classList.add('hidden');
      renderSelections();
      if (reversalDialog.open) reversalDialog.close();
    }

    function disableAdminView(message, isError) {
      activeAdmin = false;
      adminTab.classList.add('hidden');
      movementsPanel.classList.add('hidden');
      if (searchPanel.classList.contains('hidden')) showWorkspaceView('search', true);
      resetMovementState();
      if (message) setStatus(accessStatus, message, Boolean(isError));
      else clearStatus(accessStatus);
    }

    function watchAdminAccess(user, generation) {
      if (adminUnsubscribe) {
        adminUnsubscribe();
        adminUnsubscribe = null;
      }
      if (!user) {
        activeUser = null;
        disableAdminView();
        return;
      }
      activeUser = user;
      activeAdmin = false;
      adminTab.classList.add('hidden');
      setStatus(accessStatus, 'Vérification du rôle administrateur…');
      adminUnsubscribe = db.collection('authorizedUsers').doc(user.uid).onSnapshot((snapshot) => {
        if (generation !== authGeneration || !auth.currentUser || auth.currentUser.uid !== user.uid) return;
        if (snapshot.exists && snapshot.data().role === 'admin') {
          activeAdmin = true;
          adminTab.classList.remove('hidden');
          clearStatus(accessStatus);
        } else {
          disableAdminView('Votre compte n’a pas le rôle administrateur. L’onglet Mouvements est réservé aux admins.');
        }
      }, (error) => {
        if (generation !== authGeneration) return;
        console.error('Échec de la vérification du rôle admin :', error);
        disableAdminView('Le rôle administrateur ne peut pas être vérifié. Réessayez lorsque la connexion sera rétablie.', true);
      });
    }

    function currentType() {
      return typeInput.value;
    }

    function renderSelections() {
      selectedFrom.innerHTML = selectedSource          ? '<p><strong>Source sélectionnée</strong></p><p>' + escapeHtml(positionDescription(selectedSource)) + '</p><p class="small">Stock actuel : ' + escapeHtml(displayBalance(selectedSource.data.currentqy)) + '</p><button class="secondary stock-movement-clear-selection" type="button" data-clear="source">Retirer la source</button>'
        : '<p class="small">Aucune position source sélectionnée.</p>';
      selectedTo.innerHTML = selectedDestination          ? '<p><strong>Destination sélectionnée</strong></p><p>' + escapeHtml(positionDescription(selectedDestination)) + '</p><p class="small">Stock actuel : ' + escapeHtml(displayBalance(selectedDestination.data.currentqy)) + '</p><button class="secondary stock-movement-clear-selection" type="button" data-clear="destination">Retirer la destination</button>'
        : '<p class="small">Aucune position destination sélectionnée.</p>';
      selectedFrom.classList.toggle('hidden', currentType() === 'entry');
      selectedTo.classList.toggle('hidden', currentType() === 'exit');
      selectedFrom.querySelectorAll('[data-clear]').forEach((button) => {
        button.addEventListener('click', () => {
          selectedSource = null;
          invalidatePreview();
          renderSelections();
          element('stockMovementSearchInput').focus();
        });
      });
      selectedTo.querySelectorAll('[data-clear]').forEach((button) => {
        button.addEventListener('click', () => {
          selectedDestination = null;
          invalidatePreview();
          renderSelections();
          element('stockMovementSearchInput').focus();
        });
      });
    }

    function invalidatePreview() {
      pendingPreview = null;
      previewPanel.classList.add('hidden');
      confirmButton.disabled = true;
    }

    function positionIsSearchMatch(position, searchText) {
      const data = position.data;
      const code = normalize(data.articlecode);
      const barcodeValue = Array.isArray(data.barcodes) ? data.barcodes : [data.barcodes];
      const barcodeMatches = barcodeValue.some((barcode) => normalize(barcode) === searchText);
      const designationMatches = normalizeSearch(data.designation).includes(normalizeSearch(searchText));
      return code === searchText || barcodeMatches || designationMatches;
    }

    async function readMatchingPositions(searchText) {
      const collection = db.collection('stockPositions');
      const matches = [];
      let cursor = null;
      let scannedCount = 0;
      while (true) {
        let query = collection.orderBy(firebase.firestore.FieldPath.documentId()).limit(positionPageSize);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        page.docs.forEach((doc) => {
          const position = { id: doc.id, data: doc.data() };
          if (positionIsSearchMatch(position, searchText)) matches.push(position);
        });
        scannedCount += page.size;
        setStatus(positionSearchStatus, 'Recherche en cours : ' + scannedCount + ' position(s) parcourue(s)…');
        if (page.size < positionPageSize) break;
        cursor = page.docs[page.docs.length - 1];
      }
      return matches.sort((first, second) =>
        positionDescription(first).localeCompare(positionDescription(second), 'fr')
      );
    }

    function renderPositionResults(matches) {
      if (!matches.length) {
        positionResults.innerHTML = '<p class="stock-movement-empty">Aucune position trouvée. Vérifiez le code, le code barre ou la désignation.</p>';
        return;
      }
      positionResults.innerHTML = matches.map((position, index) => {
        const identity = positionIdentity(position.data);
        const canUse = hasValidIdentity(identity);
        const sameSource = selectedSource && selectedSource.id === position.id;
        const sourceMismatch = selectedSource && normalize(selectedSource.data.articlecode) !== normalize(position.data.articlecode);
        const actions = [];
        if (currentType() !== 'entry') {
          actions.push('<button class="secondary" type="button" data-position-index="' + index + '" data-position-slot="source" ' +
            (sameSource || !canUse ? 'disabled' : '') + '>Choisir comme source</button>');
        }
        if (currentType() !== 'exit') {
          actions.push('<button class="secondary" type="button" data-position-index="' + index + '" data-position-slot="destination" ' +
            (selectedSource && (sameSource || sourceMismatch) || !canUse ? 'disabled' : '') + '>Choisir comme destination</button>');
        }
        const balance = balanceNumber(position.data.currentqy);
        const invalidBalance = balance === null;
        return '<article class="result stock-movement-position-result">' +
          '<div class="grid">' +
          fieldHtml('Code article', identity.articlecode) +
          fieldHtml('Désignation', identity.designation) +
          fieldHtml('Magasin', identity.storename) +
          fieldHtml('Division', identity.divisionname) +
          fieldHtml('Emplacement', identity.address) +
          fieldHtml('Stock actuel', invalidBalance ? position.data.currentqy : balance) +
          '</div>' +
          (invalidBalance ? '<p class="status error">Cette position ne peut pas être utilisée, car son stock actuel n’est pas un nombre valide. Une correction administrative est nécessaire.</p>' :
            (typeof position.data.currentqy === 'string'
              ? '<p class="status">Quantité enregistrée comme texte (« ' + escapeHtml(position.data.currentqy) + ' ») : convertie en ' + escapeHtml(balance) + ' pour le calcul, puis enregistrée comme nombre au premier mouvement.</p>'
              : '')) +
          (!canUse ? '<p class="status error">Les données d’identité de cette position sont incomplètes. Une correction administrative est nécessaire.</p>' : '') +
          '<div class="stock-movement-actions">' + actions.join('') + '</div></article>';
      }).join('');
      positionResults.querySelectorAll('[data-position-index]').forEach((button) => {
        button.addEventListener('click', () => {
          const position = matches[Number(button.dataset.positionIndex)];
          if (button.dataset.positionSlot === 'source') {
            selectedSource = position;
            if (selectedDestination &&
              (selectedDestination.id === position.id ||
                normalize(selectedDestination.data.articlecode) !== normalize(position.data.articlecode))) {
              selectedDestination = null;
            }
          } else {
            selectedDestination = position;
          }
          invalidatePreview();
          renderSelections();
          renderPositionResults(matches);
          const selection = button.dataset.positionSlot === 'source' ? selectedFrom : selectedTo;
          const clearButton = selection.querySelector('[data-clear]');
          if (clearButton) clearButton.focus();
        });
      });
    }

    async function searchPositions(rawValue) {
      const searchText = normalize(rawValue);
      positionResults.innerHTML = '';
      if (!searchText) {
        setStatus(positionSearchStatus, 'Saisissez un code article, un code barre ou une désignation.', true);
        return;
      }
      if (!activeAdmin || !auth.currentUser) {
        setStatus(positionSearchStatus, 'Connectez-vous avec un compte administrateur pour chercher une position.', true);
        return;
      }
      setStatus(positionSearchStatus, 'Recherche des positions accessibles…');
      try {
        const matches = await readMatchingPositions(searchText);
        if (!matches.length) {
          setStatus(positionSearchStatus, 'Aucune position trouvée pour « ' + searchText + ' ». ', true);
        } else {
          setStatus(positionSearchStatus, matches.length + ' position(s) trouvée(s).', false, true);
        }
        renderPositionResults(matches);
      } catch (error) {
        console.error('Échec de la recherche d’une position pour un mouvement :', error);
        const detail = error && (error.code || error.message) ? error.code || error.message : 'erreur inconnue';
        setStatus(positionSearchStatus, 'La recherche des positions a échoué. Vérifiez les règles Firestore et la connexion. Détail : ' + detail, true);
      }
    }

    function previewLocation(position, label, before, after) {
      return '<section class="stock-movement-preview-location"><h4>' + escapeHtml(label) + '</h4>' +
        '<p>' + escapeHtml(positionDescription(position)) + '</p>' +
        '<div class="stock-movement-balance"><span>Avant</span><strong>' + escapeHtml(before) + '</strong>' +
        '<span>Après</span><strong>' + escapeHtml(after) + '</strong></div></section>';
    }

    function operationShape(type, quantity, source, destination, sourceBefore, destinationBefore) {
      const shape = { type, quantity, source, destination, sourceBefore, destinationBefore };
      if (type === 'entry') shape.destinationAfter = destinationBefore + quantity;
      if (type === 'exit') shape.sourceAfter = sourceBefore - quantity;
      if (type === 'transfer') {
        shape.sourceAfter = sourceBefore - quantity;
        shape.destinationAfter = destinationBefore + quantity;
      }
      return shape;
    }

    function renderOperationPreview(preview, statusMessage) {
      const title = movementLabel(preview.type);
      const locations = [];
      if (preview.source) locations.push(previewLocation(preview.source, 'Position source', preview.sourceBefore, preview.sourceAfter));
      if (preview.destination) locations.push(previewLocation(preview.destination, 'Position destination', preview.destinationBefore, preview.destinationAfter));
      previewContent.innerHTML =
        '<div class="stock-movement-preview-heading"><span class="stock-movement-kicker">À vérifier avant écriture</span><h3>' + escapeHtml(title) + '</h3></div>' +
        '<div class="stock-movement-summary">' +
        '<div><span>Quantité</span><strong>' + escapeHtml(preview.quantity) + '</strong></div>' +
        '<div><span>Note</span><strong>' + escapeHtml(preview.note || 'Aucune note') + '</strong></div></div>' +
        '<div class="stock-movement-preview-locations">' + locations.join('') + '</div>';
      pendingPreview = preview;
      previewPanel.classList.remove('hidden');
      confirmButton.disabled = operationBusy;
      if (statusMessage) setStatus(operationStatus, statusMessage);
    }

    function prepareOperationPreview() {
      clearStatus(operationStatus);
      const type = currentType();
      const quantity = quantityValue(quantityInput.value);
      if (!movementTypes.includes(type)) {
        setStatus(operationStatus, 'Choisissez une entrée, une sortie ou un transfert.', true);
        return;
      }
      if (quantity === null) {
        setStatus(operationStatus, 'Saisissez une quantité positive avec au plus deux décimales.', true);
        quantityInput.focus();
        return;
      }
      if (noteInput.value.length > 500) {
        setStatus(operationStatus, 'La note ne peut pas dépasser 500 caractères.', true);
        noteInput.focus();
        return;
      }
      if (type !== 'entry' && !selectedSource) {
        setStatus(operationStatus, 'Choisissez une position source avant de continuer.', true);
        return;
      }
      if (type !== 'exit' && !selectedDestination) {
        setStatus(operationStatus, 'Choisissez une position destination avant de continuer.', true);
        return;
      }
      if (type === 'transfer' && selectedSource.id === selectedDestination.id) {
        setStatus(operationStatus, 'La source et la destination doivent être deux positions différentes.', true);
        return;
      }
      if (type === 'transfer' && normalize(selectedSource.data.articlecode) !== normalize(selectedDestination.data.articlecode)) {
        setStatus(operationStatus, 'Un transfert doit concerner deux positions du même article.', true);
        return;
      }
      const source = type === 'entry' ? null : selectedSource;
      const destination = type === 'exit' ? null : selectedDestination;
      const sourceBefore = source ? balanceNumber(source.data.currentqy) : null;
      const destinationBefore = destination ? balanceNumber(destination.data.currentqy) : null;
      if (source && !validBalance(sourceBefore) || destination && !validBalance(destinationBefore)) {
        setStatus(operationStatus, 'Le stock actuel d’une position est absent ou invalide. Aucune quantité ne sera déduite du stock initial. Demandez une correction administrative.', true);
        return;
      }
      const preview = operationShape(type, quantity, source, destination, sourceBefore, destinationBefore);
      if (preview.sourceAfter !== undefined && preview.sourceAfter < 0) {
        setStatus(operationStatus, 'Stock insuffisant. Quantité disponible : ' + sourceBefore + '.', true);
        return;
      }
      if (preview.sourceAfter !== undefined && !validBalance(preview.sourceAfter) ||
        preview.destinationAfter !== undefined && !validBalance(preview.destinationAfter)) {
        setStatus(operationStatus, 'Le calcul dépasserait la plage de quantité autorisée. Vérifiez le stock actuel.', true);
        return;
      }
      renderOperationPreview({
        ...preview,
        note: noteInput.value.trim()
      });
    }

    function createMovementDocument(type, quantity, source, destination, sourceBefore, destinationBefore, note, user) {
      const movement = {
        type,
        quantity,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        actorUid: user.uid
      };
      if (typeof user.email === 'string' && user.email) movement.actorEmail = user.email;
      if (note) movement.note = note;
      if (source) {
        movement.fromPositionId = source.id;
        movement.fromPosition = positionIdentity(source.data);
        movement.fromBefore = sourceBefore;
        movement.fromAfter = sourceBefore - quantity;
      }
      if (destination) {
        movement.toPositionId = destination.id;
        movement.toPosition = positionIdentity(destination.data);
        movement.toBefore = destinationBefore;
        movement.toAfter = destinationBefore + quantity;
      }
      return movement;
    }

    function getPositionSnapshot(transactionSnapshot) {
      if (!transactionSnapshot.exists) throw customError('stock-movements/position-missing', 'Une position sélectionnée n’existe plus.');
      return { id: transactionSnapshot.id, data: transactionSnapshot.data() };
    }

    function checkSelectedIdentity(position) {
      if (!hasValidIdentity(positionIdentity(position.data))) {
        throw customError('stock-movements/invalid-identity', 'L’identité d’une position est incomplète. Demandez une correction administrative.');
      }
    }

    async function confirmOperation() {
      if (operationBusy || !pendingPreview) return;
      const user = auth.currentUser;
      if (!activeAdmin || !user || !activeUser || user.uid !== activeUser.uid) {
        setStatus(operationStatus, 'Votre session administrateur n’est plus active. Reconnectez-vous avant de confirmer.', true);
        return;
      }
      const preview = pendingPreview;
      const movementRef = db.collection('stockMovements').doc();
      const sourceRef = preview.source ? db.collection('stockPositions').doc(preview.source.id) : null;
      const destinationRef = preview.destination ? db.collection('stockPositions').doc(preview.destination.id) : null;
      operationBusy = true;
      confirmButton.disabled = true;
      setStatus(operationStatus, 'Enregistrement atomique du mouvement…');
      let latestPositions = null;
      try {
        await db.runTransaction(async (transaction) => {
          const sourceTask = sourceRef ? transaction.get(sourceRef) : Promise.resolve(null);
          const destinationTask = destinationRef ? transaction.get(destinationRef) : Promise.resolve(null);
          const snapshots = await Promise.all([sourceTask, destinationTask]);
          const source = snapshots[0] ? getPositionSnapshot(snapshots[0]) : null;
          const destination = snapshots[1] ? getPositionSnapshot(snapshots[1]) : null;
          if (source) checkSelectedIdentity(source);
          if (destination) checkSelectedIdentity(destination);
          const sourceBefore = source ? balanceNumber(source.data.currentqy) : null;
          const destinationBefore = destination ? balanceNumber(destination.data.currentqy) : null;
          if (source && !validBalance(sourceBefore) || destination && !validBalance(destinationBefore)) {
            throw customError('stock-movements/invalid-balance', 'Le stock actuel d’une position est invalide. Demandez une correction administrative.');
          }
          const actual = operationShape(preview.type, preview.quantity, source, destination, sourceBefore, destinationBefore);
          if (actual.sourceAfter !== undefined && actual.sourceAfter < 0) {
            throw customError('stock-movements/insufficient-stock', 'Stock insuffisant. Quantité disponible : ' + sourceBefore + '.');
          }
          if (actual.sourceAfter !== undefined && !validBalance(actual.sourceAfter) ||
            actual.destinationAfter !== undefined && !validBalance(actual.destinationAfter)) {
            throw customError('stock-movements/invalid-result', 'Le calcul dépasserait la plage de quantité autorisée.');
          }
          if (source && sourceBefore !== preview.sourceBefore || destination && destinationBefore !== preview.destinationBefore) {
            latestPositions = { source, destination };
            throw customError('stock-movements/preview-stale', 'Le stock a changé depuis l’aperçu.');
          }
          const movement = createMovementDocument(
            preview.type,
            preview.quantity,
            source,
            destination,
            sourceBefore,
            destinationBefore,
            preview.note,
            user
          );
          transaction.set(movementRef, movement);
          if (source) transaction.update(sourceRef, { currentqy: actual.sourceAfter, lastMovementId: movementRef.id });
          if (destination) transaction.update(destinationRef, { currentqy: actual.destinationAfter, lastMovementId: movementRef.id });
        });
        invalidatePreview();
        selectedSource = null;
        selectedDestination = null;
        quantityInput.value = '';
        noteInput.value = '';
        renderSelections();
        positionResults.innerHTML = '';
        setStatus(operationStatus, 'Mouvement enregistré. Identifiant : ' + movementRef.id, false, true);
        if (!historyPanel.classList.contains('hidden')) {
          filteredHistoryRecords = null;
          historyFilterKey = '';
          loadHistory();
        }
      } catch (error) {
        console.error('Échec de l’enregistrement du mouvement :', error);
        if (error.code === 'stock-movements/preview-stale' && latestPositions) {
          selectedSource = latestPositions.source || selectedSource;
          selectedDestination = latestPositions.destination || selectedDestination;
          renderSelections();
          prepareOperationPreview();
          setStatus(operationStatus, 'Le stock a changé. Vérifiez le nouvel aperçu puis confirmez de nouveau.', true);
        } else {
          setStatus(operationStatus, movementErrorMessage(error), true);
        }
      } finally {
        operationBusy = false;
        if (pendingPreview) confirmButton.disabled = false;
      }
    }

    function movementErrorMessage(error) {
      if (error && error.code === 'stock-movements/insufficient-stock') return error.message;
      if (error && error.code === 'stock-movements/invalid-balance') return error.message;
      if (error && error.code === 'stock-movements/invalid-identity') return error.message;
      if (error && error.code === 'stock-movements/position-missing') return error.message;
      if (error && error.code === 'stock-movements/invalid-result') return error.message;
      if (error && error.code === 'permission-denied') {
        const uid = auth.currentUser ? auth.currentUser.uid : 'non connecté';
        return 'Firestore a refusé cette opération. Les règles publiées ne contiennent probablement pas encore la version du dépôt : dans Firebase Console → Firestore → Règles, vérifiez la présence de legacyBalance et balanceMatches, collez si besoin le fichier firestore.rules puis Publier. Vérifiez aussi que votre compte a le rôle admin pour le UID : ' + uid;
      }
      if (error && ['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(error.code)) {
        return 'Le résultat de la connexion est incertain. Consultez l’historique avant de réessayer.';
      }
      const detail = error && (error.code || error.message) ? error.code || error.message : 'erreur inconnue';
      return 'Le mouvement n’a pas été confirmé. Vérifiez les quantités, les règles Firestore et la connexion. Détail : ' + detail;
    }

    function historyFilterValues() {
      return {
        type: element('stockMovementHistoryType').value,
        start: element('stockMovementHistoryStart').value,
        end: element('stockMovementHistoryEnd').value,
        article: normalize(element('stockMovementHistoryArticle').value),
        barcode: normalize(element('stockMovementHistoryBarcode').value),
        designation: normalize(element('stockMovementHistoryDesignation').value)
      };
    }

    function historyFilterError(filters) {
      const start = dateStart(filters.start);
      const end = dateStart(filters.end);
      if (filters.start && !start || filters.end && !end) return 'Saisissez une date valide.';
      if (start && end && start.getTime() > end.getTime()) return 'La date de début doit précéder la date de fin.';
      if (filters.designation && (!start || !end)) return 'La recherche par désignation exige une date de début et une date de fin.';
      return '';
    }

    function historyMatches(record, filters) {
      const data = record.data;
      if (filters.type && data.type !== filters.type) return false;
      const createdAt = timestampDate(data.createdAt);
      const start = dateStart(filters.start);
      const end = dateStart(filters.end);
      if (start && (!createdAt || createdAt < start)) return false;
      if (end) {
        const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
        if (!createdAt || createdAt >= endExclusive) return false;
      }
      const positions = [data.fromPosition, data.toPosition].filter(Boolean);
      if (filters.article && !positions.some((position) => normalize(position.articlecode) === filters.article)) return false;
      if (filters.barcode && !positions.some((position) => {
        const barcodes = Array.isArray(position.barcodes) ? position.barcodes : [position.barcodes];
        return barcodes.some((barcode) => normalize(barcode) === filters.barcode);
      })) return false;
      if (filters.designation && !positions.some((position) => normalizeSearch(position.designation).includes(normalizeSearch(filters.designation)))) return false;
      return true;
    }

    function filterKey(filters) {
      return JSON.stringify(filters);
    }

    async function readAllHistory(filters) {
      const collection = db.collection('stockMovements');
      const start = dateStart(filters.start);
      const end = dateStart(filters.end);
      const queryStart = start ? firebase.firestore.Timestamp.fromDate(start) : null;
      const queryEnd = end ? firebase.firestore.Timestamp.fromDate(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)) : null;
      let cursor = null;
      const records = [];
      let scanned = 0;
      while (true) {
        let query = collection.orderBy('createdAt', 'desc')
          .orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
          .limit(historyReadPageSize);
        if (queryStart) query = query.where('createdAt', '>=', queryStart);
        if (queryEnd) query = query.where('createdAt', '<', queryEnd);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        page.docs.forEach((doc) => records.push({ id: doc.id, data: doc.data() }));
        scanned += page.size;
        setStatus(historyStatus, 'Lecture de l’historique : ' + scanned + ' mouvement(s) parcouru(s)…');
        if (page.size < historyReadPageSize) break;
        cursor = page.docs[page.docs.length - 1];
      }
      return records.filter((record) => historyMatches(record, filters));
    }

    function historyPositionText(position) {
      if (!position) return 'Aucune';
      return [
        position.articlecode,
        position.designation,
        position.storename,
        position.divisionname,
        position.address
      ].filter(Boolean).join(' · ');
    }

    function renderHistoryRecord(record) {
      const data = record.data;
      const createdAt = timestampDate(data.createdAt);
      const dateText = createdAt ? createdAt.toLocaleString('fr-FR') : 'Date indisponible';
      const fromText = historyPositionText(data.fromPosition);
      const toText = historyPositionText(data.toPosition);
      const article = data.toPosition && data.toPosition.articlecode || data.fromPosition && data.fromPosition.articlecode || '';
      const correctionButton = data.type !== 'reversal'
        ? '<button class="secondary stock-movement-reversal-trigger" type="button" data-movement-id="' + escapeHtml(record.id) + '">Corriger</button>'
        : '<span class="small">Correction liée : ' + escapeHtml(data.reversesMovementId || '') + '</span>';
      return '<tr>' +
        '<td><time>' + escapeHtml(dateText) + '</time><span class="small stock-movement-actor">' + escapeHtml(data.actorEmail || data.actorUid || '') + '</span></td>' +
        '<td>' + escapeHtml(movementLabel(data.type, data.reversesType)) + '</td>' +
        '<td>' + escapeHtml(article) + '</td>' +
        '<td>' + escapeHtml(fromText) + '</td>' +
        '<td>' + escapeHtml(toText) + '</td>' +
        '<td>' + escapeHtml(data.quantity) + '</td>' +
        '<td>' + escapeHtml(data.note || 'Aucune note') + '</td>' +
        '<td>' + correctionButton + '</td>' +
        '</tr>';
    }

    function renderHistory(records, hasPrevious, hasNext, pageNumber, totalPages) {
      if (!records.length) {
        historyBody.innerHTML = '<tr><td colspan="8"><p class="stock-movement-empty">Aucun mouvement ne correspond à ces filtres.</p></td></tr>';
      } else {
        historyBody.innerHTML = records.map(renderHistoryRecord).join('');
      }
      historyPrevious.disabled = !hasPrevious;
      historyNext.disabled = !hasNext;
      historyPrevious.classList.toggle('hidden', !hasPrevious);
      historyNext.classList.toggle('hidden', !hasNext);
      historyPageLabel.textContent = totalPages
        ? 'Page ' + pageNumber + ' sur ' + totalPages
        : 'Page ' + pageNumber;
      historyBody.querySelectorAll('.stock-movement-reversal-trigger').forEach((button) => {
        button.addEventListener('click', () => prepareReversal(button.dataset.movementId));
      });
    }

    async function loadServerHistoryPage() {
      let query = db.collection('stockMovements')
        .orderBy('createdAt', 'desc')
        .orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
        .limit(movementPageSize + 1);
      const cursor = historyPageStarts[historyPageIndex];
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      const docs = snapshot.docs.slice(0, movementPageSize).map((doc) => ({ id: doc.id, data: doc.data() }));
      historyPageRecords = snapshot.docs;
      historyHasNext = snapshot.size > movementPageSize;
      renderHistory(docs, historyPageIndex > 0, historyHasNext, historyPageIndex + 1, 0);
      setStatus(historyStatus, docs.length ? 'Historique chargé, du mouvement le plus récent au plus ancien.' : 'Aucun mouvement enregistré.', false, !docs.length);
    }

    async function loadFilteredHistory(filters, key) {
      if (filteredHistoryRecords === null || historyFilterKey !== key) {
        setStatus(historyStatus, 'Chargement complet des mouvements correspondant aux filtres…');
        filteredHistoryRecords = await readAllHistory(filters);
        historyFilterKey = key;
      }
      const totalPages = Math.ceil(filteredHistoryRecords.length / movementPageSize);
      const startIndex = filteredHistoryPage * movementPageSize;
      const page = filteredHistoryRecords.slice(startIndex, startIndex + movementPageSize);
      renderHistory(page, filteredHistoryPage > 0, startIndex + movementPageSize < filteredHistoryRecords.length, filteredHistoryPage + 1, totalPages);
      setStatus(historyStatus, filteredHistoryRecords.length + ' mouvement(s) correspondent aux filtres.', false, filteredHistoryRecords.length === 0);
    }

    async function loadHistory() {
      if (!activeAdmin || !auth.currentUser) return;
      const filters = historyFilterValues();
      const invalid = historyFilterError(filters);
      if (invalid) {
        setStatus(historyStatus, invalid, true);
        historyBody.innerHTML = '';
        return;
      }
      const key = filterKey(filters);
      const hasFilters = Object.values(filters).some(Boolean);
      try {
        if (hasFilters) {
          historyMode = 'filtered';
          await loadFilteredHistory(filters, key);
        } else {
          historyMode = 'server';
          await loadServerHistoryPage();
        }
      } catch (error) {
        console.error('Échec de la lecture de l’historique :', error);
        const detail = error && (error.code || error.message) ? error.code || error.message : 'erreur inconnue';
        setStatus(historyStatus, 'Impossible de lire l’historique. Vérifiez les règles Firestore, les index et la connexion. Détail : ' + detail, true);
        historyBody.innerHTML = '';
      }
    }

    function resetHistoryPagination() {
      historyPageIndex = 0;
      historyPageStarts = [null];
      historyPageRecords = [];
      historyHasNext = false;
      filteredHistoryRecords = null;
      filteredHistoryPage = 0;
      historyFilterKey = '';
    }

    function reversalAmounts(original, source, destination) {
      const amount = original.quantity;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw customError('stock-movements/invalid-origin', 'Le mouvement d’origine a une quantité invalide.');
      }
      if (original.type === 'entry') {
        const fromBefore = balanceNumber(source.data.currentqy);
        if (!validBalance(fromBefore)) throw customError('stock-movements/invalid-balance', 'Le stock actuel est invalide. Demandez une correction administrative.');
        const fromAfter = fromBefore - amount;
        if (!validBalance(fromAfter)) throw customError('stock-movements/invalid-result', 'La correction rendrait le stock invalide.');
        return { type: 'reversal', reversesType: 'entry', quantity: amount, source, destination: null, fromBefore, fromAfter };
      }
      if (original.type === 'exit') {
        const toBefore = balanceNumber(destination.data.currentqy);
        if (!validBalance(toBefore)) throw customError('stock-movements/invalid-balance', 'Le stock actuel est invalide. Demandez une correction administrative.');
        const toAfter = toBefore + amount;
        if (!validBalance(toAfter)) throw customError('stock-movements/invalid-result', 'La correction rendrait le stock invalide.');
        return { type: 'reversal', reversesType: 'exit', quantity: amount, source: null, destination, toBefore, toAfter };
      }
      if (original.type === 'transfer') {
        const fromBefore = balanceNumber(source.data.currentqy);
        const toBefore = balanceNumber(destination.data.currentqy);
        if (!validBalance(fromBefore) || !validBalance(toBefore)) {
          throw customError('stock-movements/invalid-balance', 'Le stock actuel d’une position est invalide. Demandez une correction administrative.');
        }
        const fromAfter = fromBefore - amount;
        const toAfter = toBefore + amount;
        if (!validBalance(fromAfter) || !validBalance(toAfter)) {
          throw customError('stock-movements/invalid-result', 'La correction rendrait le stock invalide.');
        }
        return {
          type: 'reversal',
          reversesType: 'transfer',
          quantity: amount,
          source,
          destination,
          fromBefore,
          fromAfter,
          toBefore,
          toAfter
        };
      }
      throw customError('stock-movements/invalid-origin', 'Une correction ne peut porter que sur une entrée, une sortie ou un transfert.');
    }

    function reversalPreviewHtml(original, shape) {
      const locations = [];
      if (shape.source) locations.push(previewLocation(shape.source, 'Position source', shape.fromBefore, shape.fromAfter));
      if (shape.destination) locations.push(previewLocation(shape.destination, 'Position destination', shape.toBefore, shape.toAfter));
      return '<div class="stock-movement-preview-heading"><span class="stock-movement-kicker">Correction inverse</span><h3>' +
        escapeHtml(movementLabel('reversal', original.type)) + '</h3></div>' +
        '<p>Cette correction sera liée au mouvement ' + escapeHtml(original.id) + ' et ne pourra être créée qu’une fois.</p>' +
        '<div class="stock-movement-summary"><div><span>Quantité</span><strong>' + escapeHtml(shape.quantity) + '</strong></div></div>' +
        '<div class="stock-movement-preview-locations">' + locations.join('') + '</div>';
    }

    async function prepareReversal(movementId) {
      if (!activeAdmin || !auth.currentUser) {
        setStatus(historyStatus, 'Votre session administrateur n’est plus active.', true);
        return;
      }
      setStatus(historyStatus, 'Lecture des quantités actuelles avant correction…');
      try {
        const originalSnapshot = await db.collection('stockMovements').doc(movementId).get({ source: 'server' });
        if (!originalSnapshot.exists) throw customError('stock-movements/origin-missing', 'Le mouvement d’origine n’existe plus.');
        const existingReversal = await db.collection('stockMovements').doc('reversal_' + movementId).get({ source: 'server' });
        if (existingReversal.exists) throw customError('stock-movements/already-reversed', 'Ce mouvement a déjà été corrigé.');
        const original = { id: originalSnapshot.id, ...originalSnapshot.data() };
        if (original.type === 'reversal') throw customError('stock-movements/invalid-origin', 'Une correction ne peut pas être corrigée une seconde fois.');
        let source = null;
        let destination = null;
        if (original.type === 'entry') {
          const snapshot = await db.collection('stockPositions').doc(original.toPositionId).get({ source: 'server' });
          source = getPositionSnapshot(snapshot);
        } else if (original.type === 'exit') {
          const snapshot = await db.collection('stockPositions').doc(original.fromPositionId).get({ source: 'server' });
          destination = getPositionSnapshot(snapshot);
        } else if (original.type === 'transfer') {
          const snapshots = await Promise.all([
            db.collection('stockPositions').doc(original.toPositionId).get({ source: 'server' }),
            db.collection('stockPositions').doc(original.fromPositionId).get({ source: 'server' })
          ]);
          source = getPositionSnapshot(snapshots[0]);
          destination = getPositionSnapshot(snapshots[1]);
        } else {
          throw customError('stock-movements/invalid-origin', 'Ce type de mouvement ne peut pas être corrigé.');
        }
        if (source) checkSelectedIdentity(source);
        if (destination) checkSelectedIdentity(destination);
        const shape = reversalAmounts(original, source, destination);
        if (shape.fromAfter !== undefined && shape.fromAfter < 0) {
          throw customError('stock-movements/insufficient-stock', 'La correction rendrait le stock négatif. Demandez une vérification administrative.');
        }
        if (shape.fromAfter !== undefined && !validBalance(shape.fromAfter) ||
          shape.toAfter !== undefined && !validBalance(shape.toAfter)) {
          throw customError('stock-movements/invalid-result', 'La correction rendrait le stock invalide.');
        }
        pendingReversal = {
          id: original.id,
          original,
          shape,
          actorUid: auth.currentUser.uid
        };
        reversalPreview.innerHTML = reversalPreviewHtml(original, shape);
        clearStatus(reversalStatus);
        reversalConfirm.disabled = false;
        reversalDialog.showModal();
        reversalConfirm.focus();
        clearStatus(historyStatus);
      } catch (error) {
        console.error('Échec de la préparation de la correction :', error);
        setStatus(historyStatus, error.code === 'stock-movements/insufficient-stock' || error.code === 'stock-movements/already-reversed' ? error.message :
          'La correction ne peut pas être préparée. ' + (error.code || error.message || 'Erreur inconnue'), true);
      }
    }

    function createReversalDocument(original, shape, user) {
      const movement = {
        type: 'reversal',
        quantity: shape.quantity,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        actorUid: user.uid,
        reversesMovementId: original.id,
        reversesType: original.type
      };
      if (typeof user.email === 'string' && user.email) movement.actorEmail = user.email;
      if (typeof original.note === 'string' && original.note) movement.note = original.note;
      if (shape.source) {
        movement.fromPositionId = shape.source.id;
        movement.fromPosition = positionIdentity(shape.source.data);
        movement.fromBefore = shape.fromBefore;
        movement.fromAfter = shape.fromAfter;
      }
      if (shape.destination) {
        movement.toPositionId = shape.destination.id;
        movement.toPosition = positionIdentity(shape.destination.data);
        movement.toBefore = shape.toBefore;
        movement.toAfter = shape.toAfter;
      }
      return movement;
    }

    async function confirmReversal() {
      if (!pendingReversal) return;
      const draft = pendingReversal;
      const user = auth.currentUser;
      if (!user || user.uid !== draft.actorUid || !activeAdmin) {
        setStatus(reversalStatus, 'Votre session administrateur a changé. Fermez cette fenêtre et recommencez.', true);
        return;
      }
      const originalRef = db.collection('stockMovements').doc(draft.id);
      const reversalRef = db.collection('stockMovements').doc('reversal_' + draft.id);
      const sourceRef = draft.shape.source ? db.collection('stockPositions').doc(draft.shape.source.id) : null;
      const destinationRef = draft.shape.destination ? db.collection('stockPositions').doc(draft.shape.destination.id) : null;
      reversalConfirm.disabled = true;
      setStatus(reversalStatus, 'Vérification et enregistrement atomique de la correction…');
      let freshShape = null;
      try {
        await db.runTransaction(async (transaction) => {
          const reversalTask = transaction.get(reversalRef);
          const originalTask = transaction.get(originalRef);
          const snapshots = await Promise.all([reversalTask, originalTask]);
          if (snapshots[0].exists) throw customError('stock-movements/already-reversed', 'Ce mouvement a déjà été corrigé.');
          if (!snapshots[1].exists) throw customError('stock-movements/origin-missing', 'Le mouvement d’origine n’existe plus.');
          const original = { id: snapshots[1].id, ...snapshots[1].data() };
          if (original.type !== draft.original.type || original.type === 'reversal') {
            throw customError('stock-movements/origin-changed', 'Le mouvement d’origine a changé. Rechargez l’historique.');
          }
          const positionTasks = [
            sourceRef ? transaction.get(sourceRef) : Promise.resolve(null),
            destinationRef ? transaction.get(destinationRef) : Promise.resolve(null)
          ];
          const positionSnapshots = await Promise.all(positionTasks);
          const source = positionSnapshots[0] ? getPositionSnapshot(positionSnapshots[0]) : null;
          const destination = positionSnapshots[1] ? getPositionSnapshot(positionSnapshots[1]) : null;
          if (source) checkSelectedIdentity(source);
          if (destination) checkSelectedIdentity(destination);
          const shape = reversalAmounts(original, source, destination);
          if (shape.fromAfter !== undefined && shape.fromAfter < 0) {
            throw customError('stock-movements/insufficient-stock', 'La correction rendrait le stock négatif. Demandez une vérification administrative.');
          }
          const stale =
            source && shape.fromBefore !== draft.shape.fromBefore ||
            destination && shape.toBefore !== draft.shape.toBefore;
          if (stale) {
            freshShape = { original, shape };
            throw customError('stock-movements/preview-stale', 'Le stock a changé depuis l’aperçu de correction.');
          }
          const movement = createReversalDocument(original, shape, user);
          transaction.set(reversalRef, movement);
          if (source) transaction.update(sourceRef, { currentqy: shape.fromAfter, lastMovementId: reversalRef.id });
          if (destination) transaction.update(destinationRef, { currentqy: shape.toAfter, lastMovementId: reversalRef.id });
        });
        reversalDialog.close();
        pendingReversal = null;
        setStatus(historyStatus, 'Correction enregistrée. Consultez l’historique pour vérifier le mouvement inverse.', false, true);
        resetHistoryPagination();
        loadHistory();
      } catch (error) {
        console.error('Échec de la correction du mouvement :', error);
        if (error.code === 'stock-movements/preview-stale' && freshShape) {
          draft.original = freshShape.original;
          draft.shape = freshShape.shape;
          reversalPreview.innerHTML = reversalPreviewHtml(freshShape.original, freshShape.shape);
          reversalConfirm.disabled = false;
          setStatus(reversalStatus, 'Le stock a changé. Vérifiez ce nouvel aperçu puis confirmez de nouveau.', true);
        } else if (error.code === 'stock-movements/insufficient-stock') {
          setStatus(reversalStatus, error.message, true);
          reversalConfirm.disabled = false;
        } else if (error.code === 'stock-movements/invalid-result') {
          setStatus(reversalStatus, error.message, true);
          reversalConfirm.disabled = false;
        } else if (error.code === 'stock-movements/already-reversed') {
          setStatus(reversalStatus, error.message + ' Rechargez l’historique.', true);
          reversalConfirm.disabled = true;
        } else if (error.code === 'permission-denied') {
          setStatus(reversalStatus, 'Firestore a refusé cette correction. Vérifiez le rôle admin et les règles de sécurité.', true);
          reversalConfirm.disabled = false;
        } else if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(error.code)) {
          setStatus(reversalStatus, 'Le résultat de la connexion est incertain. Consultez l’historique avant de réessayer.', true);
          reversalConfirm.disabled = false;
        } else {
          setStatus(reversalStatus, 'La correction n’a pas été confirmée. ' + (error.code || error.message || 'Erreur inconnue'), true);
          reversalConfirm.disabled = false;
        }
      }
    }

    function handleTabKeydown(event, tabList, tabs) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const visibleTabs = tabs.filter((tab) => !tab.classList.contains('hidden'));
      const currentIndex = visibleTabs.indexOf(document.activeElement);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % visibleTabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = visibleTabs.length - 1;
      const next = visibleTabs[nextIndex];
      next.focus();
      next.click();
      tabList.setAttribute('aria-activedescendant', next.id);
    }

    searchTab.addEventListener('click', () => showWorkspaceView('search'));
    adminTab.addEventListener('click', () => {
      if (activeAdmin) showWorkspaceView('movements');
    });
    element('stockWorkspaceTabs').addEventListener('keydown', (event) => {
      handleTabKeydown(event, element('stockWorkspaceTabs'), [searchTab, adminTab]);
    });
    operationTab.addEventListener('click', () => showMovementSubView('operation'));
    historyTab.addEventListener('click', () => showMovementSubView('history'));
    element('stockMovementTabs').addEventListener('keydown', (event) => {
      handleTabKeydown(event, element('stockMovementTabs'), [operationTab, historyTab]);
    });
    element('stockMovementPositionSearch').addEventListener('submit', (event) => {
      event.preventDefault();
      searchPositions(element('stockMovementSearchInput').value);
    });
    element('stockMovementSearchInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchPositions(event.currentTarget.value);
      }
    });
    element('stockMovementScanBtn').addEventListener('click', () => {
      if (options.startScanner) {
        options.startScanner((code) => {
          element('stockMovementSearchInput').value = code;
          searchPositions(code);
        });
      }
    });
    typeInput.addEventListener('change', () => {
      selectedSource = null;
      selectedDestination = null;
      invalidatePreview();
      renderSelections();
      if (positionResults.childElementCount) searchPositions(element('stockMovementSearchInput').value);
    });
    element('stockMovementPreviewBtn').addEventListener('click', prepareOperationPreview);
    element('stockMovementForm').addEventListener('submit', (event) => {
      event.preventDefault();
      prepareOperationPreview();
    });
    confirmButton.addEventListener('click', confirmOperation);
    quantityInput.addEventListener('input', invalidatePreview);
    noteInput.addEventListener('input', invalidatePreview);
    historyFilterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      resetHistoryPagination();
      loadHistory();
    });
    element('stockMovementHistoryClear').addEventListener('click', () => {
      historyFilterForm.reset();
      resetHistoryPagination();
      loadHistory();
    });
    historyPrevious.addEventListener('click', () => {
      if (historyMode === 'filtered') {
        filteredHistoryPage = Math.max(0, filteredHistoryPage - 1);
        loadHistory();
        return;
      }
      historyPageIndex = Math.max(0, historyPageIndex - 1);
      loadHistory();
    });
    historyNext.addEventListener('click', () => {
      if (historyMode === 'filtered') {
        filteredHistoryPage += 1;
        loadHistory();
        return;
      }
      if (!historyHasNext || !historyPageRecords.length) return;
      const lastVisible = historyPageRecords[movementPageSize - 1];
      historyPageIndex += 1;
      historyPageStarts[historyPageIndex] = lastVisible;
      loadHistory();
    });
    element('stockMovementHistoryType').addEventListener('change', () => {
      resetHistoryPagination();
      loadHistory();
    });
    element('stockMovementHistoryStart').addEventListener('change', () => {
      resetHistoryPagination();
      loadHistory();
    });
    element('stockMovementHistoryEnd').addEventListener('change', () => {
      resetHistoryPagination();
      loadHistory();
    });
    reversalCancel.addEventListener('click', () => {
      reversalDialog.close();
      pendingReversal = null;
    });
    reversalConfirm.addEventListener('click', confirmReversal);
    reversalDialog.addEventListener('close', () => {
      if (pendingReversal && !operationBusy) pendingReversal = null;
    });

    renderSelections();
    auth.onAuthStateChanged((user) => {
      authGeneration += 1;
      resetMovementState();
      activeUser = user || null;
      watchAdminAccess(user, authGeneration);
    });
  }

  window.initializeStockMovements = initializeStockMovements;
}());
