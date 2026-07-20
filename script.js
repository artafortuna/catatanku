// --- SETUP MULTI-HALAMAN & ROUTING NATIVE (HISTORY API) ---
const pages = {
    home: document.getElementById('pageHome'),
    form: document.getElementById('pageForm'),
    detail: document.getElementById('pageDetail')
};

// Parameter pushToHistory mencegah loop saat tombol 'back' HP ditekan
function showPage(pageName, pushToHistory = true) {
    Object.values(pages).forEach(page => page.style.display = 'none');
    pages[pageName].style.display = 'block';
    window.scrollTo(0, 0);
    
    // Tampilkan search bar hanya di home
    document.getElementById('searchInput').style.display = (pageName === 'home') ? 'block' : 'none';

    // Integrasi native routing (History API)
    if (pushToHistory) {
        const currentState = history.state?.page;
        if (currentState !== pageName) {
            history.pushState({ page: pageName }, '', `#${pageName}`);
        }
    }
}

// Menangkap event tombol "Back/Kembali" dari sistem operasi (Android/iOS) atau Browser
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
        showPage(event.state.page, false);
    } else {
        // Fallback default ke home jika tidak ada riwayat yang terbaca
        showPage('home', false);
    }
});


// --- CUSTOM DIALOG (PENGGANTI ALERT & CONFIRM BAWAAN) ---
function showDialog(message, isConfirm = false) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customDialog');
        const msgEl = document.getElementById('dialogMessage');
        const btnCancel = document.getElementById('btnDialogCancel');
        const btnOk = document.getElementById('btnDialogOk');

        msgEl.innerText = message;
        overlay.style.display = 'flex';
        
        btnCancel.style.display = isConfirm ? 'inline-block' : 'none';

        btnOk.onclick = () => {
            overlay.style.display = 'none';
            resolve(true); 
        };

        btnCancel.onclick = () => {
            overlay.style.display = 'none';
            resolve(false); 
        };
    });
}

// --- INDEXED DB SETUP ---
const dbName = "ArtaNotesCartoonDB"; 
let db;
let notesArray = []; 
let currentViewedNote = null; // Menyimpan data catatan yang sedang dibaca

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains("notes")) {
                db.createObjectStore("notes", { keyPath: "id" });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => reject("Error opening DB: " + event.target.errorCode);
    });
}

async function loadNotes() {
    return new Promise((resolve) => {
        const transaction = db.transaction(["notes"], "readonly");
        const store = transaction.objectStore("notes");
        const request = store.getAll();
        
        request.onsuccess = () => {
            notesArray = request.result;
            renderNotes();
            resolve();
        };
    });
}

function saveNoteToDB(note) {
    return new Promise((resolve) => {
        const transaction = db.transaction(["notes"], "readwrite");
        const store = transaction.objectStore("notes");
        store.put(note);
        transaction.oncomplete = () => resolve();
    });
}

function deleteNoteFromDB(id) {
    return new Promise((resolve) => {
        const transaction = db.transaction(["notes"], "readwrite");
        const store = transaction.objectStore("notes");
        store.delete(id);
        transaction.oncomplete = () => resolve();
    });
}

// --- INISIALISASI SAAT HALAMAN DIMUAT ---
window.onload = async () => {
    applySavedTheme();
    await initDB();
    await loadNotes();
    
    // Set awal routing (Home) agar fungsi back tidak langsung keluar web
    history.replaceState({ page: 'home' }, '', '#home');
    showPage('home', false);
};

// --- MANAJEMEN TEMA ---
function toggleTheme() {
    const htmlTag = document.documentElement;
    const newTheme = htmlTag.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    htmlTag.setAttribute('data-theme', newTheme);
    localStorage.setItem('arta_ocean_theme', newTheme);
    updateThemeIcon(newTheme);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('arta_ocean_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    document.getElementById('moonIcon').style.display = theme === 'dark' ? 'none' : 'block';
    document.getElementById('sunIcon').style.display = theme === 'dark' ? 'block' : 'none';
}

// --- RENDER CATATAN (BERANDA) ---
function renderNotes(filterText = '') {
    const container = document.getElementById('notesContainer');
    container.innerHTML = '';
    
    const filteredNotes = notesArray.filter(note => 
        note.title.toLowerCase().includes(filterText.toLowerCase()) || 
        note.category.toLowerCase().includes(filterText.toLowerCase())
    );

    if(filteredNotes.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: var(--surface-color); border: 1px dashed var(--accent-color); border-radius: var(--radius); box-shadow: 0 0 8px var(--glow-color); backdrop-filter: blur(5px);"><h3>Belum ada catatan di pinggir pantai ini! 🌊</h3></div>';
        return;
    }

    [...filteredNotes].reverse().forEach(note => {
        const isChecklist = note.type === 'checklist';
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `
            <span class="note-category">${note.category} ${isChecklist ? '☑️' : '📄'}</span>
            <h3 class="note-title">${note.title}</h3>
            <div class="note-actions">
                <button class="btn btn-primary glow-effect" onclick="viewDetail(${note.id})">Baca</button>
                <button class="btn btn-secondary glow-effect" onclick="editNote(${note.id})">Edit</button>
                <button class="btn btn-danger glow-effect" onclick="deleteNote(${note.id})">Hapus</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- FITUR FORM & GAMBAR ---
function openForm() {
    resetForm();
    showPage('form');
}

function resetForm() {
    document.getElementById('noteForm').reset();
    document.getElementById('noteId').value = '';
    document.getElementById('existingImage').value = '';
    document.getElementById('noteType').value = 'text';
    document.getElementById('checklistItemsContainer').innerHTML = '';
    toggleNoteTypeInput();
    removeImage(); 
    document.getElementById('formTitle').innerText = 'Buat Catatan Baru';
    document.getElementById('submitBtn').innerText = 'Simpan Catatan';
}

function toggleNoteTypeInput() {
    const type = document.getElementById('noteType').value;
    const textGroup = document.getElementById('textContentFormGroup');
    const checklistGroup = document.getElementById('checklistFormGroup');
    
    if (type === 'checklist') {
        textGroup.style.display = 'none';
        document.getElementById('content').removeAttribute('required');
        checklistGroup.style.display = 'block';
    } else {
        textGroup.style.display = 'block';
        document.getElementById('content').setAttribute('required', 'true');
        checklistGroup.style.display = 'none';
    }
}

function addChecklistItemRow(text = '', checked = false) {
    const container = document.getElementById('checklistItemsContainer');
    const row = document.createElement('div');
    row.className = 'checklist-form-row';
    row.style.display = 'flex';
    row.style.gap = '0.4rem';
    row.style.alignItems = 'center';
    
    row.innerHTML = `
        <input type="checkbox" class="chk-status" ${checked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-color);">
        <input type="text" class="chk-text glow-input" value="${text}" placeholder="Tulis kegiatan di sini..." required style="flex: 1; padding: 0.4rem 0.6rem; font-size: 0.85rem;">
        <button type="button" class="btn btn-danger glow-effect" onclick="this.parentElement.remove()" style="padding: 0.3rem 0.6rem; box-shadow: none;">🗑️</button>
    `;
    container.appendChild(row);
}

function triggerAddChecklist() {
    const input = document.getElementById('newChecklistItem');
    if (input.value.trim() !== '') {
        addChecklistItemRow(input.value.trim(), false);
        input.value = '';
    }
}

function handleChecklistEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        triggerAddChecklist();
    }
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreviewBox').style.display = 'block';
            document.getElementById('existingImage').value = ''; 
        }
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    document.getElementById('image').value = ''; 
    document.getElementById('existingImage').value = ''; 
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreviewBox').style.display = 'none';
}

// --- SIMPAN CATATAN KE DB ---
document.getElementById('noteForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const idInput = document.getElementById('noteId').value;
    const title = document.getElementById('title').value;
    const category = document.getElementById('category').value;
    const noteType = document.getElementById('noteType').value;
    const content = document.getElementById('content').value;
    const imageFile = document.getElementById('image').files[0];
    const existingImage = document.getElementById('existingImage').value;

    let finalContent = content;
    if (noteType === 'checklist') {
        const rows = document.querySelectorAll('.checklist-form-row');
        const items = [];
        rows.forEach(row => {
            const text = row.querySelector('.chk-text').value;
            const checked = row.querySelector('.chk-status').checked;
            items.push({ text, checked });
        });
        
        if(items.length === 0) {
            await showDialog('Daftar checklist tidak boleh kosong!', false);
            return;
        }
        finalContent = items;
    }

    const proceedSave = async (imgBase64) => {
        const noteData = {
            id: idInput ? parseInt(idInput) : Date.now(),
            title,
            category,
            type: noteType,
            content: finalContent,
            date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            image: imgBase64
        };

        await saveNoteToDB(noteData);
        await loadNotes(); 
        history.back(); // Kembali secara native setelah save
        await showDialog('Catatan berhasil disimpan! 🌊', false);
    };

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
            proceedSave(event.target.result);
        };
        reader.readAsDataURL(imageFile);
    } else {
        proceedSave(existingImage || null);
    }
});

// --- HALAMAN DETAIL & FITUR COPY ---
function viewDetail(id) {
    const note = notesArray.find(n => n.id === id);
    if (!note) return;
    
    currentViewedNote = note; // Disimpan global untuk fitur Copy

    document.getElementById('viewCategory').innerText = note.category;
    document.getElementById('viewTitle').innerText = note.title;
    document.getElementById('viewDate').innerText = 'Dibuat pada: ' + note.date;

    const viewContentEl = document.getElementById('viewContent');
    viewContentEl.innerHTML = '';

    if (note.type === 'checklist' && Array.isArray(note.content)) {
        note.content.forEach((item) => {
            const itemDiv = document.createElement('div');
            itemDiv.style.display = 'flex';
            itemDiv.style.alignItems = 'center';
            itemDiv.style.gap = '0.5rem';
            itemDiv.style.marginBottom = '0.4rem';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.checked;
            checkbox.style.width = '18px';
            checkbox.style.height = '18px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.accentColor = 'var(--accent-color)';
            
            const label = document.createElement('span');
            label.innerText = item.text;
            label.style.fontSize = '0.95rem';
            
            if (item.checked) {
                label.style.textDecoration = 'line-through';
                label.style.color = 'var(--text-secondary)';
            }

            checkbox.onchange = async () => {
                item.checked = checkbox.checked;
                if (checkbox.checked) {
                    label.style.textDecoration = 'line-through';
                    label.style.color = 'var(--text-secondary)';
                } else {
                    label.style.textDecoration = 'none';
                    label.style.color = 'var(--text-primary)';
                }
                await saveNoteToDB(note); 
            };

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            viewContentEl.appendChild(itemDiv);
        });
    } else {
        const p = document.createElement('p');
        p.innerText = note.content;
        p.style.whiteSpace = 'pre-wrap';
        viewContentEl.appendChild(p);
    }

    const viewImg = document.getElementById('viewImage');
    if(note.image) {
        viewImg.src = note.image;
        viewImg.style.display = 'block';
    } else {
        viewImg.src = '';
        viewImg.style.display = 'none';
    }

    showPage('detail');
}

// Fungsi Menyalin Catatan secara Elegan
async function copyNote() {
    if (!currentViewedNote) return;

    let textToCopy = `${currentViewedNote.title}\nKategori: ${currentViewedNote.category}\n---\n`;

    if (currentViewedNote.type === 'checklist' && Array.isArray(currentViewedNote.content)) {
        currentViewedNote.content.forEach(item => {
            textToCopy += `${item.checked ? '[v]' : '[ ]'} ${item.text}\n`;
        });
    } else {
        textToCopy += currentViewedNote.content;
    }

    try {
        await navigator.clipboard.writeText(textToCopy);
        await showDialog('Catatan berhasil disalin! 📋', false);
    } catch (err) {
        await showDialog('Oops, gagal menyalin catatan.', false);
    }
}

// --- EDIT CATATAN ---
function editNote(id) {
    const note = notesArray.find(n => n.id === id);
    if (!note) return;

    resetForm();

    document.getElementById('noteId').value = note.id;
    document.getElementById('title').value = note.title;
    document.getElementById('category').value = note.category;
    
    const noteType = note.type || 'text';
    document.getElementById('noteType').value = noteType;
    toggleNoteTypeInput();

    if (noteType === 'checklist' && Array.isArray(note.content)) {
        note.content.forEach(item => {
            addChecklistItemRow(item.text, item.checked);
        });
    } else {
        document.getElementById('content').value = note.content;
    }
    
    if(note.image) {
        document.getElementById('existingImage').value = note.image;
        document.getElementById('imagePreview').src = note.image;
        document.getElementById('imagePreviewBox').style.display = 'block';
    } else {
        removeImage();
    }
    
    document.getElementById('formTitle').innerText = 'Edit Catatan';
    document.getElementById('submitBtn').innerText = 'Update Catatan';
    
    showPage('form');
}

// --- HAPUS CATATAN ---
async function deleteNote(id) {
    const isConfirmed = await showDialog('Yakin ingin menghapus catatan ini? 🌊', true);
    if(isConfirmed) {
        await deleteNoteFromDB(id);
        await loadNotes();
    }
}

// --- PENCARIAN ---
function searchNotes() {
    const searchText = document.getElementById('searchInput').value;
    renderNotes(searchText);
}

// --- MODAL GAMBAR FULLSCREEN ---
const imgModal = document.getElementById('imageModal');
const modalImgFull = document.getElementById('fullImage');

function openImageModal(imgSrc) {
    imgModal.classList.add('active');
    modalImgFull.src = imgSrc;
}

function closeImageModal(event) {
    if(event.target.id === 'imageModal' || event.target.className === 'image-modal-close') {
        imgModal.classList.remove('active');
        setTimeout(() => { modalImgFull.src = ''; }, 200);
    }
}
