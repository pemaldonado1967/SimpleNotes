document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const themeToggle = document.getElementById('theme-toggle');
    const userLogo = document.getElementById('user-logo');
    const logoUpload = document.getElementById('logo-upload');
    const userName = document.getElementById('user-name');
    const searchBox = document.getElementById('search-box');
    const addNoteBtn = document.getElementById('add-note-btn');
    const noteInput = document.getElementById('note-input');
    const micBtn = document.getElementById('mic-btn');
    const notesTbody = document.getElementById('notes-tbody');
    const tableHeader = document.getElementById('table-header');
    const appFooter = document.getElementById('app-footer');
    const columnToggleBtn = document.getElementById('column-toggle');
    const columnModal = document.getElementById('column-modal');
    const selectionContextMenu = document.getElementById('selection-context-menu');
    const markDeleteBtn = document.getElementById('mark-delete-btn');
    const recoverBtn = document.getElementById('recover-btn');
    const deletePermanentlyBtn = document.getElementById('delete-permanently-btn');
    const shareBtn = document.getElementById('share-btn');
    // New Elements
    const toggleDeletedBtn = document.getElementById('toggle-deleted-btn');
    const langSelect = document.getElementById('lang-select');
    const advancedToolsBtn = document.getElementById('advanced-tools-btn');
    const advancedToolsModal = document.getElementById('advanced-tools-modal');
    const renumberBtn = document.getElementById('renumber-notes-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const importJsonBtn = document.getElementById('import-json-btn');
    const importFileInput = document.getElementById('import-file-input');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');
    // New Totals Display Elements
    const totalQtySpan = document.getElementById('total-qty');
    const totalAmountSpan = document.getElementById('total-amount');
    const totalSubtotalSpan = document.getElementById('total-subtotal');
    // Tag Autocomplete Modal Elements
    const tagInputModal = document.getElementById('tag-input-modal');
    const tagInputField = document.getElementById('tag-input-field');
    const tagSuggestionsList = document.getElementById('tag-suggestions-list');

    // --- STATE MANAGEMENT ---
    let notes = [];
    let noteIdCounter = 1;
    let selectedNoteIds = new Set();
    let sortConfig = { key: 'created', direction: 'desc' };
    let activeTagFilters = new Set();
    let searchTerm = '';
    let showDeleted = false;
    let confirmCallback = null;
    let currentNoteIdForTagging = null;
    let columnConfig = {
        order: ['selection', 'id', 'content', 'qty', 'amount', 'subtotal', 'due', 'tags', 'created'],
        visible: { selection: true, id: true, content: true, qty: true, amount: true, subtotal: true, due: true, tags: true, created: true },
        widths: {}
    };
    const columnLabels = {
        selection: '', id: 'ID', content: 'Note Content', 
        qty: 'Qty', amount: 'Amount', subtotal: 'SubTotal', due: 'Due',
        tags: 'Tags', created: 'Date Created'
    };
    const speechLanguages = [
        { name: 'English (US)', code: 'en-US' }, { name: 'Español (MX)', code: 'es-MX' },
        { name: 'Français (FR)', code: 'fr-FR' }, { name: 'Deutsch (DE)', code: 'de-DE' },
        { name: 'Italiano (IT)', code: 'it-IT' }, { name: '日本語 (JP)', code: 'ja-JP' }
    ];
    const placeholderText = `💡Type or speak your Alpha-Numeric note. 1.Amounts preceded by its currency code "USD100", "ARS2000"; 2.Dates "25/12" (current year), or "25/12/27" (specific); 3.Formulas "=(500+200)/12"; 4.Recurrency with "every ..." or "cada ..."(every month, cada 1 mes); 5.Quantities as "Q##" (Q12); 6.Notifications are automatic daily at 9AM`;

    noteInput.placeholder = placeholderText;

    // --- SPEECH RECOGNITION SETUP ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript) noteInput.value += finalTranscript + '. ';
        };
        recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    } else {
        micBtn.style.display = 'none';
        langSelect.style.display = 'none';
    }

    // --- INITIALIZATION ---
    loadState();
    populateLanguages();
    renderApp();
    setupEventListeners();
    // New: Initialize reminders
    initReminders();
    processRecurrence();

    // --- DATA & STATE FUNCTIONS ---
    function loadState() {
        notes = JSON.parse(localStorage.getItem('notes-app-notes') || '[]');
        noteIdCounter = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
        const theme = localStorage.getItem('notes-app-theme');
        if (theme) document.documentElement.setAttribute('data-theme', theme);
        userLogo.src = localStorage.getItem('notes-app-logo') || userLogo.src;
        userName.value = localStorage.getItem('notes-app-name') || userName.value;
        const storedColumns = localStorage.getItem('notes-app-columns');
        if (storedColumns) {
            const loadedConfig = JSON.parse(storedColumns);
            
            // Preserve existing order, add new columns at the end
            const defaultOrder = ['selection', 'id', 'content', 'qty', 'amount', 'subtotal', 'due', 'tags', 'created'];
            const mergedOrder = [];
            
            // Add columns from loaded config first, maintaining their order
            loadedConfig.order.forEach(key => {
                if (defaultOrder.includes(key) && !mergedOrder.includes(key)) {
                    mergedOrder.push(key);
                }
            });
            // Add any new default columns that weren't in the loaded config
            defaultOrder.forEach(key => {
                if (!mergedOrder.includes(key)) {
                    mergedOrder.push(key);
                }
            });
            columnConfig.order = mergedOrder;
            columnConfig.visible = { ...columnConfig.visible, ...loadedConfig.visible }; // Merge visibility, new ones default to true
            columnConfig.widths = { ...columnConfig.widths, ...loadedConfig.widths }; // Merge widths
        }
    }

    function saveState() {
        localStorage.setItem('notes-app-notes', JSON.stringify(notes));
        localStorage.setItem('notes-app-columns', JSON.stringify(columnConfig));
    }

    function findNoteById(id) {
        return notes.find(note => note.id === id);
    }

    function getAllUniqueTags() {
        const allTags = new Set();
        notes.forEach(note => {
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(tag => allTags.add(tag));
            }
        });
        return Array.from(allTags);
    }

    function parseNoteContent(content) {
        const parsed = { qty: null, amount: null, currencyCode: null, dueDateISO: null, dueDateFormatted: null, recurrence: null };

        // 1. Parse Quantity: e.g., "Q5"
        const qtyMatch = content.match(/\bQ(\d+)\b/i);
        if (qtyMatch) {
            parsed.qty = parseInt(qtyMatch[1], 10);
        }

        // 2. Parse Amount. Try calculation (with optional currency) first, then static currency-based amount.
        const calcMatch = content.match(/\b(?:([A-Z]{3})\s*)?=\s*([\d\.\+\-\*\/\(\)\s]+)/i);

        if (calcMatch) {
            const currency = calcMatch[1]; // Might be undefined
            const expression = calcMatch[2].trim();
            
            // Basic validation to prevent malicious code injection
            if (/^[\d\.\+\-\*\/\(\)\s]+$/.test(expression)) {
                try {
                    // Use Function constructor for safer evaluation than eval()
                    const calculatedAmount = new Function('return ' + expression)();
                    if (typeof calculatedAmount === 'number' && isFinite(calculatedAmount)) {
                        parsed.amount = calculatedAmount;
                        if (currency) {
                            parsed.currencyCode = currency.toUpperCase();
                        }
                    }
                } catch (e) {
                    console.error("Calculation error:", e);
                }
            }
        } else {
            const amountMatch = content.match(/\b(?!Due\b)([A-Z]{3})(\d+(\.\d{1,2})?)\b/i);
            if (amountMatch) {
                parsed.currencyCode = amountMatch[1].toUpperCase();
                parsed.amount = parseFloat(amountMatch[2]);
            }
        }

        if (typeof parsed.amount === 'number' && parsed.qty === null) {
            parsed.qty = 1;
        }

        // 3. Parse Natural Date: e.g., "24/12" or "02/05/26"
        const dateMatch = content.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
        if (dateMatch) {
            const day = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10);
            let year;

            if (dateMatch[3]) { // Year is provided
                if (dateMatch[3].length === 2) {
                    year = parseInt('20' + dateMatch[3], 10);
                } else {
                    year = parseInt(dateMatch[3], 10);
                }
            } else { // No year provided
                const now = new Date();
                year = now.getFullYear();
                const prospectiveDate = new Date(year, month - 1, day);
                // If date without year is in the past, assume it's for the next year
                if (prospectiveDate < now && (prospectiveDate.toDateString() !== now.toDateString())) {
                    year++;
                }
            }

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
                const parsedDate = new Date(year, month - 1, day);
                if (parsedDate.getFullYear() === year && parsedDate.getMonth() === (month - 1) && parsedDate.getDate() === day) { // Validate date (e.g. not 31/02)
                     parsed.dueDateISO = parsedDate.toISOString();
                     parsed.dueDateFormatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                }
            }
        }

        // 4. Parse Recurrence Rule (e.g., "every month", "every 2 weeks")
        // Updated regex to support English (every) and Spanish (cada) keywords and units.
        const recurrenceMatch = content.match(/\b(every|cada)\s+(?:(\d+)\s+)?(day|week|month|year|d[íi]a|semana|mes|a[ñn]o)s?\b/i);
        if (recurrenceMatch) {
            const recurrence = { rule: null, interval: 1 };
            if (recurrenceMatch[2]) { // The number is now in the second capture group
                recurrence.interval = parseInt(recurrenceMatch[2], 10);
            }
            const unit = recurrenceMatch[3].toLowerCase();
            
            if (unit.startsWith('day') || unit.startsWith('d')) recurrence.rule = 'daily';
            else if (unit.startsWith('week') || unit.startsWith('semana')) recurrence.rule = 'weekly';
            else if (unit.startsWith('month') || unit.startsWith('mes')) recurrence.rule = 'monthly';
            else if (unit.startsWith('year') || unit.startsWith('a')) recurrence.rule = 'yearly';

            if (recurrence.rule) {
                parsed.recurrence = recurrence;
            }
        }

        return parsed;
    }

    // --- RENDER FUNCTIONS ---
    function renderApp() {
        renderHeader();
        renderTable();
        renderFooter();
        renderColumnModal();
        hideTagInput(); // Ensure tag input is hidden on general re-render
        calculateAndRenderTotals(); // New: Calculate and render totals
    }

    function renderHeader() {
        tableHeader.innerHTML = '';
        const tr = document.createElement('tr');
        columnConfig.order.forEach(key => {
            if (!columnConfig.visible[key]) return;
            const th = document.createElement('th');
            th.dataset.key = key;
            th.style.width = columnConfig.widths[key] || 'auto';
            if (key === 'selection') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.addEventListener('click', handleSelectAll);
                th.appendChild(checkbox);
            } else {
                th.textContent = columnLabels[key];
                th.classList.add('sortable');
                th.draggable = true;
                const indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                if (sortConfig.key === key) {
                    indicator.textContent = sortConfig.direction === 'asc' ? '▲' : '▼';
                }
                th.appendChild(indicator);
                th.addEventListener('click', () => handleSort(key));
            }
            tr.appendChild(th);
        });
        tableHeader.appendChild(tr);
    }

    function getNotesToDisplay() {
        // 1. Filter
        const filteredNotes = notes.filter(note => {
            if (!showDeleted && note.deleted) return false;

            // Create a temporary set of all "tags" for the current note for unified filtering
            const allNoteTags = new Set(note.tags || []);
            if (note.currencyCode) allNoteTags.add(note.currencyCode);
            if (note.dueDateFormatted) allNoteTags.add(note.dueDateFormatted);

            const matchesTag = activeTagFilters.size === 0 ? true : [...activeTagFilters].every(filterTag => allNoteTags.has(filterTag));
            const matchesSearch = searchTerm ? (note.content || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(note.id).includes(searchTerm) : true;
            return matchesTag && matchesSearch;
        });

        // 2. Sort
        filteredNotes.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filteredNotes;
    }

    function renderTable() {
        notesTbody.innerHTML = '';
        const notesToDisplay = getNotesToDisplay();

        notesToDisplay.forEach(note => {
            const row = document.createElement('tr');
            row.dataset.id = note.id;
            if (selectedNoteIds.has(note.id)) row.classList.add('selected');
            if (note.deleted) row.classList.add('deleted');

            columnConfig.order.forEach(key => {
                if (!columnConfig.visible[key]) return;
                const td = document.createElement('td');
                td.dataset.key = key;
                switch (key) {
                    case 'selection':
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.checked = selectedNoteIds.has(note.id);
                        td.appendChild(checkbox);
                        break;
                    case 'content':
                    case 'id':
                        td.textContent = note[key];
                        td.setAttribute('contenteditable', 'true');
                        break;
                    case 'tags':
                        renderTagsCell(td, note.tags, note.id);
                        break;
                    case 'created':
                        td.textContent = new Date(note.created).toLocaleString();
                        break;
                    case 'qty':
                        td.textContent = note.qty || '';
                        td.classList.add('numeric-cell');
                        break;
                    case 'amount':
                        if (typeof note.amount === 'number') {
                            if (note.currencyCode) {
                                const currencySpan = document.createElement('span');
                                currencySpan.textContent = note.currencyCode;
                                currencySpan.classList.add('currency-tag');
                                currencySpan.dataset.currency = note.currencyCode;
                                if (activeTagFilters.has(note.currencyCode)) currencySpan.classList.add('active');
                                td.appendChild(currencySpan);
                                td.append(` ${note.amount.toFixed(2)}`);
                            } else {
                                td.textContent = note.amount.toFixed(2);
                            }
                        }
                        td.classList.add('numeric-cell');
                        break;
                    case 'subtotal':
                        if (typeof note.amount === 'number') {
                            const qty = (typeof note.qty === 'number') ? note.qty : 1;
                            const subtotal = qty * note.amount;
                            if (note.currencyCode) {
                                td.textContent = `${note.currencyCode} ${subtotal.toFixed(2)}`;
                            } else {
                                td.textContent = subtotal.toFixed(2);
                            }
                        }
                        td.classList.add('numeric-cell');
                        break;
                    case 'due':
                        if (note.dueDateFormatted) {
                            const dateSpan = document.createElement('span');
                            dateSpan.textContent = note.dueDateFormatted;
                            dateSpan.classList.add('date-tag');
                            dateSpan.dataset.date = note.dueDateFormatted;
                            if (activeTagFilters.has(note.dueDateFormatted)) dateSpan.classList.add('active');
                            td.appendChild(dateSpan);
                        }
                        break;
                }
                row.appendChild(td);
            });
            notesTbody.appendChild(row);
        });
    }
    
    function renderTagsCell(td, tags, noteId) {
        td.innerHTML = ''; 
        td.classList.add('tags-cell');
        const note = findNoteById(noteId);

        // Add reminder bell icon if there's a due date
        if (note && note.dueDateISO && !note.deleted) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day
            const dueDate = new Date(note.dueDateISO);
            dueDate.setHours(0, 0, 0, 0); // Normalize to start of day

            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let bellColorClass = '';
            let bellTitle = `Due in ${diffDays} days`;

            if (diffDays < 2) { // Past, today, or tomorrow
                bellColorClass = 'bell-red';
                bellTitle = diffDays < 0 ? `Overdue by ${Math.abs(diffDays)} days` : `Due in ${diffDays} days`;
            } else if (diffDays <= 5) { // 2 to 5 days
                bellColorClass = 'bell-orange';
            } else { // 6 or more days
                bellColorClass = 'bell-green';
            }

            const bellIcon = document.createElement('span');
            bellIcon.className = `reminder-bell ${bellColorClass}`;
            bellIcon.textContent = 'notifications';
            bellIcon.title = bellTitle;
            td.appendChild(bellIcon);
        }

        // Add recurrence icon if applicable
        if (note && note.recurrence) {
            const icon = document.createElement('span');
            icon.className = 'recurrence-icon';
            icon.textContent = 'repeat';
            icon.title = `Recurs ${note.recurrence.rule} (every ${note.recurrence.interval})`;
            td.appendChild(icon);
        }

        (tags || []).forEach(tagText => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            if (activeTagFilters.has(tagText)) tagEl.classList.add('active');
            tagEl.textContent = tagText;
            tagEl.onclick = () => handleTagFilterClick(tagText);
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-tag';
            deleteBtn.textContent = 'x';
            deleteBtn.onclick = (e) => { // No need to find note again
                e.stopPropagation(); // Prevent the tag filter click from firing
                const note = findNoteById(noteId);
                note.tags = note.tags.filter(t => t !== tagText);
                saveState();
                renderApp();
            };
            tagEl.appendChild(deleteBtn);
            td.appendChild(tagEl);
        });
        const addTagBtn = document.createElement('span');
        addTagBtn.className = 'add-tag-btn';
        addTagBtn.textContent = '+';
        addTagBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent document click listener from closing the modal immediately
            showTagInput(noteId, addTagBtn);
        };
        td.appendChild(addTagBtn);
    }
    
    function renderFooter() {
        appFooter.innerHTML = '';
        const totalNotes = notes.filter(n => !n.deleted).length;
        const totalSpan = document.createElement('span');
        totalSpan.textContent = `Total Notes: ${totalNotes}`;
        appFooter.appendChild(totalSpan);

        const tagCounts = notes.reduce((acc, note) => {
            if (!note.deleted) {
                (note.tags || []).forEach(tag => { acc[tag] = (acc[tag] || 0) + 1; });
                // Also count currency and date as filterable tags
                if (note.currencyCode) {
                    acc[note.currencyCode] = (acc[note.currencyCode] || 0) + 1;
                }
                if (note.dueDateFormatted) {
                    acc[note.dueDateFormatted] = (acc[note.dueDateFormatted] || 0) + 1;
                }
            }
            return acc;
        }, {});
        const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
        
        sortedTags.forEach(([tag, count]) => {
            const button = document.createElement('button');
            button.className = 'tag-filter';
            button.textContent = `${tag} (${count})`;
            if (activeTagFilters.has(tag)) button.classList.add('active');
            button.onclick = () => handleTagFilterClick(tag);
            appFooter.appendChild(button);
        });
    }

    function renderColumnModal() {
        columnModal.innerHTML = '';
        const title = document.createElement('h4');
        title.textContent = 'Show/Hide Columns';
        columnModal.appendChild(title);
        
        Object.keys(columnLabels).forEach(key => {
            if (key !== 'selection') {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.key = key;
                checkbox.checked = columnConfig.visible[key];
                checkbox.onchange = (e) => {
                    columnConfig.visible[key] = e.target.checked;
                    saveState();
                    renderApp();
                };
                label.appendChild(checkbox);
                label.append(` ${columnLabels[key]}`);
                columnModal.appendChild(label);
            }
        });
    }

    // New: Calculate and render totals in the header
    function calculateAndRenderTotals() {
        let totalQty = 0;
        let totalAmount = 0;
        let totalSubtotal = 0;

        // The notes for totals should respect the same filters as the main table view for consistency.
        const notesForCalculation = getNotesToDisplay();

        notesForCalculation.forEach(note => {
            // Check for number type to avoid adding null/undefined which results in NaN
            if (typeof note.qty === 'number') totalQty += note.qty;
            if (typeof note.amount === 'number') totalAmount += note.amount;
            if (typeof note.amount === 'number') { // Subtotal calculation
                const qty = (typeof note.qty === 'number') ? note.qty : 1;
                totalSubtotal += (qty * note.amount);
            }
        });

        totalQtySpan.textContent = `Qty: ${totalQty}`;
        totalAmountSpan.textContent = `Amt: ${totalAmount.toFixed(2)}`;
        totalSubtotalSpan.textContent = `Sub: ${totalSubtotal.toFixed(2)}`;
    }

    function populateLanguages() {
        if (!recognition) return;
        speechLanguages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            langSelect.appendChild(option);
        });
        recognition.lang = langSelect.value || navigator.language || 'en-US';
    }

    // --- EVENT HANDLERS & LOGIC ---
    function setupEventListeners() {
        themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('notes-app-theme', newTheme);
        });

        logoUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    userLogo.src = event.target.result;
                    localStorage.setItem('notes-app-logo', event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
        userName.addEventListener('blur', () => localStorage.setItem('notes-app-name', userName.value));
        
        searchBox.addEventListener('input', e => {
            searchTerm = e.target.value;
            renderTable();
        });

        addNoteBtn.addEventListener('click', createNote);
        noteInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                createNote();
            }
        });
        micBtn.addEventListener('click', toggleMic);
        langSelect.addEventListener('change', () => {
            if (recognition) recognition.lang = langSelect.value;
        });

        document.addEventListener('click', () => {
            columnModal.style.display = 'none';
            advancedToolsModal.style.display = 'none';
            selectionContextMenu.style.display = 'none';
            // Hide tag input modal if click is outside
            if (tagInputModal.style.display === 'block') {
                hideTagInput();
            }
        });

        columnToggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            columnModal.style.display = columnModal.style.display === 'block' ? 'none' : 'block';
        });
        columnModal.addEventListener('click', e => e.stopPropagation());

        advancedToolsBtn.addEventListener('click', e => {
            e.stopPropagation();
            advancedToolsModal.style.display = advancedToolsModal.style.display === 'block' ? 'none' : 'block';
        });
        advancedToolsModal.addEventListener('click', e => e.stopPropagation());
        
        // Tag Autocomplete Listeners
        tagInputModal.addEventListener('click', e => e.stopPropagation());
        tagInputField.addEventListener('input', handleTagInputTyping);
        tagInputField.addEventListener('keydown', handleTagInputKeyDown);
        tagSuggestionsList.addEventListener('click', handleTagSuggestionClick);

        // --- DRAG & DROP FOR COLUMNS ---
        let draggedTh = null;

        tableHeader.addEventListener('dragstart', e => {
            const target = e.target.closest('th');
            if (target && target.draggable) {
                draggedTh = target;
                // Use a timeout to allow the browser to create the drag image before applying styles
                setTimeout(() => {
                    if (draggedTh) draggedTh.classList.add('dragging');
                }, 0);
            }
        });

        tableHeader.addEventListener('dragend', () => {
            if (draggedTh) draggedTh.classList.remove('dragging');
            tableHeader.querySelectorAll('th').forEach(th => th.classList.remove('drag-over'));
            draggedTh = null;
        });

        tableHeader.addEventListener('dragover', e => {
            const targetTh = e.target.closest('th');
            if (!draggedTh || !targetTh || targetTh === draggedTh || !targetTh.draggable) {
                return;
            }
            e.preventDefault(); // Necessary to allow dropping

            tableHeader.querySelectorAll('th').forEach(th => th.classList.remove('drag-over'));
            targetTh.classList.add('drag-over');
        });

        tableHeader.addEventListener('drop', e => {
            e.preventDefault();
            const dropTargetTh = e.target.closest('th');
            if (dropTargetTh && draggedTh && dropTargetTh !== draggedTh && dropTargetTh.draggable) {
                const order = columnConfig.order;
                const draggedKey = draggedTh.dataset.key;
                const targetKey = dropTargetTh.dataset.key;

                const draggedIndex = order.indexOf(draggedKey);
                const targetIndex = order.indexOf(targetKey);

                if (draggedIndex > -1 && targetIndex > -1) {
                    const [removed] = order.splice(draggedIndex, 1);
                    order.splice(targetIndex, 0, removed);
                    saveState();
                    renderApp();
                }
            }
            if (draggedTh) draggedTh.classList.remove('dragging');
            tableHeader.querySelectorAll('th').forEach(th => th.classList.remove('drag-over'));
            draggedTh = null;
        });

        tableHeader.addEventListener('mouseup', () => {
            tableHeader.querySelectorAll('th').forEach(th => {
                const key = th.dataset.key;
                if (key && th.style.width) columnConfig.widths[key] = th.style.width;
            });
            saveState();
        });
        
        notesTbody.addEventListener('click', handleTableClick);
        notesTbody.addEventListener('focusout', handleTableFocusOut);
        notesTbody.addEventListener('keydown', handleTableKeyDown);

        // --- NEW EVENT LISTENERS ---
        toggleDeletedBtn.addEventListener('click', () => {
            showDeleted = !showDeleted;
            notesTbody.classList.toggle('show-deleted', showDeleted);
            toggleDeletedBtn.classList.toggle('active', showDeleted);
            renderTable(); // Re-render to apply filter
        });

        markDeleteBtn.addEventListener('click', handleDeleteOrRecoverSelected.bind(null, true));
        recoverBtn.addEventListener('click', handleDeleteOrRecoverSelected.bind(null, false));
        deletePermanentlyBtn.addEventListener('click', handleDeletePermanently);
        shareBtn.addEventListener('click', handleShare);

        confirmYesBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            confirmationModal.style.display = 'none';
            confirmCallback = null;
        });
        confirmNoBtn.addEventListener('click', () => {
            confirmationModal.style.display = 'none';
            confirmCallback = null;
        });

        exportJsonBtn.addEventListener('click', handleExportJSON);
        exportCsvBtn.addEventListener('click', handleExportCSV);
        importJsonBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', handleImportJSON);
        renumberBtn.addEventListener('click', handleRenumber);

        // New listener for Escape key to close context menu
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                selectionContextMenu.style.display = 'none';
            }
        });
    }
    
    // --- REMINDER FUNCTIONS ---
    function initReminders() {
        // 1. Check if Service Worker and Notifications are supported
        if (!('serviceWorker' in navigator) || !('Notification' in window)) {
            console.log('Reminders are not supported in this browser.');
            return;
        }

        // 2. Request permission from the user
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted. Service Worker will handle reminders.');
            } else {
                console.log('Notification permission denied.');
            }
        });
    }

    function processRecurrence() {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize 'now' to the start of the day for accurate comparison
        const notesToAdd = [];
        let hasChanges = false;

        notes.forEach(note => {
            // Check if the note is a recurring one and its due date is in the past
            if (note.recurrence && note.dueDateISO) {
                let dueDate = new Date(note.dueDateISO);
                if (dueDate < now) {
                    let nextDueDate = new Date(dueDate);

                    // Keep advancing the date until it's in the future
                    while (nextDueDate < now) {
                        switch (note.recurrence.rule) {
                            case 'daily': nextDueDate.setDate(nextDueDate.getDate() + note.recurrence.interval); break;
                            case 'weekly': nextDueDate.setDate(nextDueDate.getDate() + (7 * note.recurrence.interval)); break;
                            case 'monthly': nextDueDate.setMonth(nextDueDate.getMonth() + note.recurrence.interval); break;
                            case 'yearly': nextDueDate.setFullYear(nextDueDate.getFullYear() + note.recurrence.interval); break;
                        }
                    }

                    // Create a new note based on the old one, but with the new future date
                    const newNote = { ...note }; // Copy properties
                    delete newNote.deleted; // New recurring tasks should not be deleted
                    newNote.id = noteIdCounter++;
                    // Re-parse content to get the new date properties
                    const newDateData = parseNoteContent(nextDueDate.toLocaleDateString('en-GB'));
                    newNote.dueDateISO = newDateData.dueDateISO;
                    newNote.dueDateFormatted = newDateData.dueDateFormatted;
                    notesToAdd.push(newNote);
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            notes.push(...notesToAdd);
            saveState();
            renderApp(); // Re-render if new notes were added
        }
    }

    function createNote() {
        const content = noteInput.value.trim();
        if (!content) return;

        const parsedData = parseNoteContent(content);

        const newNote = {
            id: noteIdCounter++,
            content: content,
            tags: autoTag(content),
            created: new Date().toISOString(),
            deleted: false,
            ...parsedData
        };
        notes.push(newNote);
        noteInput.value = '';
        saveState();
        renderApp();
    }
    
    function autoTag(content) {
        const tags = new Set();
        // New logic: Only add a tag if a word in the content matches an already existing tag.
        const allUniqueTags = getAllUniqueTags();
        allUniqueTags.forEach(existingTag => {
            // Use a case-insensitive regex to find the tag as a whole word/phrase in the content.
            // Escape special regex characters in the tag itself to prevent errors.
            const escapedTag = existingTag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedTag}\\b`, 'i');
            if (regex.test(content)) {
                tags.add(existingTag); // Add the original cased tag
            }
        });

        return Array.from(tags);
    }

    function toggleMic() {
        if (!recognition) return;
        if (micBtn.classList.contains('recording')) {
            recognition.stop();
            micBtn.classList.remove('recording');
        } else {
            recognition.start();
            micBtn.classList.add('recording');
        }
    }

    function handleTagFilterClick(tag) {
        if (activeTagFilters.has(tag)) {
            activeTagFilters.delete(tag);
        } else {
            activeTagFilters.add(tag);
        }
        renderApp();
    }

    // --- TAG AUTOCOMPLETE FUNCTIONS ---
    function showTagInput(noteId, targetElement) {
        if (tagInputModal.style.display === 'block' && currentNoteIdForTagging === noteId) {
            hideTagInput();
            return;
        }
        currentNoteIdForTagging = noteId;
        const rect = targetElement.getBoundingClientRect();
        tagInputModal.style.left = `${rect.left}px`;
        tagInputModal.style.top = `${rect.bottom + 5}px`;
        tagInputModal.style.display = 'block';
        tagInputField.value = '';
        tagSuggestionsList.innerHTML = '';
        tagInputField.focus();
    }

    function hideTagInput() {
        tagInputModal.style.display = 'none';
        currentNoteIdForTagging = null;
    }

    function handleTagInputTyping() {
        const inputValue = tagInputField.value.toLowerCase();
        tagSuggestionsList.innerHTML = '';
        if (!inputValue) return;

        const allTags = getAllUniqueTags();
        const filteredTags = allTags.filter(tag => tag.toLowerCase().includes(inputValue));
        
        filteredTags.slice(0, 10).forEach(tag => { // Limit to 10 suggestions
            const li = document.createElement('li');
            li.textContent = tag;
            tagSuggestionsList.appendChild(li);
        });
    }

    function handleTagInputKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTagToNote(currentNoteIdForTagging, tagInputField.value);
            hideTagInput();
        } else if (e.key === 'Escape') {
            hideTagInput();
        }
    }

    function handleTagSuggestionClick(e) {
        if (e.target.tagName === 'LI') {
            addTagToNote(currentNoteIdForTagging, e.target.textContent);
            hideTagInput();
        }
    }

    function handleSort(key) {
        sortConfig.direction = (sortConfig.key === key && sortConfig.direction === 'asc') ? 'desc' : 'asc';
        sortConfig.key = key;
        renderApp();
    }

    function handleTableClick(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        const noteId = parseInt(row.dataset.id);
        if (isNaN(noteId)) return;

        const isCurrencyTag = e.target.classList.contains('currency-tag');
        const isDateTag = e.target.classList.contains('date-tag');

        if (isCurrencyTag) {
            handleTagFilterClick(e.target.dataset.currency);
            return;
        }

        if (isDateTag) {
            handleTagFilterClick(e.target.dataset.date);
            return;
        }

        const isCheckbox = e.target.type === 'checkbox';
        if (isCheckbox) {
            e.target.checked ? selectedNoteIds.add(noteId) : selectedNoteIds.delete(noteId);
            updateSelectionUI();
            if (selectedNoteIds.size > 0) {
                e.stopPropagation(); // Prevent document click listener from closing it
                showContextMenu(e.clientX, e.clientY);
            } else {
                selectionContextMenu.style.display = 'none';
            }
        }
    }

    function handleTableKeyDown(e) {
        // Use Enter key to save changes in an editable cell
        if (e.key === 'Enter' && e.target.isContentEditable) {
            e.preventDefault(); // Prevent adding a new line in the cell
            e.target.blur();    // Trigger the 'focusout' event to save
        }
    }

    function handleTableFocusOut(e) {
        const cell = e.target;
        if (!cell.isContentEditable) return;
        
        const row = cell.closest('tr');
        const originalId = parseInt(row.dataset.id);
        const note = findNoteById(originalId);
        if (!note) return;

        const key = cell.dataset.key;
        const newValue = cell.textContent.trim();

        if (key === 'id' && note.id != newValue) {
            const newId = parseInt(newValue);
            if (isNaN(newId) || (newId !== originalId && findNoteById(newId))) {
                alert('Invalid ID. It must be a unique number.');
                cell.textContent = originalId; // Revert
                return;
            }
            if (selectedNoteIds.has(originalId)) {
                selectedNoteIds.delete(originalId);
                selectedNoteIds.add(newId);
            }
            note.id = newId;
            saveState();
            renderApp();
        } else if (key === 'content' && note.content !== newValue) {
            note.content = newValue;
            // Reparse all derived data and re-run auto-tagging
            Object.assign(note, parseNoteContent(newValue));
            note.tags = autoTag(newValue);
            saveState();
            renderApp();
        } else if (note[key] !== newValue) { // Fallback for other potential editable fields
            note[key] = newValue;
            saveState();
            renderFooter();
        }
    }
    
    function addTagToNote(noteId, tagText) {
        tagText = tagText.trim();
        if (!tagText || !noteId) return;

        const note = findNoteById(noteId);
        if (note) {
            if (!note.tags) note.tags = []; // Defensive coding
            if (!note.tags.includes(tagText)) {
                note.tags.push(tagText);
                saveState();
                renderApp();
            }
        }
    }

    function handleSelectAll(e) {
        e.stopPropagation(); // Prevent document click listener from closing the menu
        selectedNoteIds.clear();
        if (e.target.checked) {
            getNotesToDisplay().forEach(note => selectedNoteIds.add(note.id));
        }
        updateSelectionUI();

        if (selectedNoteIds.size > 0) {
            const rect = e.target.getBoundingClientRect();
            // Position the menu relative to the "select all" checkbox
            showContextMenu(rect.right, rect.bottom);
        } else {
            selectionContextMenu.style.display = 'none';
        }
    }

    function updateSelectionUI() {
        document.querySelectorAll('#notes-tbody tr').forEach(row => {
            const noteId = parseInt(row.dataset.id);
            if (!isNaN(noteId)) {
                const isSelected = selectedNoteIds.has(noteId);
                row.classList.toggle('selected', isSelected);
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = isSelected;
            }
        });
    }

    function showContextMenu(x, y) {
        const firstSelectedId = selectedNoteIds.values().next().value;
        const firstNote = findNoteById(firstSelectedId);
        if (!firstNote) return;

        const isDeleted = firstNote.deleted;
        markDeleteBtn.style.display = isDeleted ? 'none' : 'flex';
        recoverBtn.style.display = isDeleted ? 'flex' : 'none';
        deletePermanentlyBtn.style.display = 'flex';
        shareBtn.style.display = isDeleted ? 'none' : 'flex';

        const xOffset = 10; // Move 10px to the right
        const finalX = x + xOffset;

        selectionContextMenu.style.left = `${finalX > window.innerWidth - 200 ? window.innerWidth - 200 : finalX}px`;
        selectionContextMenu.style.top = `${y > window.innerHeight - 150 ? window.innerHeight - 150 : y}px`;
        selectionContextMenu.style.display = 'flex';
    }

    async function handleShare() {
        const notesToShare = notes.filter(note => selectedNoteIds.has(note.id));
        if (notesToShare.length === 0) return;
        const shareText = notesToShare.map(note => `Note #${note.id} (${new Date(note.created).toLocaleDateString()}):\n${note.content}\nTags: ${note.tags.join(', ')}`).join('\n\n---\n\n');
        
        if (navigator.share) {
            await navigator.share({ title: 'My Notes', text: shareText }).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareText);
            alert("Sharing not supported, content copied to clipboard.");
        }
        selectionContextMenu.style.display = 'none';
    }

    function showConfirmation(message, callback) {
        confirmationMessage.textContent = message;
        confirmCallback = callback;
        confirmationModal.style.display = 'flex';
    }

    function handleDeleteOrRecoverSelected(isDeleting) {
        selectedNoteIds.forEach(id => {
            const note = findNoteById(id);
            if (note) note.deleted = isDeleting;
        });
        clearSelectionAndRender();
    }

    function handleDeletePermanently() {
        showConfirmation(`Permanently delete ${selectedNoteIds.size} note(s)? This cannot be undone.`, () => {
            notes = notes.filter(note => !selectedNoteIds.has(note.id));
            clearSelectionAndRender();
        });
    }

    function clearSelectionAndRender() {
        selectedNoteIds.clear();
        selectionContextMenu.style.display = 'none';
        saveState();
        renderApp();
    }

    function downloadFile(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }
    
    function generateExportFilename(extension) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const datePart = `${year}${month}${day}`;

        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        const filterParts = [];

        // Add all active filters, sorting them and formatting dates
        if (activeTagFilters.size > 0) {
            const sortedFilters = [...activeTagFilters].sort((a, b) => a.localeCompare(b));
            sortedFilters.forEach(tag => {
                if (dateRegex.test(tag)) {
                    filterParts.push(tag.replace(/\//g, '')); // Format date as DDMMYYYY
                } else {
                    filterParts.push(tag);
                }
            });
        }

        if (filterParts.length > 0) {
            const filterString = filterParts.join('_'); // Already sorted
            return `MyNotes-${datePart}-${filterString}.${extension}`;
        } else {
            return `MyNotes-${datePart}.${extension}`;
        }
    }

    function handleExportJSON() {
        const notesToExport = getNotesToDisplay();
        const fileName = generateExportFilename('json');
        downloadFile(JSON.stringify(notesToExport, null, 2), fileName, 'application/json');
    }
    
    function handleExportCSV() {
        const notesToExport = getNotesToDisplay();
        const fileName = generateExportFilename('csv');

        const csvRows = ["ID,Content,Tags,Created,Deleted"];
        notesToExport.forEach(note => {
            const content = `"${(note.content || '').replace(/"/g, '""')}"`;
            const tags = `"${(note.tags || []).join(';')}"`;
            const row = [note.id, content, tags, note.created, note.deleted].join(",");
            csvRows.push(row);
        });
        const csvContent = csvRows.join("\r\n");
        downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
    }
    
    function handleImportJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedNotes = JSON.parse(e.target.result);
                if (!Array.isArray(importedNotes)) throw new Error("Invalid JSON format");

                const choice = prompt('Import notes? Type "MERGE" to add to existing, or "REPLACE" to overwrite.').toUpperCase();
                if (choice === 'REPLACE') {
                    notes = importedNotes.map(n => {
                        const parsedData = parseNoteContent(n.content || '');
                        return { ...n, ...parsedData };
                    });
                } else if (choice === 'MERGE') {
                    const existingIds = new Set(notes.map(n => n.id));
                    let maxId = noteIdCounter;
                    importedNotes.forEach(impNote => {
                        const parsedData = parseNoteContent(impNote.content || '');
                        const finalNote = { ...impNote, ...parsedData };
                        while (existingIds.has(impNote.id)) {
                            finalNote.id = maxId++;
                        }
                        notes.push(finalNote);
                        existingIds.add(finalNote.id);
                    });
                } else {
                    alert("Import cancelled.");
                    return;
                }
                noteIdCounter = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
                saveState();
                renderApp();
            } catch (error) {
                alert("Error importing file: " + error.message);
            } finally {
                importFileInput.value = ''; // Reset for next import
            }
        };
        reader.readAsText(file);
    }
    
    function handleRenumber() {
        showConfirmation("Renumbering will re-assign IDs to all currently visible notes, starting from 1. This can affect links or external references. Continue?", () => {
            const visibleNotes = getNotesToDisplay();
            const visibleIds = new Set(visibleNotes.map(n => n.id));
            const hiddenNotes = notes.filter(n => !visibleIds.has(n.id));

            let newIdCounter = 1;
            visibleNotes.forEach(note => {
                note.id = newIdCounter++;
            });

            hiddenNotes.forEach(note => {
                note.id = newIdCounter++;
            });
            
            notes = [...visibleNotes, ...hiddenNotes];
            noteIdCounter = newIdCounter;
            clearSelectionAndRender();
        });
    }
});
