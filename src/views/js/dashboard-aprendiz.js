import { API } from '../public/js/api.js'; //

// 🚀 VARIABLE GLOBAL CRÍTICA: Almacena los bytes del archivo para PC y Celulares
let archivoEnMemoria = null;

// Captura de elementos del DOM
const dropZone = document.getElementById('drop-zone'); //
const fileInput = document.getElementById('file-input'); //
const dropZoneContent = document.getElementById('drop-zone-content'); //
const filePreview = document.getElementById('file-preview'); //
const selectedFileName = document.getElementById('selected-file-name'); //
const changeFileBtn = document.getElementById('change-file-btn'); //
const submitBtn = document.getElementById('submit-upload-btn'); //

async function inicializarDashboard() { //
    try {
        const data = await API.request('/apprentice/dashboard'); //
        
        // Renderizar estados de la solicitud general
        const estadoBadge = document.getElementById('estado-postulacion'); //
        estadoBadge.innerText = data.solicitud.estado; //
        estadoBadge.className = `status-badge status-${data.solicitud.estado}`; //
        document.getElementById('obs-generales').innerText = data.solicitud.observaciones_generales || 'Sin observaciones.'; //
        document.getElementById('solicitud-id').value = data.solicitud.id; //

        // Renderizar tabla de documentos
        const tbody = document.querySelector('#tabla-docs tbody'); //
        tbody.innerHTML = ''; //
        
        data.documentos.forEach(doc => { //
            const tr = document.createElement('tr'); //
            const obsTexto = doc.observacion_especifica || 'Sin observaciones pendientes.'; //
            const evaluadorTexto = doc.evaluado_por ? `<br><small style="color:var(--electric-blue)"><b>Revisado por:</b> ${doc.evaluado_por}</small>` : ''; //
            
            // Renderizar botón de visualización con la URL firmada generada por el backend
            const botonVer = doc.url_visualizacion 
                ? `<a href="${doc.url_visualizacion}" target="_blank" class="btn btn-secondary" style="font-size:0.8rem; padding:0.4rem 0.8rem; text-decoration:none; display:inline-block;">👁️ Ver PDF</a>`
                : `<span style="color:grey; font-size:0.85rem;">No disponible</span>`;

            tr.innerHTML = `
                <td><strong>${doc.nombre_tipo}</strong></td>
                <td><span class="status-badge status-${doc.estado}">${doc.estado}</span></td>
                <td>${obsTexto} ${evaluadorTexto}</td>
                <td>${new Date(doc.actualizado_at).toLocaleString()}</td>
                <td style="text-align:center;">${botonVer}</td>
            `;
            tbody.appendChild(tr); //
        });

        // Cargar Notificaciones
        const notifRes = await API.request('/apprentice/notifications'); //
        const notifDiv = document.getElementById('lista-notificaciones'); //
        notifDiv.innerHTML = notifRes.length === 0 ? '<p>No tienes alertas nuevas.</p>' : ''; //
        notifRes.slice(0, 3).forEach(n => { //
            notifDiv.innerHTML += `<p><strong>[${new Date(n.creado_at).toLocaleDateString()}] ${n.titulo}:</strong> ${n.mensaje}</p>`; //
        });

    } catch (err) {
        console.error("Fallo al inicializar datos:", err); //
    }
}

// 1. Hacer que la zona de arrastre abra el explorador de archivos al hacerle clic
dropZone.addEventListener('click', (e) => { //
    if (e.target !== changeFileBtn) { //
        fileInput.click(); //
    }
});

// 2. Eventos visuales cuando el archivo está "volando" sobre la zona de arrastre
['dragenter', 'dragover'].forEach(eventName => { //
    dropZone.addEventListener(eventName, (e) => { //
        e.preventDefault(); //
        e.stopPropagation(); //
        dropZone.style.backgroundColor = '#E3F2FD'; //
        dropZone.style.border = '2px dashed var(--sena-green)'; //
    }, false);
});

['dragleave', 'drop'].forEach(eventName => { //
    dropZone.addEventListener(eventName, (e) => { //
        e.preventDefault(); //
        e.stopPropagation(); //
        if (eventName === 'dragleave') { //
            dropZone.style.backgroundColor = '#F0F8FF'; //
            dropZone.style.border = '2px dashed var(--electric-blue)'; //
        }
    }, false);
});

// 3. Capturar el archivo cuando se SUELTA (Drop) en el cuadro (PC y Celular)
dropZone.addEventListener('drop', (e) => { //
    const dt = e.dataTransfer; //
    const files = dt.files; //

    if (files.length > 0 && files[0].type === "application/pdf") {
        archivoEnMemoria = files[0]; // Guardamos los bytes en la variable global
        mostrarVistaPrevia(files[0].name);
    } else {
        alert("Por favor, asegúrate de arrastrar únicamente un archivo válido en formato PDF."); //
        resetearZonaCarga(); //
    }
});

// 4. Capturar el archivo si usan el EXPLORADOR tradicional (Click)
fileInput.addEventListener('change', () => { //
    if (fileInput.files.length > 0) {
        archivoEnMemoria = fileInput.files[0]; // Guardamos los bytes en la variable global
        mostrarVistaPrevia(fileInput.files[0].name);
    }
});

// Funciones auxiliares de cambio de interfaz visual en tiempo real
function mostrarVistaPrevia(nombreArchivo) { //
    dropZoneContent.style.display = 'none'; //
    filePreview.style.display = 'block'; //
    selectedFileName.innerText = nombreArchivo; //
    submitBtn.style.display = 'block'; //
    dropZone.style.backgroundColor = '#E8F5E9'; //
    dropZone.style.border = '2px solid var(--sena-green)'; //
}

function resetearZonaCarga() { //
    fileInput.value = ""; //
    archivoEnMemoria = null; // Reseteamos la variable global
    dropZoneContent.style.display = 'block'; //
    filePreview.style.display = 'none'; //
    submitBtn.style.display = 'none'; //
    dropZone.style.backgroundColor = '#F0F8FF'; //
    dropZone.style.border = '2px dashed var(--electric-blue)'; //
}

// Botón para quitar el archivo seleccionado y volver a empezar
changeFileBtn.addEventListener('click', (e) => { //
    e.preventDefault(); //
    e.stopPropagation(); //
    resetearZonaCarga(); //
});

// 5. Envío transaccional del formulario (Submit)
document.getElementById('upload-form').addEventListener('submit', async (e) => { //
    e.preventDefault(); //
    const solicitudId = document.getElementById('solicitud-id').value; //
    const tipoDocumento = document.getElementById('tipo-doc').value; //

    // Leemos directamente de la variable global de control
    const file = archivoEnMemoria;

    if (!file) {
        alert("Debes seleccionar o arrastrar un archivo antes de enviarlo."); //
        return;
    }

    const formData = new FormData(); //
    formData.append('solicitudId', solicitudId); //
    formData.append('tipoDocumento', tipoDocumento); //
    formData.append('archivo', file); //

    // Animación visual de carga
    submitBtn.innerText = "⏳ Subiendo archivo de manera segura a Supabase..."; //
    submitBtn.disabled = true; //

    try {
        const res = await API.request('/apprentice/document/upload', { //
            method: 'POST', //
            body: formData //
        });

        alert(res.message || res.error); //
    } catch (err) {
        alert("❌ Error crítico: Fallo de comunicación con el servidor.");
    } finally {
        submitBtn.innerText = "🚀 Subir / Reemplazar Documento Seleccionado"; //
        submitBtn.disabled = false; //
        
        resetearZonaCarga(); //
        inicializarDashboard(); //
    }
});

document.getElementById('logout-btn').addEventListener('click', () => { //
    API.clear(); //
    window.location.href = '/index.html'; //
});

window.onload = inicializarDashboard; //
