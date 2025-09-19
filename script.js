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


    // --- STATE MANAGEMENT ---
    let notes = [];
    let noteIdCounter = 1;
    let selectedNoteIds = new Set();
    let sortConfig = { key: 'created', direction: 'desc' };
    let activeTagFilter = null;
    let searchTerm = '';
    let showDeleted = false;
    let confirmCallback = null;
    let columnConfig = {
        order: ['selection', 'id', 'content', 'tags', 'created'],
        visible: { selection: true, id: true, content: true, tags: true, created: true },
        widths: {}
    };
    const columnLabels = {
        selection: '', id: 'ID', content: 'Note Content', tags: 'Tags', created: 'Date Created'
    };
    const speechLanguages = [
        { name: 'English (US)', code: 'en-US' }, { name: 'Español (MX)', code: 'es-MX' },
        { name: 'Français (FR)', code: 'fr-FR' }, { name: 'Deutsch (DE)', code: 'de-DE' },
        { name: 'Italiano (IT)', code: 'it-IT' }, { name: '日本語 (JP)', code: 'ja-JP' }
    ];

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

    // --- DATA & STATE FUNCTIONS ---
    function loadState() {
        notes = JSON.parse(localStorage.getItem('notes-app-notes') || '[]');
        noteIdCounter = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
        const theme = localStorage.getItem('notes-app-theme');
        if (theme) document.documentElement.setAttribute('data-theme', theme);
        userLogo.src = localStorage.getItem('notes-app-logo') || userLogo.src;
        userName.value = localStorage.getItem('notes-app-name') || userName.value;
        const storedColumns = localStorage.getItem('notes-app-columns');
        if (storedColumns) columnConfig = JSON.parse(storedColumns);
    }

    function saveState() {
        localStorage.setItem('notes-app-notes', JSON.stringify(notes));
        localStorage.setItem('notes-app-columns', JSON.stringify(columnConfig));
    }

    function findNoteById(id) {
        return notes.find(note => note.id === id);
    }

    // --- RENDER FUNCTIONS ---
    function renderApp() {
        renderHeader();
        renderTable();
        renderFooter();
        renderColumnModal();
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
                checkbox.addEventListener('change', handleSelectAll);
                th.appendChild(checkbox);
            } else {
                th.textContent = columnLabels[key];
                th.classList.add('sortable');
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
        let filteredNotes = notes.filter(note => {
            if (!showDeleted && note.deleted) return false;
            const matchesTag = activeTagFilter ? note.tags.includes(activeTagFilter) : true;
            const matchesSearch = searchTerm ? note.content.toLowerCase().includes(searchTerm.toLowerCase()) || String(note.id).includes(searchTerm) : true;
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
                }
                row.appendChild(td);
            });
            notesTbody.appendChild(row);
        });
    }
    
    function renderTagsCell(td, tags, noteId) {
        td.innerHTML = ''; 
        td.classList.add('tags-cell');
        tags.forEach(tagText => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = tagText;
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-tag';
            deleteBtn.textContent = 'x';
            deleteBtn.onclick = () => {
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
        addTagBtn.onclick = () => {
            const newTag = prompt('Add new tag:');
            if (newTag && newTag.trim() !== '') {
                const note = findNoteById(noteId);
                if (!note.tags.includes(newTag.trim())) {
                    note.tags.push(newTag.trim());
                    saveState();
                    renderApp();
                }
            }
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
                note.tags.forEach(tag => { acc[tag] = (acc[tag] || 0) + 1; });
            }
            return acc;
        }, {});
        const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
        
        sortedTags.forEach(([tag, count]) => {
            const button = document.createElement('button');
            button.className = 'tag-filter';
            button.textContent = `${tag} (${count})`;
            if (tag === activeTagFilter) button.classList.add('active');
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

        tableHeader.addEventListener('mouseup', () => {
            tableHeader.querySelectorAll('th').forEach(th => {
                const key = th.dataset.key;
                if (key && th.style.width) columnConfig.widths[key] = th.style.width;
            });
            saveState();
        });
        
        notesTbody.addEventListener('click', handleTableClick);
        notesTbody.addEventListener('focusout', handleTableFocusOut);

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
    }
    
    function createNote() {
        const content = noteInput.value.trim();
        if (!content) return;
        const newNote = {
            id: noteIdCounter++,
            content: content,
            tags: autoTag(content),
            created: new Date().toISOString(),
            deleted: false
        };
        notes.push(newNote);
        noteInput.value = '';
        saveState();
        renderApp();
    }
    
    function autoTag(content) {
        const tags = new Set();
        (content.match(/#\w+/g) || []).forEach(tag => tags.add(tag.substring(1)));
        (content.match(/\b[A-Z][a-z]{2,}\b/g) || []).forEach(word => {
            if (!["The", "A", "An"].includes(word)) tags.add(word);
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
        activeTagFilter = (activeTagFilter === tag) ? null : tag;
        renderApp();
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

        const isCheckbox = e.target.type === 'checkbox';
        if (isCheckbox) {
            e.target.checked ? selectedNoteIds.add(noteId) : selectedNoteIds.delete(noteId);
        } else if (!e.target.isContentEditable && !e.target.closest('.tags-cell')) {
            if (e.ctrlKey || e.metaKey) {
                selectedNoteIds.has(noteId) ? selectedNoteIds.delete(noteId) : selectedNoteIds.add(noteId);
            } else {
                selectedNoteIds.clear();
                selectedNoteIds.add(noteId);
            }
        }
        updateSelectionUI();
        if (selectedNoteIds.size > 0 && !e.target.isContentEditable) {
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY);
        } else {
            selectionContextMenu.style.display = 'none';
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

        if (key === 'id') {
            const newId = parseInt(newValue);
            if (isNaN(newId) || (newId !== originalId && findNoteById(newId))) {
                alert('Invalid ID. It must be a unique number.');
                cell.textContent = originalId; // Revert
                return;
            }
            if(newId !== originalId) {
                if(selectedNoteIds.has(originalId)) {
                    selectedNoteIds.delete(originalId);
                    selectedNoteIds.add(newId);
                }
                note.id = newId;
                row.dataset.id = newId;
            }
        } else if (note[key] !== newValue) {
            note[key] = newValue;
        }

        saveState();
        renderFooter(); // Tags might have changed
    }
    
    function handleSelectAll(e) {
        selectedNoteIds.clear();
        if (e.target.checked) {
            getNotesToDisplay().forEach(note => selectedNoteIds.add(note.id));
        }
        updateSelectionUI();
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

        selectionContextMenu.style.left = `${x > window.innerWidth - 200 ? window.innerWidth - 200 : x}px`;
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
    
    function handleExportJSON() {
        downloadFile(JSON.stringify(notes, null, 2), 'notes.json', 'application/json');
    }
    
    function handleExportCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Content,Tags,Created,Deleted\n";
        notes.forEach(note => {
            const content = `"${note.content.replace(/"/g, '""')}"`;
            const tags = `"${note.tags.join(';')}"`;
            const row = [note.id, content, tags, note.created, note.deleted].join(",");
            csvContent += row + "\r\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "notes.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                    notes = importedNotes;
                } else if (choice === 'MERGE') {
                    const existingIds = new Set(notes.map(n => n.id));
                    let maxId = noteIdCounter;
                    importedNotes.forEach(impNote => {
                        while (existingIds.has(impNote.id)) {
                            impNote.id = maxId++;
                        }
                        notes.push(impNote);
                        existingIds.add(impNote.id);
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
