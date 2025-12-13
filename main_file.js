  // IndexedDB helper - small promise wrapper
  (function(){
    const DB_NAME = 'indra_files_db';
    const STORE = 'files';

    function openDB(){
      return new Promise((resolve, reject) => {
        const rq = indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = e => {
          const db = e.target.result;
          if(!db.objectStoreNames.contains(STORE)){
            const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            os.createIndex('byName', 'name', { unique: false });
          }
        };
        rq.onsuccess = e => resolve(e.target.result);
        rq.onerror = e => reject(e.target.error);
      });
    }

    async function addFileEntry(file){
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const entry = { name: file.name, type: file.type, size: file.size, added: Date.now(), blob: file };
        const rq = store.add(entry);
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      });
    }

    async function listAllFiles(){
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const rq = store.getAll();
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      });
    }

    async function getFileById(id){
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const rq = store.get(Number(id));
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      });
    }

    async function deleteFileById(id){
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const rq = store.delete(Number(id));
        rq.onsuccess = () => res();
        rq.onerror = () => rej(rq.error);
      });
    }

    async function clearAll(){
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const rq = store.clear();
        rq.onsuccess = () => res();
        rq.onerror = () => rej(rq.error);
      });
    }

    /* ---------- UI wiring ---------- */
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileList = document.getElementById('fileList');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    function humanSize(n){
      if(n<1024) return n + ' B';
      if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
      if(n<1024*1024*1024) return (n/(1024*1024)).toFixed(1)+' MB';
      return (n/(1024*1024*1024)).toFixed(1)+' GB';
    }

    function createFileRow(item){
      const row = document.createElement('div');
      row.className = 'file-row';
      // meta
      const meta = document.createElement('div');
      meta.className = 'file-meta';
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = item.name;
      const info = document.createElement('div');
      info.className = 'file-info';
      const dt = new Date(item.added);
      info.textContent = `${humanSize(item.size)} • ${dt.toLocaleString()}`;
      meta.appendChild(name);
      meta.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'file-actions';

      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-ghost';
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', async () => {
        const rec = await getFileById(item.id);
        if(!rec || !rec.blob) { alert('File data missing'); return; }
        // blob -> download
        const blob = rec.blob;
        // create temporary object URL
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = rec.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 5000);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.style.background = 'linear-gradient(90deg,#ff5555,#ff7777)';
      delBtn.style.color = '#111';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if(!confirm('Delete file "'+item.name+'"?')) return;
        await deleteFileById(item.id);
        renderList();
      });

      actions.appendChild(dlBtn);
      actions.appendChild(delBtn);

      row.appendChild(meta);
      row.appendChild(actions);
      return row;
    }

    async function renderList(){
      fileList.innerHTML = '';
      const all = await listAllFiles();
      if(!all.length){
        const note = document.createElement('div');
        note.className = 'empty-note';
        note.textContent = 'No files stored. Upload using the control above.';
        fileList.appendChild(note);
        return;
      }
      // sort newest first
      all.sort((a,b)=>b.added - a.added);
      for(const item of all){
        fileList.appendChild(createFileRow(item));
      }
    }

    uploadBtn.addEventListener('click', async () => {
      const files = fileInput.files;
      if(!files || !files.length){ alert('Select at least one file'); return; }
      // iterate and store; show basic progress note
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
      try{
        for(let i=0;i<files.length;i++){
          const f = files[i];
          // NOTE: store the File object (Blob) directly in IndexedDB — supported in modern browsers
          await addFileEntry(f);
        }
        fileInput.value = '';
        await renderList();
      } catch(err){
        console.error(err);
        alert('Upload failed: ' + (err.message || err));
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload';
      }
    });

    refreshBtn.addEventListener('click', renderList);
    clearAllBtn.addEventListener('click', async () => {
      if(!confirm('Clear ALL stored files? This cannot be undone.')) return;
      await clearAll();
      renderList();
    });

    // initial render
    renderList();

    // expose for console debugging if needed
    window._indra_files = { addFileEntry, listAllFiles, getFileById, deleteFileById, clearAll };

  })();
