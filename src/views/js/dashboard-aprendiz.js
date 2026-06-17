import { API } from '../public/js/api.js';

async function inicializarDashboard() {
    try {
        const data = await API.request('/apprentice/dashboard');
        
        // Renderizar estados de la solicitud general
        const estadoBadge = document.getElementById('estado-postulacion');
        estadoBadge.innerText = data.solicitud.estado;
        estadoBadge.className = `status-badge status-${data.solicitud.estado}`;
        document.getElementById('obs-generales').innerText = data.solicitud.observaciones_generales || 'Sin observaciones.';
        document.getElementById('solicitud-id').value = data.solicitud.id;

        // Renderizar tabla de documentos
        const tbody = document.querySelector('#tabla-docs tbody');
        tbody.innerHTML = '';
        data.documentos.forEach(doc => {
            const tr = document.createElement('tr');
            // Dentro del forEach de documentos del Aprendiz:
            const obsTexto = doc.observacion_especifica || 'Sin observaciones pendientes.';
            const evaluadorTexto = doc.evaluado_por ? `<br><small style="color:var(--electric-blue)"><b>Revisado por:</b> ${doc.evaluado_por}</small>` : '';
            tr.innerHTML = `
                <td><strong>${doc.nombre_tipo}</strong></td>
                <td><span class="status-badge status-${doc.estado}">${doc.estado}</span></td>
                <td>${obsTexto} ${evaluadorTexto}</td> <!-- Mostramos el nombre abajo del motivo -->
                <td>${new Date(doc.actualizado_at).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });

        // Cargar Notificaciones
        const notifRes = await API.request('/apprentice/notifications');
        const notifDiv = document.getElementById('lista-notificaciones');
        notifDiv.innerHTML = notifRes.length === 0 ? '<p>No tienes alertas nuevas.</p>' : '';
        notifRes.slice(0, 3).forEach(n => {
            notifDiv.innerHTML += `<p><strong>[${new Date(n.creado_at).toLocaleDateString()}] ${n.titulo}:</strong> ${n.mensaje}</p>`;
        });

    } catch (err) {
        console.error("Fallo al inicializar datos:", err);
    }
}

// ... Todo el inicio de tu lógica de inicializarDashboard() se mantiene EXACTAMENTE IGUAL ...

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropZoneContent = document.getElementById('drop-zone-content');
const filePreview = document.getElementById('file-preview');
const selectedFileName = document.getElementById('selected-file-name');
const changeFileBtn = document.getElementById('change-file-btn');
const submitBtn = document.getElementById('submit-upload-btn');

// 1. Hacer que la zona de arrastre abra el explorador de archivos al hacerle clic
dropZone.addEventListener('click', (e) => {
    // Evitamos que se dispare si se hace clic en el botón de quitar archivo
    if (e.target !== changeFileBtn) {
        fileInput.click();
    }
});

// 2. Eventos visuales cuando el archivo está "volando" sobre la zona de arrastre
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.backgroundColor = '#E3F2FD'; // Color azul más claro de realce
        dropZone.style.border = '2px dashed var(--sena-green)'; // Cambia a borde verde SENA
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (eventName === 'dragleave') {
            dropZone.style.backgroundColor = '#F0F8FF'; // Vuelve al color original
            dropZone.style.border = '2px dashed var(--electric-blue)';
        }
    }, false);
});

// 3. Capturar el archivo cuando el aprendiz lo SUELTA (Drop) en el cuadro
dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0 && files[0].type === "application/pdf") {
        fileInput.files = files; // Asignamos el archivo soltado al input oculto
        mostrarVistaPrevia(files[0].name);
    } else {
        alert("Por favor, asegúrate de arrastrar únicamente un archivo válido en formato PDF.");
        resetearZonaCarga();
    }
});

// 4. Capturar el archivo si el aprendiz prefirió usar el EXPLORADOR tradicional (Clic)
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        mostrarVistaPrevia(fileInput.files[0].name);
    }
});

// Funciones auxiliares de cambio de interfaz visual en tiempo real
function mostrarVistaPrevia(nombreArchivo) {
    dropZoneContent.style.display = 'none';
    filePreview.style.display = 'block';
    selectedFileName.innerText = nombreArchivo;
    submitBtn.style.display = 'block'; // Mostramos el botón de enviar solo cuando hay un archivo cargado
    dropZone.style.backgroundColor = '#E8F5E9'; // Fondo verde muy sutil de éxito
    dropZone.style.border = '2px solid var(--sena-green)';
}

function resetearZonaCarga() {
    fileInput.value = "";
    dropZoneContent.style.display = 'block';
    filePreview.style.display = 'none';
    submitBtn.style.display = 'none'; // Ocultamos el botón si no hay archivo
    dropZone.style.backgroundColor = '#F0F8FF';
    dropZone.style.border = '2px dashed var(--electric-blue)';
}

// Botón para quitar el archivo seleccionado y volver a empezar
changeFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetearZonaCarga();
});

// 5. Modificar el Evento de Envío del Formulario (Submit)
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const solicitudId = document.getElementById('solicitud-id').value;
    const tipoDocumento = document.getElementById('tipo-doc').value;
    const file = fileInput.files[0];

    if (!file) {
        alert("Debes seleccionar o arrastrar un archivo antes de enviarlo.");
        return;
    }

    const formData = new FormData();
    formData.append('solicitudId', solicitudId);
    formData.append('tipoDocumento', tipoDocumento);
    formData.append('archivo', file);

    // Animación visual de carga
    submitBtn.innerText = "⏳ Subiendo archivo de manera segura a Supabase...";
    submitBtn.disabled = true;

    const res = await API.request('/apprentice/document/upload', {
        method: 'POST',
        body: formData
    });

    alert(res.message || res.error);
    
    // Restaurar el botón y limpiar la zona de carga tras el éxito
    submitBtn.innerText = "🚀 Subir / Reemplazar Documento Seleccionado";
    submitBtn.disabled = false;
    
    resetearZonaCarga();
    inicializarDashboard(); // Refresca la tabla en tiempo real
});

document.getElementById('logout-btn').addEventListener('click', () => {
    API.clear();
    window.location.href = '/index.html';
});

// Inicialización automática al cargar el archivo en el navegador
window.onload = inicializarDashboard;