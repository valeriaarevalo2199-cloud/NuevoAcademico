
document.addEventListener("DOMContentLoaded", iniciarAdministracion);

let solicitudesAdmin = [];
let perfilesAdmin = [];
let categoriasAdmin = [];

async function iniciarAdministracion() {
  const mensaje = document.getElementById("mensajeAdmin");
  const tabla = document.getElementById("tablaSolicitudesAdmin");
  const cliente = window.supabaseClient;

  if (!cliente) {
    mostrarMensaje("No se pudo conectar con Supabase.", "danger");
    return;
  }

  const { data: sesionData, error: sesionError } =
    await cliente.auth.getSession();

  if (sesionError || !sesionData?.session) {
    window.location.href = "login.html";
    return;
  }

  const usuario = sesionData.session.user;

  // Comprobar el rol directamente en la base de datos.
  const { data: perfil, error: errorPerfil } = await cliente
    .from("perfiles")
    .select("rol")
    .eq("id", usuario.id)
    .single();

  if (errorPerfil || perfil?.rol !== "administrador") {
    mostrarMensaje(
      "No tienes permisos para acceder al módulo administrativo.",
      "danger"
    );
    return;
  }

  const botonCerrar = document.getElementById("btnCerrarSesion");

  if (botonCerrar) {
    botonCerrar.addEventListener("click", async () => {
      await cliente.auth.signOut();
      window.location.href = "login.html";
    });
  }

  await cargarDatosAdmin();
}

async function cargarDatosAdmin() {
  mostrarMensaje("Cargando solicitudes...", "info");

  const cliente = window.supabaseClient;

  const [resultadoSolicitudes, resultadoPerfiles, resultadoCategorias] =
    await Promise.all([
      cliente
        .from("solicitudes")
        .select(
          "id, radicado, estudiante_id, categoria_id, asunto, descripcion, estado, created_at, updated_at"
        )
        .order("created_at", { ascending: false }),

      cliente
        .from("perfiles")
        .select("id, nombres, apellidos, correo, rol"),

      cliente
        .from("categorias")
        .select("id, nombre")
    ]);

  const error =
    resultadoSolicitudes.error ||
    resultadoPerfiles.error ||
    resultadoCategorias.error;

  if (error) {
    console.error("Error al cargar administración:", error);

    mostrarMensaje(
      "No fue posible cargar los datos. Verifica las políticas de acceso de Supabase.",
      "danger"
    );
    return;
  }

  solicitudesAdmin = resultadoSolicitudes.data || [];
  perfilesAdmin = resultadoPerfiles.data || [];
  categoriasAdmin = resultadoCategorias.data || [];

  actualizarMetricasAdmin();
  llenarFiltroEstados();
  mostrarSolicitudesAdmin();

  mostrarMensaje(
    `Se cargaron ${solicitudesAdmin.length} solicitudes.`,
    "success"
  );
}

function actualizarMetricasAdmin() {
  const total = solicitudesAdmin.length;

  const recibidas = solicitudesAdmin.filter(
    s => s.estado === "recibida"
  ).length;

  const enRevision = solicitudesAdmin.filter(
    s => s.estado === "en_revision"
  ).length;

  const resueltas = solicitudesAdmin.filter(
    s => s.estado === "resuelta"
  ).length;

  asignarTexto("totalSolicitudesAdmin", total);
  asignarTexto("recibidasAdmin", recibidas);
  asignarTexto("revisionAdmin", enRevision);
  asignarTexto("resueltasAdmin", resueltas);
}

function llenarFiltroEstados() {
  const filtro = document.getElementById("estadoAdmin");

  if (!filtro) return;

  const estados = [...new Set(
    solicitudesAdmin
      .map(s => s.estado)
      .filter(Boolean)
  )];

  filtro.innerHTML = '<option value="">Todos los estados</option>';

  estados.forEach(estado => {
    const opcion = document.createElement("option");
    opcion.value = estado;
    opcion.textContent = formatearEstado(estado);
    filtro.appendChild(opcion);
  });
}

function mostrarSolicitudesAdmin() {
  const tabla = document.getElementById("tablaSolicitudesAdmin");
  const busqueda = (
    document.getElementById("buscarAdmin")?.value || ""
  ).trim().toLowerCase();

  const estadoSeleccionado =
    document.getElementById("estadoAdmin")?.value || "";

  if (!tabla) return;

  const filtradas = solicitudesAdmin.filter(solicitud => {
    const perfil = perfilesAdmin.find(
      p => p.id === solicitud.estudiante_id
    );

    const categoria = categoriasAdmin.find(
      c => c.id === solicitud.categoria_id
    );

    const nombre = perfil
      ? `${perfil.nombres || ""} ${perfil.apellidos || ""}`
      : "";

    const texto = [
      solicitud.radicado,
      solicitud.asunto,
      solicitud.descripcion,
      nombre,
      perfil?.correo,
      categoria?.nombre
    ].filter(Boolean).join(" ").toLowerCase();

    return (
      texto.includes(busqueda) &&
      (!estadoSeleccionado || solicitud.estado === estadoSeleccionado)
    );
  });

  tabla.replaceChildren();

  if (filtradas.length === 0) {
    const fila = document.createElement("tr");
    const celda = document.createElement("td");

    celda.colSpan = 6;
    celda.className = "text-center text-muted py-4";
    celda.textContent = "No se encontraron solicitudes.";

    fila.appendChild(celda);
    tabla.appendChild(fila);
  } else {
    filtradas.forEach(solicitud => {
      const perfil = perfilesAdmin.find(
        p => p.id === solicitud.estudiante_id
      );

      const categoria = categoriasAdmin.find(
        c => c.id === solicitud.categoria_id
      );

      const nombre = perfil
        ? `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim()
        : "Estudiante no disponible";

      const fila = document.createElement("tr");

      agregarCelda(fila, solicitud.radicado || "Sin radicado");
      agregarCelda(fila, nombre);
      agregarCelda(fila, categoria?.nombre || "Sin categoría");
      agregarCelda(fila, solicitud.asunto || "Sin asunto");
      agregarCelda(fila, formatearEstado(solicitud.estado));
      agregarCelda(fila, formatearFecha(solicitud.created_at));

      tabla.appendChild(fila);
    });
  }

  asignarTexto("contadorAdmin", filtradas.length);

  const sinResultados = document.getElementById("sinResultadosAdmin");

  if (sinResultados) {
    sinResultados.classList.toggle("d-none", filtradas.length > 0);
  }
}

function agregarCelda(fila, contenido) {
  const celda = document.createElement("td");
  celda.textContent = contenido;
  fila.appendChild(celda);
}

function asignarTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = valor;
  }
}

function formatearEstado(estado) {
  if (!estado) return "Sin estado";

  return estado
    .replace(/_/g, " ")
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  return new Date(fecha).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function mostrarMensaje(texto, tipo) {
  const mensaje = document.getElementById("mensajeAdmin");

  if (!mensaje) return;

  mensaje.className = `alert alert-${tipo}`;
  mensaje.textContent = texto;
  mensaje.classList.remove("d-none");
}

// Funciones disponibles para los filtros del HTML.
window.mostrarSolicitudesAdmin = mostrarSolicitudesAdmin;
window.cargarDatosAdmin = cargarDatosAdmin;
