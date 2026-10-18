/* ==========================================
   ACADÉMICO FÁCIL
   MÓDULO DE ADMINISTRACIÓN
   ========================================== */

document.addEventListener("DOMContentLoaded", iniciarAdministracion);

let solicitudesAdmin = [];
let perfilesAdmin = [];
let categoriasAdmin = [];
let asignacionesAdmin = [];
let usuarioAdmin = null;
let clienteAdmin = null;

const ESTADOS_SOLICITUD = {
    recibida: "Recibida",
    en_revision: "En revisión",
    pendiente_informacion: "Pendiente de información",
    resuelta: "Resuelta",
    cerrada: "Cerrada"
};


/* ==========================================
   INICIO Y VALIDACIÓN DEL ADMINISTRADOR
   ========================================== */

async function iniciarAdministracion() {
    clienteAdmin = window.supabaseClient;

    if (!clienteAdmin) {
        mostrarMensaje(
            "No se pudo conectar con Supabase. Revisa supabase.js.",
            "danger"
        );
        return;
    }

    const { data, error } = await clienteAdmin.auth.getSession();

    if (error || !data?.session) {
        window.location.href = "login.html";
        return;
    }

    usuarioAdmin = data.session.user;

    const { data: perfil, error: errorPerfil } = await clienteAdmin
        .from("perfiles")
        .select("id, nombres, apellidos, correo, rol")
        .eq("id", usuarioAdmin.id)
        .single();

    if (errorPerfil || perfil?.rol !== "administrador") {
        mostrarMensaje(
            "No tienes permisos para acceder al módulo administrativo.",
            "danger"
        );
        return;
    }

    configurarEncabezado(perfil);
    configurarEventos();

    await cargarDatosAdmin();
}


function configurarEncabezado(perfil) {
    const nombre = [
        perfil.nombres || "",
        perfil.apellidos || ""
    ].join(" ").trim();

    const encabezado = document.querySelector(".admin-user-info strong");

    if (encabezado) {
        encabezado.textContent = nombre || "Administrador";
    }
}


/* ==========================================
   EVENTOS DE LA INTERFAZ
   ========================================== */

function configurarEventos() {
    const botonCerrar = document.getElementById("btnCerrarSesion");
    const botonActualizar = document.getElementById("btnActualizarAdmin");
    const buscador = document.getElementById("buscarAdmin");
    const filtroEstado = document.getElementById("estadoAdmin");

    if (botonCerrar) {
        botonCerrar.addEventListener("click", cerrarSesion);
    }

    if (botonActualizar) {
        botonActualizar.addEventListener("click", cargarDatosAdmin);
    }

    if (buscador) {
        buscador.addEventListener("input", mostrarSolicitudesAdmin);
    }

    if (filtroEstado) {
        filtroEstado.addEventListener("change", mostrarSolicitudesAdmin);
    }
}


async function cerrarSesion() {
    if (!clienteAdmin) return;

    const { error } = await clienteAdmin.auth.signOut();

    if (error) {
        mostrarMensaje(
            "No fue posible cerrar la sesión. Intenta nuevamente.",
            "danger"
        );
        return;
    }

    window.location.href = "login.html";
}


/* ==========================================
   CARGA DE INFORMACIÓN
   ========================================== */

async function cargarDatosAdmin() {
    if (!clienteAdmin) return;

    mostrarMensaje("Cargando información administrativa...", "info");

    const botonActualizar = document.getElementById("btnActualizarAdmin");

    if (botonActualizar) {
        botonActualizar.disabled = true;
    }

    try {
        const [
            resultadoSolicitudes,
            resultadoPerfiles,
            resultadoCategorias,
            resultadoAsignaciones
        ] = await Promise.all([
            clienteAdmin
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
                .order("created_at", { ascending: false }),

            clienteAdmin
                .from("perfiles")
                .select("id, nombres, apellidos, correo, rol"),

            clienteAdmin
                .from("categorias")
                .select("id, nombre"),

            clienteAdmin
                .from("asignaciones")
                .select("id, solicitud_id, funcionario_id, asignado_por, created_at")
        ]);

        const errorPrincipal =
            resultadoSolicitudes.error ||
            resultadoPerfiles.error ||
            resultadoCategorias.error;

        if (errorPrincipal) {
            console.error(
                "Error al cargar datos administrativos:",
                errorPrincipal
            );

            mostrarMensaje(
                "No fue posible cargar las solicitudes. Verifica las políticas de acceso de Supabase.",
                "danger"
            );
            return;
        }

        solicitudesAdmin = resultadoSolicitudes.data || [];
        perfilesAdmin = resultadoPerfiles.data || [];
        categoriasAdmin = resultadoCategorias.data || [];

        if (resultadoAsignaciones.error) {
            console.error(
                "No fue posible consultar las asignaciones:",
                resultadoAsignaciones.error
            );

            asignacionesAdmin = [];

            actualizarMetricasAdmin();
            llenarFiltroEstados();
            mostrarSolicitudesAdmin();

            mostrarMensaje(
                "Las solicitudes se cargaron, pero no fue posible consultar los funcionarios asignados. Revisa los permisos de la tabla asignaciones.",
                "warning"
            );

            return;
        }

        asignacionesAdmin = resultadoAsignaciones.data || [];

        actualizarMetricasAdmin();
        llenarFiltroEstados();
        mostrarSolicitudesAdmin();

        mostrarMensaje(
            `Se cargaron ${solicitudesAdmin.length} solicitudes correctamente.`,
            "success"
        );

    } catch (error) {
        console.error("Error inesperado:", error);

        mostrarMensaje(
            "Ocurrió un error inesperado al cargar la administración.",
            "danger"
        );

    } finally {
        if (botonActualizar) {
            botonActualizar.disabled = false;
        }
    }
}


/* ==========================================
   INDICADORES
   ========================================== */

function actualizarMetricasAdmin() {
    asignarTexto("totalSolicitudesAdmin", solicitudesAdmin.length);

    asignarTexto(
        "recibidasAdmin",
        solicitudesAdmin.filter(s => s.estado === "recibida").length
    );

    asignarTexto(
        "revisionAdmin",
        solicitudesAdmin.filter(s => s.estado === "en_revision").length
    );

    asignarTexto(
        "resueltasAdmin",
        solicitudesAdmin.filter(s => s.estado === "resuelta").length
    );
}


/* ==========================================
   FILTROS
   ========================================== */

function llenarFiltroEstados() {
    const filtro = document.getElementById("estadoAdmin");

    if (!filtro) return;

    const valorActual = filtro.value;

    filtro.replaceChildren();

    const opcionTodos = document.createElement("option");
    opcionTodos.value = "";
    opcionTodos.textContent = "Todos los estados";
    filtro.appendChild(opcionTodos);

    Object.entries(ESTADOS_SOLICITUD).forEach(([valor, nombre]) => {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = nombre;
        filtro.appendChild(opcion);
    });

    filtro.value = Object.hasOwn(ESTADOS_SOLICITUD, valorActual)
        ? valorActual
        : "";
}


/* ==========================================
   MOSTRAR SOLICITUDES
   ========================================== */

function mostrarSolicitudesAdmin() {
    const tabla = document.getElementById("tablaSolicitudesAdmin");

    if (!tabla) return;

    const busqueda = (
        document.getElementById("buscarAdmin")?.value || ""
    ).trim().toLowerCase();

    const estadoSeleccionado =
        document.getElementById("estadoAdmin")?.value || "";

    const filtradas = solicitudesAdmin.filter(solicitud => {
        const estudiante = buscarPerfil(solicitud.estudiante_id);
        const categoria = buscarCategoria(solicitud.categoria_id);
        const asignacion = buscarAsignacion(solicitud.id);
        const funcionario = asignacion
            ? buscarPerfil(asignacion.funcionario_id)
            : null;

        const nombreEstudiante = estudiante
            ? `${estudiante.nombres || ""} ${estudiante.apellidos || ""}`
            : "";

        const nombreFuncionario = funcionario
            ? `${funcionario.nombres || ""} ${funcionario.apellidos || ""}`
            : "";

        const texto = [
            solicitud.radicado,
            solicitud.asunto,
            solicitud.descripcion,
            nombreEstudiante,
            estudiante?.correo,
            categoria?.nombre,
            nombreFuncionario,
            funcionario?.correo
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return texto.includes(busqueda) &&
            (!estadoSeleccionado || solicitud.estado === estadoSeleccionado);
    });

    tabla.replaceChildren();

    if (filtradas.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 7;
        celda.className = "admin-empty";
        celda.textContent =
            "No se encontraron solicitudes con los filtros seleccionados.";

        fila.appendChild(celda);
        tabla.appendChild(fila);
    } else {
        filtradas.forEach(solicitud => {
            tabla.appendChild(crearFilaSolicitud(solicitud));
        });
    }

    asignarTexto("contadorAdmin", filtradas.length);

    const sinResultados = document.getElementById("sinResultadosAdmin");

    if (sinResultados) {
        sinResultados.classList.toggle("d-none", filtradas.length > 0);
    }
}


function crearFilaSolicitud(solicitud) {
    const fila = document.createElement("tr");

    const estudiante = buscarPerfil(solicitud.estudiante_id);
    const categoria = buscarCategoria(solicitud.categoria_id);
    const asignacion = buscarAsignacion(solicitud.id);

    const nombreEstudiante = estudiante
        ? `${estudiante.nombres || ""} ${estudiante.apellidos || ""}`.trim()
        : "Estudiante no disponible";

    agregarCelda(
        fila,
        solicitud.radicado || "Sin radicado",
        "admin-radicado"
    );

    agregarCelda(fila, nombreEstudiante);
    agregarCelda(fila, categoria?.nombre || "Sin categoría");
    agregarCelda(fila, solicitud.asunto || "Sin asunto");

    const celdaEstado = document.createElement("td");
    const etiquetaEstado = document.createElement("span");

    etiquetaEstado.className =
        `admin-status estado-${claseEstado(solicitud.estado)}`;

    etiquetaEstado.textContent = formatearEstado(solicitud.estado);

    celdaEstado.appendChild(etiquetaEstado);
    fila.appendChild(celdaEstado);

    agregarCelda(fila, formatearFecha(solicitud.created_at));

    const celdaAsignacion = document.createElement("td");

    crearControlAsignacion(
        celdaAsignacion,
        solicitud,
        asignacion
    );

    fila.appendChild(celdaAsignacion);

    return fila;
}


/* ==========================================
   ASIGNACIÓN DE FUNCIONARIOS
   ========================================== */

function crearControlAsignacion(celda, solicitud, asignacion) {
    const funcionarios = perfilesAdmin.filter(
        perfil => perfil.rol === "funcionario"
    );

    const funcionarioAsignado = asignacion
        ? buscarPerfil(asignacion.funcionario_id)
        : null;

    if (asignacion) {
        const nombre = funcionarioAsignado
            ? `${funcionarioAsignado.nombres || ""} ${funcionarioAsignado.apellidos || ""}`.trim()
            : "Funcionario asignado";

        const detalle = document.createElement("div");
        detalle.className = "mb-2";

        const etiqueta = document.createElement("span");
        etiqueta.className = "badge text-bg-success";
        etiqueta.textContent = nombre;

        detalle.appendChild(etiqueta);
        celda.appendChild(detalle);

        const correo = document.createElement("small");
        correo.className = "text-secondary d-block";
        correo.textContent = funcionarioAsignado?.correo || "";

        celda.appendChild(correo);

        const nota = document.createElement("small");
        nota.className = "text-secondary d-block mt-1";
        nota.textContent = "Solicitud asignada";

        celda.appendChild(nota);

        return;
    }

    if (funcionarios.length === 0) {
        const nota = document.createElement("span");
        nota.className = "text-secondary";
        nota.textContent = "No hay funcionarios registrados";
        celda.appendChild(nota);
        return;
    }

    const contenedor = document.createElement("div");
    contenedor.className = "d-grid gap-2";

    const selector = document.createElement("select");
    selector.className = "form-select admin-assignment-select";
    selector.setAttribute(
        "aria-label",
        `Seleccionar funcionario para ${solicitud.radicado || "la solicitud"}`
    );

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Seleccionar funcionario";
    selector.appendChild(opcionInicial);

    funcionarios.forEach(funcionario => {
        const opcion = document.createElement("option");
        opcion.value = funcionario.id;

        const nombre = [
            funcionario.nombres || "",
            funcionario.apellidos || ""
        ].join(" ").trim();

        opcion.textContent = nombre || funcionario.correo;

        selector.appendChild(opcion);
    });

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "admin-button";
    boton.innerHTML = '<i class="bi bi-person-check"></i> Asignar';

    boton.addEventListener("click", async () => {
        const funcionarioId = selector.value;

        if (!funcionarioId) {
            mostrarMensaje(
                "Selecciona un funcionario antes de asignar la solicitud.",
                "warning"
            );
            return;
        }

        const funcionarioValido = funcionarios.some(
            funcionario => funcionario.id === funcionarioId
        );

        if (!funcionarioValido) {
            mostrarMensaje(
                "El funcionario seleccionado no es válido.",
                "danger"
            );
            return;
        }

        await asignarSolicitud(
            solicitud.id,
            funcionarioId,
            boton,
            selector
        );
    });

    contenedor.appendChild(selector);
    contenedor.appendChild(boton);
    celda.appendChild(contenedor);
}


async function asignarSolicitud(
    solicitudId,
    funcionarioId,
    boton,
    selector
) {
    if (!clienteAdmin || !usuarioAdmin) return;

    boton.disabled = true;
    selector.disabled = true;
    boton.textContent = "Asignando...";

    try {
        /*
         * Verificamos de nuevo que no exista una asignación.
         * Esto evita duplicar asignaciones desde esta interfaz.
         */
        const { data: existentes, error: errorConsulta } = await clienteAdmin
            .from("asignaciones")
            .select("id, funcionario_id")
            .eq("solicitud_id", solicitudId);

        if (errorConsulta) {
            console.error("Error al verificar asignaciones:", errorConsulta);

            mostrarMensaje(
                "No se pudo verificar si la solicitud ya tiene un responsable. Revisa los permisos de asignaciones.",
                "danger"
            );
            return;
        }

        if (existentes && existentes.length > 0) {
            mostrarMensaje(
                "Esta solicitud ya tiene una asignación. Actualiza la información antes de continuar.",
                "warning"
            );

            await cargarDatosAdmin();
            return;
        }

        const { error: errorInsertar } = await clienteAdmin
            .from("asignaciones")
            .insert({
                solicitud_id: solicitudId,
                funcionario_id: funcionarioId,
                asignado_por: usuarioAdmin.id
            });

        if (errorInsertar) {
            console.error("Error al asignar solicitud:", errorInsertar);

            mostrarMensaje(
                "No se pudo asignar la solicitud. Verifica los permisos de inserción y las relaciones de la tabla asignaciones.",
                "danger"
            );
            return;
        }

        mostrarMensaje(
            "Solicitud asignada correctamente al funcionario.",
            "success"
        );

        await cargarDatosAdmin();

    } catch (error) {
        console.error("Error inesperado al asignar:", error);

        mostrarMensaje(
            "Ocurrió un error inesperado al asignar la solicitud.",
            "danger"
        );

    } finally {
        boton.disabled = false;
        selector.disabled = false;
        boton.innerHTML = '<i class="bi bi-person-check"></i> Asignar';
    }
}


/* ==========================================
   BÚSQUEDA DE INFORMACIÓN RELACIONADA
   ========================================== */

function buscarPerfil(perfilId) {
    return perfilesAdmin.find(perfil => perfil.id === perfilId) || null;
}


function buscarCategoria(categoriaId) {
    return categoriasAdmin.find(
        categoria => String(categoria.id) === String(categoriaId)
    ) || null;
}


function buscarAsignacion(solicitudId) {
    return asignacionesAdmin.find(
        asignacion => asignacion.solicitud_id === solicitudId
    ) || null;
}


/* ==========================================
   FUNCIONES AUXILIARES
   ========================================== */

function agregarCelda(fila, contenido, clase = "") {
    const celda = document.createElement("td");

    celda.textContent = contenido ?? "";

    if (clase) {
        celda.className = clase;
    }

    fila.appendChild(celda);
}


function asignarTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = String(valor);
    }
}


function formatearEstado(estado) {
    if (!estado) return "Sin estado";

    return ESTADOS_SOLICITUD[estado] ||
        estado.replace(/_/g, " ").replace(/\b\w/g, letra =>
            letra.toUpperCase()
        );
}


function claseEstado(estado) {
    return Object.hasOwn(ESTADOS_SOLICITUD, estado)
        ? estado
        : "cerrada";
}


function formatearFecha(fecha) {
    if (!fecha) return "Sin fecha";

    const fechaValida = new Date(fecha);

    if (Number.isNaN(fechaValida.getTime())) {
        return "Fecha no disponible";
    }

    return fechaValida.toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short"
    });
}


function mostrarMensaje(texto, tipo = "info") {
    const mensaje = document.getElementById("mensajeAdmin");

    if (!mensaje) return;

    mensaje.className = `alert alert-${tipo}`;
    mensaje.textContent = texto;
    mensaje.classList.remove("d-none");
}


/* ==========================================
   FUNCIONES DISPONIBLES PARA LA INTERFAZ
   ========================================== */

window.mostrarSolicitudesAdmin = mostrarSolicitudesAdmin;
window.cargarDatosAdmin = cargarDatosAdmin;

