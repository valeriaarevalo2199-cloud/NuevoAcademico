// ============================================================
// ACADÉMICO FÁCIL
// Módulo de administración
// Archivo: assets/js/administracion.js
// ============================================================

(() => {
    "use strict";

    // --------------------------------------------------------
    // 1. CONFIGURACIÓN Y ELEMENTOS HTML
    // --------------------------------------------------------

    const db = window.supabaseClient;

    const $ = (id) => document.getElementById(id);

    const elementos = {
        mensajeSistema: $("mensajeSistema"),
        estadoCarga: $("estadoCarga"),
        adminNombre: $("adminNombre"),
        btnActualizar: $("btnActualizar"),
        btnCerrarSesion: $("btnCerrarSesion"),

        totalSolicitudes: $("totalSolicitudes"),
        totalRecibidas: $("totalRecibidas"),
        totalRevision: $("totalRevision"),
        totalResueltas: $("totalResueltas"),

        contadorRegistros: $("contadorRegistros"),
        buscarSolicitud: $("buscarSolicitud"),
        filtroEstado: $("filtroEstado"),
        tablaSolicitudes: $("tablaSolicitudes")
    };

    let usuarioAdmin = null;
    let solicitudes = [];
    let perfiles = [];
    let categorias = [];
    let asignaciones = [];

    let cargando = false;

    const ESTADOS = {
        recibida: {
            texto: "Recibida",
            clase: "dash-status-recibida"
        },
        en_revision: {
            texto: "En revisión",
            clase: "dash-status-revision"
        },
        pendiente_informacion: {
            texto: "Pendiente de información",
            clase: "dash-status-pendiente"
        },
        resuelta: {
            texto: "Resuelta",
            clase: "dash-status-resuelta"
        },
        cerrada: {
            texto: "Cerrada",
            clase: "dash-status-resuelta"
        }
    };

    // --------------------------------------------------------
    // 2. FUNCIONES GENERALES
    // --------------------------------------------------------

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, (caracter) => {
            const caracteres = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return caracteres[caracter];
        });
    }

    function mostrarMensaje(texto, tipo = "info") {
        if (!elementos.mensajeSistema) {
            console.log(texto);
            return;
        }

        elementos.mensajeSistema.textContent = texto;
        elementos.mensajeSistema.className = `alert alert-${tipo}`;
        elementos.mensajeSistema.classList.remove("d-none");
    }

    function ocultarMensaje() {
        if (!elementos.mensajeSistema) return;

        elementos.mensajeSistema.textContent = "";
        elementos.mensajeSistema.classList.add("d-none");
    }

    function mostrarCarga(texto = "Cargando información...") {
        if (elementos.estadoCarga) {
            elementos.estadoCarga.textContent = texto;
            elementos.estadoCarga.classList.remove("d-none");
        }
    }

    function ocultarCarga() {
        if (elementos.estadoCarga) {
            elementos.estadoCarga.textContent = "";
            elementos.estadoCarga.classList.add("d-none");
        }
    }

    function formatearFecha(fecha) {
        if (!fecha) return "Sin fecha";

        const valor = new Date(fecha);

        if (Number.isNaN(valor.getTime())) {
            return "Sin fecha";
        }

        return valor.toLocaleString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    }

    function obtenerNombreCompleto(perfil) {
        if (!perfil) return "Usuario no disponible";

        const nombre = [
            perfil.nombres,
            perfil.apellidos
        ]
            .filter(Boolean)
            .join(" ")
            .trim();

        return nombre || perfil.correo || "Usuario sin nombre";
    }

    function obtenerEstado(estado) {
        return ESTADOS[estado] || {
            texto: estado || "Sin estado",
            clase: "dash-status-recibida"
        };
    }

    function obtenerPerfil(id) {
        return perfiles.find((perfil) => perfil.id === id);
    }

    function obtenerCategoria(id) {
        return categorias.find((categoria) => categoria.id === id);
    }

    function obtenerAsignacion(solicitudId) {
        return asignaciones.find(
            (asignacion) => asignacion.solicitud_id === solicitudId
        );
    }

    function obtenerFuncionarioAsignado(solicitudId) {
        const asignacion = obtenerAsignacion(solicitudId);

        if (!asignacion) return null;

        return obtenerPerfil(asignacion.funcionario_id);
    }

    function obtenerFuncionariosDisponibles() {
        return perfiles.filter(
            (perfil) => perfil.rol === "funcionario"
        );
    }

    // --------------------------------------------------------
    // 3. VALIDAR SESIÓN Y ROL DEL ADMINISTRADOR
    // --------------------------------------------------------

    async function validarAdministrador() {
        if (!db) {
            mostrarMensaje(
                "No se pudo conectar con Supabase. Verifica el archivo supabase.js y que la librería de Supabase esté cargada.",
                "danger"
            );
            return false;
        }

        const { data, error } = await db.auth.getSession();

        if (error) {
            console.error("Error consultando la sesión:", error);

            mostrarMensaje(
                "No fue posible verificar la sesión. Intenta iniciar sesión nuevamente.",
                "danger"
            );

            return false;
        }

        const sesion = data?.session;

        if (!sesion?.user) {
            window.location.href = "login.html";
            return false;
        }

        const { data: perfil, error: errorPerfil } = await db
            .from("perfiles")
            .select("id, nombres, apellidos, correo, rol")
            .eq("id", sesion.user.id)
            .maybeSingle();

        if (errorPerfil) {
            console.error("Error consultando el perfil:", errorPerfil);

            mostrarMensaje(
                "No se pudo consultar tu perfil. Verifica los permisos de lectura de la tabla perfiles en Supabase.",
                "danger"
            );

            return false;
        }

        if (!perfil || perfil.rol !== "administrador") {
            mostrarMensaje(
                "Tu cuenta no tiene permisos para acceder al módulo de administración.",
                "danger"
            );

            await db.auth.signOut();
            window.location.href = "login.html";

            return false;
        }

        usuarioAdmin = sesion.user;

        if (elementos.adminNombre) {
            elementos.adminNombre.textContent =
                obtenerNombreCompleto(perfil);
        }

        return true;
    }

    // --------------------------------------------------------
    // 4. CARGAR SOLICITUDES, PERFILES, CATEGORÍAS Y ASIGNACIONES
    // --------------------------------------------------------

    async function cargarInformacion() {
        if (cargando) return;

        cargando = true;
        ocultarMensaje();
        mostrarCarga("Cargando solicitudes y funcionarios...");

        if (elementos.btnActualizar) {
            elementos.btnActualizar.disabled = true;
        }

        try {
            // Consultar las solicitudes
            const resultadoSolicitudes = await db
                .from("solicitudes")
                .select(`
                    id,
                    radicado,
                    estudiante_id,
                    categoria_id,
                    asunto,
                    descripcion,
                    estado,
                    created_at,
                    updated_at
                `)
                .order("created_at", { ascending: false });

            if (resultadoSolicitudes.error) {
                throw new Error(
                    "No fue posible cargar las solicitudes: " +
                    resultadoSolicitudes.error.message
                );
            }

            solicitudes = resultadoSolicitudes.data || [];

            // Consultar perfiles, categorías y asignaciones
            const [
                resultadoPerfiles,
                resultadoCategorias,
                resultadoAsignaciones
            ] = await Promise.all([
                db
                    .from("perfiles")
                    .select("id, nombres, apellidos, correo, rol"),

                db
                    .from("categorias")
                    .select("id, nombre, activa"),

                db
                    .from("asignaciones")
                    .select(`
                        id,
                        solicitud_id,
                        funcionario_id,
                        asignado_por,
                        created_at
                    `)
            ]);

            perfiles = [];
            categorias = [];
            asignaciones = [];

            const advertencias = [];

            if (resultadoPerfiles.error) {
                console.error(
                    "Error cargando perfiles:",
                    resultadoPerfiles.error
                );

                advertencias.push(
                    "No se pudieron consultar los perfiles. Revisa los permisos de lectura de perfiles."
                );
            } else {
                perfiles = resultadoPerfiles.data || [];
            }

            if (resultadoCategorias.error) {
                console.error(
                    "Error cargando categorías:",
                    resultadoCategorias.error
                );

                advertencias.push(
                    "No se pudieron consultar las categorías."
                );
            } else {
                categorias = resultadoCategorias.data || [];
            }

            if (resultadoAsignaciones.error) {
                console.error(
                    "Error cargando asignaciones:",
                    resultadoAsignaciones.error
                );

                advertencias.push(
                    "No se pudieron consultar las asignaciones. Revisa las políticas RLS de asignaciones."
                );
            } else {
                asignaciones = resultadoAsignaciones.data || [];
            }

            actualizarEstadisticas();
            renderizarTabla();

            if (advertencias.length > 0) {
                mostrarMensaje(advertencias.join(" "), "warning");
            } else if (solicitudes.length === 0) {
                mostrarMensaje(
                    "La conexión funciona, pero todavía no hay solicitudes registradas.",
                    "info"
                );
            } else {
                mostrarMensaje(
                    "Información actualizada correctamente.",
                    "success"
                );
            }

        } catch (error) {
            console.error("Error general del administrador:", error);

            mostrarMensaje(
                error.message ||
                "Ocurrió un error al cargar la información.",
                "danger"
            );

            if (elementos.tablaSolicitudes) {
                elementos.tablaSolicitudes.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4">
                            No fue posible cargar las solicitudes.
                            Revisa el mensaje de error e inténtalo nuevamente.
                        </td>
                    </tr>
                `;
            }

        } finally {
            cargando = false;
            ocultarCarga();

            if (elementos.btnActualizar) {
                elementos.btnActualizar.disabled = false;
            }
        }
    }

    // --------------------------------------------------------
    // 5. ACTUALIZAR LAS TARJETAS DE ESTADÍSTICAS
    // --------------------------------------------------------

    function actualizarEstadisticas() {
        const total = solicitudes.length;

        const recibidas = solicitudes.filter(
            (solicitud) => solicitud.estado === "recibida"
        ).length;

        const enRevision = solicitudes.filter(
            (solicitud) => solicitud.estado === "en_revision"
        ).length;

        const resueltas = solicitudes.filter(
            (solicitud) =>
                solicitud.estado === "resuelta" ||
                solicitud.estado === "cerrada"
        ).length;

        if (elementos.totalSolicitudes) {
            elementos.totalSolicitudes.textContent = total;
        }

        if (elementos.totalRecibidas) {
            elementos.totalRecibidas.textContent = recibidas;
        }

        if (elementos.totalRevision) {
            elementos.totalRevision.textContent = enRevision;
        }

        if (elementos.totalResueltas) {
            elementos.totalResueltas.textContent = resueltas;
        }
    }

    // --------------------------------------------------------
    // 6. BUSCAR Y FILTRAR SOLICITUDES
    // --------------------------------------------------------

    function obtenerSolicitudesFiltradas() {
        const busqueda = (
            elementos.buscarSolicitud?.value || ""
        ).trim().toLowerCase();

        const estadoSeleccionado =
            elementos.filtroEstado?.value || "";

        return solicitudes.filter((solicitud) => {
            const estudiante = obtenerPerfil(
                solicitud.estudiante_id
            );

            const categoria = obtenerCategoria(
                solicitud.categoria_id
            );

            const funcionario = obtenerFuncionarioAsignado(
                solicitud.id
            );

            const nombreEstudiante =
                obtenerNombreCompleto(estudiante).toLowerCase();

            const nombreFuncionario =
                obtenerNombreCompleto(funcionario).toLowerCase();

            const nombreCategoria =
                (categoria?.nombre || "").toLowerCase();

            const radicado =
                (solicitud.radicado || "").toLowerCase();

            const asunto =
                (solicitud.asunto || "").toLowerCase();

            const coincideBusqueda =
                !busqueda ||
                radicado.includes(busqueda) ||
                asunto.includes(busqueda) ||
                nombreEstudiante.includes(busqueda) ||
                nombreFuncionario.includes(busqueda) ||
                nombreCategoria.includes(busqueda);

            const coincideEstado =
                !estadoSeleccionado ||
                solicitud.estado === estadoSeleccionado;

            return coincideBusqueda && coincideEstado;
        });
    }

    // --------------------------------------------------------
    // 7. CONSTRUIR LA TABLA DE SOLICITUDES
    // --------------------------------------------------------

    function renderizarTabla() {
        if (!elementos.tablaSolicitudes) {
            console.error(
                'No se encontró el elemento HTML con ID "tablaSolicitudes".'
            );
            return;
        }

        const lista = obtenerSolicitudesFiltradas();

        if (elementos.contadorRegistros) {
            elementos.contadorRegistros.textContent =
                `${lista.length} solicitud(es)`;
        }

        if (lista.length === 0) {
            elementos.tablaSolicitudes.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        No se encontraron solicitudes con los filtros seleccionados.
                    </td>
                </tr>
            `;

            return;
        }

        elementos.tablaSolicitudes.innerHTML = lista.map(
            (solicitud) => {
                const estudiante = obtenerPerfil(
                    solicitud.estudiante_id
                );

                const categoria = obtenerCategoria(
                    solicitud.categoria_id
                );

                const asignacion = obtenerAsignacion(
                    solicitud.id
                );

                const funcionario = obtenerFuncionarioAsignado(
                    solicitud.id
                );

                const estado = obtenerEstado(solicitud.estado);

                const nombreEstudiante =
                    estudiante
                        ? obtenerNombreCompleto(estudiante)
                        : "Estudiante no disponible";

                const nombreCategoria =
                    categoria?.nombre || "Sin categoría";

                const nombreFuncionario =
                    funcionario
                        ? obtenerNombreCompleto(funcionario)
                        : null;

                const controlAsignacion = crearControlAsignacion(
                    solicitud,
                    asignacion,
                    funcionario
                );

                return `
                    <tr>
                        <td>
                            <span class="dash-radicado">
                                ${escaparHTML(solicitud.radicado || "Sin radicado")}
                            </span>
                        </td>

                        <td>
                            <strong>
                                ${escaparHTML(nombreEstudiante)}
                            </strong>
                        </td>

                        <td>
                            ${escaparHTML(nombreCategoria)}
                        </td>

                        <td>
                            ${escaparHTML(solicitud.asunto || "Sin asunto")}
                        </td>

                        <td>
                            <span class="dash-status ${escaparHTML(estado.clase)}">
                                ${escaparHTML(estado.texto)}
                            </span>
                        </td>

                        <td>
                            ${escaparHTML(formatearFecha(solicitud.created_at))}
                        </td>

                        <td>
                            ${controlAsignacion}
                        </td>

                        <td>
                            <button
                                type="button"
                                class="dash-button-outline btn-ver-detalle"
                                data-solicitud-id="${escaparHTML(solicitud.id)}"
                            >
                                Ver detalle
                            </button>
                        </td>
                    </tr>
                `;
            }
        ).join("");
    }

    // --------------------------------------------------------
    // 8. CONTROL PARA ASIGNAR UN FUNCIONARIO
    // --------------------------------------------------------

    function crearControlAsignacion(
        solicitud,
        asignacion,
        funcionario
    ) {
        // Si ya está asignada, mostrar el funcionario actual.
        // Esta versión evita crear asignaciones duplicadas.
        if (asignacion) {
            const nombre = funcionario
                ? obtenerNombreCompleto(funcionario)
                : "Funcionario asignado";

            return `
                <div class="d-flex flex-column gap-1">
                    <span class="fw-semibold">
                        ${escaparHTML(nombre)}
                    </span>
                    <small class="text-muted">
                        Asignación registrada
                    </small>
                </div>
            `;
        }

        const funcionarios = obtenerFuncionariosDisponibles();

        if (funcionarios.length === 0) {
            return `
                <span class="text-muted">
                    No hay funcionarios disponibles
                </span>
            `;
        }

        const opciones = funcionarios.map((perfil) => `
            <option value="${escaparHTML(perfil.id)}">
                ${escaparHTML(obtenerNombreCompleto(perfil))}
            </option>
        `).join("");

        return `
            <div class="d-flex flex-column gap-2">
                <select
                    class="form-select form-select-sm selector-funcionario"
                    data-solicitud-id="${escaparHTML(solicitud.id)}"
                    aria-label="Seleccionar funcionario para ${escaparHTML(solicitud.radicado || "solicitud")}"
                >
                    <option value="">Seleccionar funcionario</option>
                    ${opciones}
                </select>

                <button
                    type="button"
                    class="dash-button btn-asignar-funcionario"
                    data-solicitud-id="${escaparHTML(solicitud.id)}"
                >
                    Asignar solicitud
                </button>
            </div>
        `;
    }

    // --------------------------------------------------------
    // 9. GUARDAR ASIGNACIÓN EN SUPABASE
    // --------------------------------------------------------

    async function asignarFuncionario(solicitudId, funcionarioId, boton) {
        if (!usuarioAdmin) {
            mostrarMensaje(
                "Tu sesión de administrador no está disponible. Inicia sesión nuevamente.",
                "danger"
            );
            return;
        }

        if (!solicitudId || !funcionarioId) {
            mostrarMensaje(
                "Selecciona un funcionario antes de realizar la asignación.",
                "warning"
            );
            return;
        }

        const funcionario = obtenerPerfil(funcionarioId);

        if (!funcionario || funcionario.rol !== "funcionario") {
            mostrarMensaje(
                "El perfil seleccionado no corresponde a un funcionario válido.",
                "danger"
            );
            return;
        }

        const solicitudExiste = solicitudes.some(
            (solicitud) => solicitud.id === solicitudId
        );

        if (!solicitudExiste) {
            mostrarMensaje(
                "No se encontró la solicitud que intentas asignar.",
                "danger"
            );
            return;
        }

        if (obtenerAsignacion(solicitudId)) {
            mostrarMensaje(
                "Esta solicitud ya tiene una asignación registrada. Actualiza la información para verificarla.",
                "warning"
            );

            await cargarInformacion();
            return;
        }

        const confirmar = window.confirm(
            `¿Deseas asignar esta solicitud a ${obtenerNombreCompleto(funcionario)}?`
        );

        if (!confirmar) return;

        const textoOriginal = boton?.textContent;

        if (boton) {
            boton.disabled = true;
            boton.textContent = "Asignando...";
        }

        try {
            // Volver a comprobar la asignación antes de insertar.
            // La restricción única en la base de datos también es
            // recomendable para evitar duplicados simultáneos.
            const { data: asignacionExistente, error: errorConsulta } =
                await db
                    .from("asignaciones")
                    .select("id")
                    .eq("solicitud_id", solicitudId)
                    .maybeSingle();

            if (errorConsulta) {
                throw new Error(
                    "No fue posible verificar si la solicitud ya está asignada: " +
                    errorConsulta.message
                );
            }

            if (asignacionExistente) {
                mostrarMensaje(
                    "La solicitud ya fue asignada. Actualiza la tabla para ver el funcionario responsable.",
                    "warning"
                );

                await cargarInformacion();
                return;
            }

            const { error: errorInsercion } = await db
                .from("asignaciones")
                .insert({
                    solicitud_id: solicitudId,
                    funcionario_id: funcionarioId,
                    asignado_por: usuarioAdmin.id
                });

            if (errorInsercion) {
                throw new Error(
                    "No se pudo guardar la asignación: " +
                    errorInsercion.message
                );
            }

            mostrarMensaje(
                `Solicitud asignada correctamente a ${obtenerNombreCompleto(funcionario)}.`,
                "success"
            );

            await cargarInformacion();

        } catch (error) {
            console.error("Error al asignar funcionario:", error);

            mostrarMensaje(
                error.message ||
                "Ocurrió un error al asignar el funcionario.",
                "danger"
            );

        } finally {
            if (boton) {
                boton.disabled = false;
                boton.textContent = textoOriginal || "Asignar solicitud";
            }
        }
    }

    // --------------------------------------------------------
    // 10. VER DETALLE DE UNA SOLICITUD
    // --------------------------------------------------------

    function verDetalleSolicitud(solicitudId) {
        const solicitud = solicitudes.find(
            (item) => item.id === solicitudId
        );

        if (!solicitud) {
            mostrarMensaje(
                "No se encontró la solicitud seleccionada.",
                "warning"
            );
            return;
        }

        const estudiante = obtenerPerfil(solicitud.estudiante_id);
        const categoria = obtenerCategoria(solicitud.categoria_id);
        const funcionario = obtenerFuncionarioAsignado(solicitud.id);
        const estado = obtenerEstado(solicitud.estado);

        const detalle = [
            `Radicado: ${solicitud.radicado || "Sin radicado"}`,
            `Estudiante: ${obtenerNombreCompleto(estudiante)}`,
            `Categoría: ${categoria?.nombre || "Sin categoría"}`,
            `Asunto: ${solicitud.asunto || "Sin asunto"}`,
            `Estado: ${estado.texto}`,
            `Fecha de creación: ${formatearFecha(solicitud.created_at)}`,
            `Funcionario asignado: ${
                funcionario
                    ? obtenerNombreCompleto(funcionario)
                    : "Sin asignar"
            }`,
            "",
            "Descripción:",
            solicitud.descripcion || "No se registró una descripción."
        ].join("\n");

        window.alert(detalle);
    }

    // --------------------------------------------------------
    // 11. EVENTOS DE LA INTERFAZ
    // --------------------------------------------------------

    function registrarEventos() {
        if (elementos.btnActualizar) {
            elementos.btnActualizar.addEventListener(
                "click",
                cargarInformacion
            );
        }

        if (elementos.buscarSolicitud) {
            elementos.buscarSolicitud.addEventListener(
                "input",
                renderizarTabla
            );
        }

        if (elementos.filtroEstado) {
            elementos.filtroEstado.addEventListener(
                "change",
                renderizarTabla
            );
        }

        if (elementos.btnCerrarSesion) {
            elementos.btnCerrarSesion.addEventListener(
                "click",
                async () => {
                    if (!window.confirm("¿Deseas cerrar la sesión?")) {
                        return;
                    }

                    const { error } = await db.auth.signOut();

                    if (error) {
                        console.error(
                            "Error al cerrar sesión:",
                            error
                        );

                        mostrarMensaje(
                            "No fue posible cerrar la sesión. Inténtalo nuevamente.",
                            "danger"
                        );

                        return;
                    }

                    window.location.href = "login.html";
                }
            );
        }

        // Delegación de eventos para los botones generados en la tabla.
        if (elementos.tablaSolicitudes) {
            elementos.tablaSolicitudes.addEventListener(
                "click",
                async (evento) => {
                    const botonAsignar = evento.target.closest(
                        ".btn-asignar-funcionario"
                    );

                    if (botonAsignar) {
                        const solicitudId =
                            botonAsignar.dataset.solicitudId;

                        const selector = Array.from(
                            elementos.tablaSolicitudes.querySelectorAll(
                                ".selector-funcionario"
                            )
                        ).find(
                            (elemento) =>
                                elemento.dataset.solicitudId === solicitudId
                        );

                        const funcionarioId = selector?.value;

                        await asignarFuncionario(
                            solicitudId,
                            funcionarioId,
                            botonAsignar
                        );

                        return;
                    }

                    const botonDetalle = evento.target.closest(
                        ".btn-ver-detalle"
                    );

                    if (botonDetalle) {
                        verDetalleSolicitud(
                            botonDetalle.dataset.solicitudId
                        );
                    }
                }
            );
        }
    }

    // --------------------------------------------------------
    // 12. INICIAR EL MÓDULO
    // --------------------------------------------------------

    async function iniciarModulo() {
        registrarEventos();

        const esAdministrador = await validarAdministrador();

        if (!esAdministrador) return;

        await cargarInformacion();
    }

    document.addEventListener("DOMContentLoaded", iniciarModulo);
})();
