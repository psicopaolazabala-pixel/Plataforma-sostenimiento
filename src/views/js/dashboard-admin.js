import { API } from '../public/js/api.js'; //

// Variables globales del módulo
let solicitudActualId = null; //[cite: 11]
let aprendizActualId = null; //[cite: 11]
let todasLasSolicitudes = []; //[cite: 11]
let documentosActualesModal = []; //[cite: 11]


async function cargarPostulaciones() {
    // 1. Descargar las solicitudes reales de la base de datos[cite: 11]
    todasLasSolicitudes = await API.request('/admin/applications'); //[cite: 11]
    
    // 2. Escuchar los cambios del selector de filtro por estado[cite: 11]
    const selectorFiltro = document.getElementById('filtro-estado'); //[cite: 11]
    if (selectorFiltro && !selectorFiltro.dataset.listenerActivo) {
        selectorFiltro.addEventListener('change', ejecutarFiltroCombinado);
        selectorFiltro.dataset.listenerActivo = "true"; //[cite: 11]
    }

    // 🚀 3. Escuchar la escritura en tiempo real de la barra de búsqueda
    const buscadorInput = document.getElementById('buscador-global');
    if (buscadorInput && !buscadorInput.dataset.listenerActivo) {
        // 'input' detecta inmediatamente cada letra que digita o borra el usuario
        buscadorInput.addEventListener('input', ejecutarFiltroCombinado);
        buscadorInput.dataset.listenerActivo = "true";
    }

    // 4. Pintar los registros iniciales aplicando los filtros[cite: 11]
    ejecutarFiltroCombinado();
}

// 🚀 NUEVA FUNCIÓN MAESTRA: Aplica los filtros cruzados en la memoria del navegador
function ejecutarFiltroCombinado() {
    const estadoFiltro = document.getElementById('filtro-estado').value;
    const textoBusqueda = document.getElementById('buscador-global').value.toLowerCase().trim();

    const tbody = document.querySelector('#tabla-admisiones tbody'); //[cite: 11]
    tbody.innerHTML = ''; //[cite: 11]

    // Filtrar la colección global 'todasLasSolicitudes' bajo ambas condiciones[cite: 11]
    const solicitudesFiltradas = todasLasSolicitudes.filter(sol => {
        // Condición A: Coincidencia de Estado[cite: 11]
        const cumpleEstado = (estadoFiltro === 'TODOS' || sol.estado === estadoFiltro); //[cite: 11]

        // Condición B: Coincidencia de Texto (Nombre, Ficha o Revisor asignado)
        const nombreCompleto = (sol.perfiles?.nombre_completo || '').toLowerCase(); //[cite: 11]
        const numeroFicha = (sol.perfiles?.ficha_caracterizacion || '').toString(); //[cite: 11]
        const ultimoEvaluador = (sol.ultima_observacion_por || '').toLowerCase(); //[cite: 11]

        const cumpleTexto = !textoBusqueda || 
                            nombreCompleto.includes(textoBusqueda) || 
                            numeroFicha.includes(textoBusqueda) || 
                            ultimoEvaluador.includes(textoBusqueda);

        return cumpleEstado && cumpleTexto;
    });

    // Control si el filtro combinado no arroja filas[cite: 11]
    if (solicitudesFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:grey; padding: 2rem;">No se encontraron postulaciones con los criterios ingresados.</td></tr>`; //[cite: 11]
        return;
    }

    // Dibujar los resultados coincidentes[cite: 11]
    solicitudesFiltradas.forEach(sol => {
        const revisor = sol.ultima_observacion_por || '<em>Sin asignar</em>'; //[cite: 11]

        const tr = document.createElement('tr'); //[cite: 11]
        tr.innerHTML = `
            <td><strong>${sol.perfiles.nombre_completo}</strong></td>
            <td>${sol.perfiles.documento_identidad}</td>
            <td>${sol.perfiles.ficha_caracterizacion}</td>
            <td><span class="status-badge status-${sol.estado}">${sol.estado}</span></td>
            <td><span style="font-size:0.9rem; color:#555;">${revisor}</span></td>
            <td><button class="btn btn-evaluar" data-id="${sol.id}" data-aprendiz="${sol.perfiles.id}" data-nombre="${sol.perfiles.nombre_completo}">Evaluar Expediente</button></td>
        `; //[cite: 11]
        tbody.appendChild(tr); //[cite: 11]
    });

    configurarBotonesAccion(); //[cite: 11]
}

// NUEVA FUNCIÓN: Se encarga del filtrado reactivo en memoria
function renderizarTablaFiltrada(estadoFiltro) {
    const tbody = document.querySelector('#tabla-admisiones tbody');
    tbody.innerHTML = '';

    const solicitudesFiltradas = todasLasSolicitudes.filter(sol => {
        if (estadoFiltro === 'TODOS') return true;
        return sol.estado === estadoFiltro;
    });

    if (solicitudesFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:grey; padding: 2rem;">No se encontraron postulaciones.</td></tr>`;
        return;
    }

    solicitudesFiltradas.forEach(sol => {
        // Validamos si ya tiene un revisor asignado, si no, ponemos "Sin asignar"
        const revisor = sol.ultima_observacion_por || '<em>Sin asignar</em>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${sol.perfiles.nombre_completo}</strong></td>
            <td>${sol.perfiles.documento_identidad}</td>
            <td>${sol.perfiles.ficha_caracterizacion}</td>
            <td><span class="status-badge status-${sol.estado}">${sol.estado}</span></td>
            <td><span style="font-size:0.9rem; color:#555;">${revisor}</span></td> <!-- Nueva celda -->
            <td><button class="btn btn-evaluar" data-id="${sol.id}" data-aprendiz="${sol.perfiles.id}" data-nombre="${sol.perfiles.nombre_completo}">Evaluar Expediente</button></td>
        `;
        tbody.appendChild(tr);
    });

    configurarBotonesAccion();
}

function configurarBotonesAccion() {
    document.querySelectorAll('.btn-evaluar').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            solicitudActualId = e.target.getAttribute('data-id'); //
            aprendizActualId = e.target.getAttribute('data-aprendiz'); //
            const nombre = e.target.getAttribute('data-nombre'); //

            document.getElementById('modal-nombre-aprendiz').innerText = nombre; //
            
            // =========================================================================
            // 🚀 PERSISTENCIA EN EL DICTAMEN GENERAL (REPOSITORIO EN MEMORIA)
            // =========================================================================
            // Buscamos la solicitud activa dentro del array global para recuperar su historial
            const solicitudEnCurso = todasLasSolicitudes.find(sol => sol.id == solicitudActualId);

            if (solicitudEnCurso) {
                console.log(`📋 [DEBUG DICTAMEN] Recuperando estado previo: ${solicitudEnCurso.estado}`);
                
                // 1. Sincronizar el selector de Estado Global
                const selectGlobal = document.getElementById('modal-estado-global');
                if (selectGlobal) {
                    selectGlobal.value = solicitudEnCurso.estado || 'PENDIENTE_REVISION';
                }

                // 2. Sincronizar el cuadro de texto de Observaciones Generales
                const txtObservaciones = document.getElementById('modal-obs-globales');
                if (txtObservaciones) {
                    txtObservaciones.value = solicitudEnCurso.observaciones_generales || '';
                }
            }
            // =========================================================================

            // Cargar los documentos asociados a esta solicitud en tiempo real
            await cargarDocumentosEnModal(solicitudActualId); //

            // Mostrar el modal y el fondo oscuro
            document.getElementById('modal-evaluacion').style.display = 'block'; //
            document.getElementById('modal-overlay').style.display = 'block'; //
        });
    });
}

async function cargarDocumentosEnModal(solicitudId) {
    const documentos = await API.request(`/admin/application/${solicitudId}/documents`); //
    documentosActualesModal = documentos; //
    
    const tbody = document.querySelector('#tabla-modal-documentos tbody'); //
    tbody.innerHTML = ''; //

    if (documentos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:grey;">El aprendiz no ha cargado archivos en esta postulación.</td></tr>`;
        document.getElementById('btn-descargar-zip').style.display = 'none'; //
        return;
    }

    documentos.forEach(doc => {
        const tr = document.createElement('tr');
        // 🚀 Agregamos un ID a la fila para poder removerla del HTML reactivamente
        tr.id = `fila-documento-${doc.id}`;

        tr.innerHTML = `
            <td><strong>${doc.nombre_tipo}</strong></td>
            <td><span class="status-badge status-${doc.estado}">${doc.estado}</span></td>
            <td>
                <a href="${doc.url_visualizacion}" target="_blank" class="btn btn-secondary" style="font-size:0.8rem; padding:0.4rem;">👁️ Abrir PDF</a>
            </td>
            <td>
                <select class="select-estado-doc" data-id="${doc.id}" style="padding:0.3rem;">
                    <option value="PENDIENTE" ${doc.estado === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                    <option value="EN_REVISION" ${doc.estado === 'EN_REVISION' ? 'selected' : ''}>EN_REVISION</option>
                    <option value="APROBADO" ${doc.estado === 'APROBADO' ? 'selected' : ''}>APROBADO</option>
                    <option value="CORREGIR" ${doc.estado === 'CORREGIR' ? 'selected' : ''}>CORREGIR</option>
                </select>
                <input type="text" class="input-obs-doc" data-id="${doc.id}" value="${doc.observacion_especifica || ''}" placeholder="Motivo de rechazo/obs" style="width:120px; padding:0.3rem; margin-left:5px;">
                <button class="btn btn-actualizar-doc" data-id="${doc.id}" style="padding:0.3rem; font-size:0.8rem; background:#0076A8;">💾</button>
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-eliminar-documento" data-id="${doc.id}" 
                        style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #D32F2F; padding: 4px;" 
                        title="Eliminar permanentemente">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // === CONTROL DEL BOTÓN ZIP ===
    const todosAprobados = documentos.every(doc => doc.estado === 'APROBADO'); //
    const btnZip = document.getElementById('btn-descargar-zip'); //
    if (btnZip) {
        btnZip.style.display = todosAprobados ? 'inline-block' : 'none'; //
    }

    // Configurar eventos individuales para calificar documentos (Existente)
    tbody.querySelectorAll('.btn-actualizar-doc').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const docId = btn.getAttribute('data-id'); //
            const fila = btn.parentElement; //
            const estado = fila.querySelector('.select-estado-doc').value; //
            const observacion = fila.querySelector('.input-obs-doc').value; //

            const res = await API.request('/admin/document/review', { //
                method: 'POST', //
                body: { documentoId: docId, estado, observacion, aprendizId: aprendizActualId } //
            });
            
            alert(res.message || "Estado del documento actualizado."); //
            await cargarDocumentosEnModal(solicitudActualId); //
            await cargarPostulaciones();  //
        });
    });

    // =========================================================================
    // 🧠 NUEVO ESCUCHADOR: PROCESAR EL BORRADO EN CALIENTE
    // =========================================================================
    tbody.querySelectorAll('.btn-eliminar-documento').forEach(btn => {
        btn.addEventListener('click', async () => {
            const docId = btn.getAttribute('data-id');
            
            const seguro = confirm("⚠️ ¿Estás completamente seguro de eliminar este archivo?\nSe borrará de forma física en Supabase y no se podrá recuperar.");
            if (!seguro) return;

            btn.innerText = "⏳";
            btn.disabled = true;

            try {
                // Consumimos nuestra nueva ruta DELETE pasándole el ID en la URL
                const respuesta = await API.request(`/admin/document/${docId}`, {
                    method: 'DELETE'
                });

                if (respuesta && respuesta.error) {
                    alert(`❌ No se pudo completar la operación: ${respuesta.error}`);
                    btn.innerText = "🗑️";
                    btn.disabled = false;
                } else {
                    alert(respuesta.message || "Documento removido.");
                    
                    // Remoción reactiva: Desvanece la fila del HTML sin recargar el modal
                    const filaTr = document.getElementById(`fila-documento-${docId}`);
                    if (filaTr) filaTr.remove();

                    // Si borró el último archivo que quedaba, pintamos el aviso de vacío
                    if (tbody.querySelectorAll('tr').length === 0) {
                        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:grey;">El aprendiz no ha cargado archivos en esta postulación.</td></tr>`;
                        if (btnZip) btnZip.style.display = 'none';
                    }
                }
            } catch (err) {
                alert("❌ Error de red al comunicarse con el módulo de eliminación.");
                btn.innerText = "🗑️";
                btn.disabled = false;
            }
        });
    });
}

async function renderizarEstadisticas() {
    try {
        const stats = await API.request('/admin/dashboard/stats');
        
        // Asignamos los valores devueltos por la API a los contenedores HTML
        document.getElementById('stat-total').innerText = stats.totalInscritos;
        document.getElementById('stat-pendientes').innerText = stats.porRevisar;
        document.getElementById('stat-correccion').innerText = stats.requiereCorreccion;
        document.getElementById('stat-aprobados').innerText = stats.aprobadas;
        
    } catch (err) {
        console.error("Error al pintar estadísticas en pantalla:", err);
    }
}

// Guardar Dictamen Global
document.getElementById('guardar-dictamen-global').addEventListener('click', async () => {
    const estado = document.getElementById('modal-estado-global').value;
    const observaciones = document.getElementById('modal-obs-globales').value;

    const res = await API.request('/admin/application/status', {
        method: 'PUT',
        body: { solicitudId: solicitudActualId, estado, observaciones, aprendizId: aprendizActualId }
    });

    alert(res.message || "Dictamen general guardado con éxito.");
    cerrarModal();
    cargarPostulaciones();
});

// === EVENTO DE DESCARGA ZIP COMPRIMIDO ===
document.getElementById('btn-descargar-zip').addEventListener('click', async () => {
    const btn = document.getElementById('btn-descargar-zip');
    const nombreAprendiz = document.getElementById('modal-nombre-aprendiz').innerText.trim().replace(/\s+/g, '_');
    
    btn.innerText = "⏳ Generando Compresores...";
    btn.disabled = true;

    try {
        const zip = new JSZip();
        
        // Descargar los archivos en paralelo a la memoria del navegador usando fetch
        await Promise.all(documentosActualesModal.map(async (doc) => {
            if (!doc.url_visualizacion) return;
            
            const response = await fetch(doc.url_visualizacion);
            const blob = await response.blob();
            
            // Asignar un nombre limpio al PDF dentro del archivo ZIP
            const nombreArchivo = `${doc.nombre_tipo.replace(/\s+/g, '_')}.pdf`;
            zip.file(nombreArchivo, blob);
        }));

        // Empaquetar y forzar descarga
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Expediente_SENA_${nombreAprendiz}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("🎉 ¡Expediente completo descargado con éxito en formato comprimido!");
    } catch (err) {
        console.error("Fallo al empaquetar archivos ZIP:", err);
        alert("Ocurrió un error al intentar compilar el paquete .ZIP.");
    } finally {
        btn.innerText = "📦 Descargar Expediente Completo (.ZIP)";
        btn.disabled = false;
    }
});

// Cerrar Modal
function cerrarModal() {
    document.getElementById('modal-evaluacion').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}
document.getElementById('cerrar-modal').addEventListener('click', cerrarModal);
document.getElementById('modal-overlay').addEventListener('click', cerrarModal);

document.getElementById('logout-btn').addEventListener('click', () => {
    API.clear();
    window.location.href = '/index.html';
});

document.getElementById('form-nuevo-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnSubmit = e.target.querySelector('button');
    btnSubmit.innerText = "⏳ Creando Administrador...";
    btnSubmit.disabled = true;

    const payload = {
        nombreCompleto: document.getElementById('admin-nombre').value.trim(),
        documentoIdentidad: document.getElementById('admin-doc').value.trim(),
        celular: document.getElementById('admin-celular').value.trim(),
        email: document.getElementById('admin-email').value.trim(),
        password: document.getElementById('admin-password').value
    };

    try {
        // Petición al endpoint que acabamos de habilitar en el Paso 1
        const res = await API.request('/admin/create-admin', {
            method: 'POST',
            body: payload
        });

        if (res.error) {
            alert(`❌ Error: ${res.error}`);
        } else {
            alert("🎉 ¡Administrador creado con éxito en Supabase Auth y PostgreSQL!");
            document.getElementById('form-nuevo-admin').reset();
            // Cierra el panel colapsable automáticamente
            document.querySelector('details').open = false; 
        }
    } catch (err) {
        alert("❌ Error de comunicación con el servidor.");
    } finally {
        btnSubmit.innerText = "Crear Cuenta de Administrador";
        btnSubmit.disabled = false;
    }
});

let convocatoriaActivaGlobal = true;

async function verificarEstadoConvocatoriaAdmin() {
    const btnToggle = document.getElementById('btn-toggle-convocatoria');
    const banner = document.getElementById('banner-control-convocatoria');
    if (!btnToggle) return;

    try {
        const res = await API.request('/admin/convocatoria-estado');
        convocatoriaActivaGlobal = res.convocatoria_activa;

        if (convocatoriaActivaGlobal) {
            btnToggle.innerText = "🔒 Congelar Módulo Aprendices";
            btnToggle.style.backgroundColor = "#D32F2F"; // Rojo para cerrar
            banner.style.backgroundColor = "#E8F5E9"; // Verde de operativo
            banner.style.borderLeft = "5px solid #23893E";
            banner.querySelector('h3').style.color = "#23893E";
            banner.querySelector('h3').innerText = "✅ Convocatoria Abierta";
        } else {
            btnToggle.innerText = "🔓 Abrir Nueva Convocatoria";
            btnToggle.style.backgroundColor = "#23893E"; // Verde para abrir
            banner.style.backgroundColor = "#FFEBEE"; // Rojo de bloqueado
            banner.style.borderLeft = "5px solid #D32F2F";
            banner.querySelector('h3').style.color = "#D32F2F";
            banner.querySelector('h3').innerText = "🚫 Convocatoria Cerrada (Filtro Activo)";
        }
    } catch (e) {
        console.error("Error al leer el estado del switch.");
    }
}

// Evento de click para cambiar el estado
document.getElementById('btn-toggle-convocatoria')?.addEventListener('click', async () => {
    const btnToggle = document.getElementById('btn-toggle-convocatoria');
    const proximoEstado = !convocatoriaActivaGlobal;

    const msg = proximoEstado 
        ? "¿Deseas habilitar la plataforma para que los aprendices vuelvan a adjuntar documentos?" 
        : "⚠️ ¿Estás seguro de congelar la interfaz del aprendiz?\nNingún aspirante podrá cargar, modificar o reemplazar archivos hasta que vuelvas a abrir el ciclo.";
    
    if (!confirm(msg)) return;

    btnToggle.disabled = true;
    btnToggle.innerText = "⏳ Actualizando...";

    const res = await API.request('/admin/convocatoria-toggle', {
        method: 'POST',
        body: { activa: proximoEstado }
    });

    alert(res.message);
    btnToggle.disabled = false;
    await verificarEstadoConvocatoriaAdmin();
});

window.onload = () => {
    renderizarEstadisticas(); // Carga las tarjetas numéricas superiores
    cargarPostulaciones();    // Carga la tabla inferior
    
    // 🚀 NUEVO: Sincroniza el banner de control de la convocatoria al abrir la página
    verificarEstadoConvocatoriaAdmin(); 
};
