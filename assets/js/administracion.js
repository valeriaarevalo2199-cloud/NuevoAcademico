
document.addEventListener("DOMContentLoaded", iniciarAdministracion);

let solicitudesAdmin = [];
let perfilesAdmin = [];
let categoriasAdmin = [];
let asignacionesAdmin = [];
let usuarioAdministrador = null;

const ESTADOS_ADMIN = {
  recibida: "Recibida",
  en_revision: "En revisión",
  pendiente_informacion: "Pendiente de información",
  resuelta: "Resuelta",
  cerrada: "Cerrada"
};

async function iniciarAdministracion() {
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

  usuarioAdministrador = sesionData.session.user;

  const { data: perfil, error: errorPerfil } = await cliente
    .from("perfiles")
    .select("id, nombres, apellidos, correo, rol")
    .eq("id", usuarioAdministrador.id)
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
      const { error } = await cliente.auth.signOut();

      if (error) {
        mostrarMensaje("No fue posible cerrar la sesión.", "danger");
        return;
      }

      window.location.href = "login.html";
    });
  }

  document.getElementById("buscarAdmin")
    ?.addEventListener("input", mostrarSolicitudesAdmin);

  document.getElementById("estadoAdmin")
    ?.addEventListener("change", mostrarSolicitudesAdmin);

  document.getElementById("limpiarAdmin")
    ?.addEventListener("click", () => {
      document.getElementById("buscarAdmin").value = "";
      document.getElementById("estadoAdmin").value = "";
      mostrarSolicitudesAdmin();
    });

  // Botón opcional para actualizar la información.
  document.getElementById("btnActualizarAdmin")
    ?.addEventListener("click", cargarDatosAdmin);

  await cargarDatosAdmin();
}

async function cargarDatosAdmin() {
  const cliente = window.supabaseClient;

  mostrarMensaje("Cargando solicitudes...", "info");

  const [
    resultadoSolicitudes,
    resultadoPerfiles,
    resultadoCategorias,
    resultadoAsignaciones
  ] = await Promise.all([
    cliente
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

    cliente
      .from("perfiles")
      .select("id, nombres, apellidos, correo, rol"),

    cliente
      .from("categorias")
      .select("id, nombre"),

    cliente
      .from("asignaciones")
      .select("id, solicitud_id, funcionario_id, asignado_por, created_at")
  ]);

  if (resultadoSolicitudes.error) {
    console.error(resultadoSolicitudes.error);
    mostrarMensaje(
      "No fue posible cargar las solicitudes: " +
      resultadoSolicitudes.error.message,
      "danger"
    );
    return;
  }

  solicitudesAdmin = resultadoSolicitudes.data || [];

  // Los perfiles y las asignaciones se necesitan para mostrar
  // los nombres y permitir la asignación de funcionarios.
  if (resultadoPerfiles.error) {
    console.error(resultadoPerfiles.error);
    mostrarMensaje(
      "Las solicitudes cargaron, pero no se pudieron consultar los perfiles. Revisa las políticas RLS de perfiles.",
      "warning"
    );
    perfilesAdmin = [];
  } else {
    perfilesAdmin = resultadoPerfiles.data || [];
  }

  if (resultadoCategorias.error) {
    console.error(resultadoCategorias.error);
    categoriasAdmin = [];
  } else {
    categoriasAdmin = resultadoCategorias.data || [];
  }

  if (resultadoAsignaciones.error) {
    console.error(resultadoAsignaciones.error);
    asignacionesAdmin = [];

    mostrarMensaje(
      "No se pudieron consultar las asignaciones. Revisa los permisos RLS de asignaciones.",
      "warning"
    );
  } else {
    asignacionesAdmin = resultadoAsignaciones.data || [];
  }

  actualizarMetricasAdmin();
  llenarFiltroEstados();
  mostrarSolicitudesAdmin();

  if (
    !resultadoPerfiles.error &&
    !resultadoCategorias.error &&
    !resultadoAsignaciones.error
  ) {
    mostrarMensaje(
      `Se cargaron ${solicitudesAdmin.length} solicitudes.`,
      "success"
    );
  }
}

function actualizarMetricasAdmin() {
  const total = solicitudesAdmin.length;

  const recibidas = solicitudesAdmin.filter(
    s => s.estado === "recibida"
  ).length;

  const enRevision = solicitudesAdmin.filter(
    s => s.estado === "en_revision"
  ).length;

  const pendientes = solicitudesAdmin.filter(
    s => s.estado === "pendiente_informacion"
  ).length;

  const resueltas = solicitudesAdmin.filter(
    s => ["resuelta", "cerrada"].includes(s.estado)
  ).length;

  asignarTexto("totalSolicitudesAdmin", total);
  asignarTexto("recibidasAdmin", recibidas);
  asignarTexto("revisionAdmin", enRevision);
  asignarTexto("resueltasAdmin", resueltas);
  asignarTexto("pendientesAdmin", pendientes);
}

function llenarFiltroEstados() {
  const filtro = document.getElementById("estadoAdmin");
  if (!filtro) return;

  const valorActual = filtro.value;
  const estados = [...new Set(
    solicitudesAdmin.map(s => s.estado).filter(Boolean)
  )];

  filtro.replaceChildren();

  const opcionTodos = document.createElement("option");
  opcionTodos.value = "";
  opcionTodos.textContent = "Todos los estados";
  filtro.appendChild(opcionTodos);

  estados.forEach(estado => {
    const opcion = document.createElement("option");
    opcion.value = estado;
    opcion.textContent = formatearEstado(estado);
    filtro.appendChild(opcion);
  });

  filtro.value = estados.includes(valorActual) ? valorActual : "";
}

function mostrarSolicitudesAdmin() {
  const tabla = document.getElementById("tablaAdmin");
  if (!tabla) return;

  const busqueda = (
    document.getElementById("buscarAdmin")?.value || ""
  ).trim().toLowerCase();

  const estadoSeleccionado =
    document.getElementById("estadoAdmin")?.value || "";

  const filtradas = solicitudesAdmin.filter(solicitud => {
    const perfil = perfilesAdmin.find(
      p => p.id === solicitud.estudiante_id
    );

    const categoria = categoriasAdmin.find(
      c => c.id === solicitud.categoria_id
    );

    const asignacion = obtenerAsignacionAdmin(solicitud.id);

    const funcionario = asignacion
      ? perfilesAdmin.find(p => p.id === asignacion.funcionario_id)
      : null;

    const nombre = perfil
      ? `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim()
      : "Estudiante no disponible";

    const nombreFuncionario = funcionario
      ? `${funcionario.nombres || ""} ${funcionario.apellidos || ""}`.trim()
      : "";

    const texto = [
      solicitud.radicado,
      solicitud.asunto,
      solicitud.descripcion,
      nombre,
      perfil?.correo,
      categoria?.nombre,
      nombreFuncionario
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

    celda.colSpan = 7;
    celda.className = "text-center text-muted py-4";
    celda.textContent = "No se encontraron solicitudes.";

    fila.appendChild(celda);
    tabla.appendChild(fila);
  } else {
    filtradas.forEach(solicitud => {
      const perfil = perfilesAdmin.find(
        p => p.id === solicitud.estudiante_id
      );

      const nombre = perfil
        ? `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim()
        : "Estudiante no disponible";

      const fila = document.createElement("tr");

      agregarCelda(fila, solicitud.radicado || "Sin radicado");
      agregarCelda(fila, nombre);
      agregarCelda(fila, solicitud.asunto || "Sin asunto");
      agregarCelda(fila, formatearFecha(solicitud.created_at));
      agregarCeldaEstado(fila, solicitud.estado);
      agregarCeldaAsignacion(fila, solicitud);

      const celdaDetalle = document.createElement("td");
      const botonDetalle = document.createElement("button");

      botonDetalle.type = "button";
      botonDetalle.className = "btn btn-sm btn-outline-primary";
      botonDetalle.textContent = "Ver detalle";

      botonDetalle.addEventListener("click", () => {
        verDetalleAdmin(solicitud.id);
      });

      celdaDetalle.appendChild(botonDetalle);
      fila.appendChild(celdaDetalle);
      tabla.appendChild(fila);
    });
  }

  asignarTexto(
    "contadorAdmin",
    `Registros encontrados: ${filtradas.length}`
  );

  document.getElementById("sinResultadosAdmin")
    ?.classList.toggle("d-none", filtradas.length > 0);
}

function agregarCeldaEstado(fila, estado) {
  const celda = document.createElement("td");
  const etiqueta = document.createElement("span");

  etiqueta.className = "badge " + claseEstado(estado);
  etiqueta.textContent = formatearEstado(estado);

  celda.appendChild(etiqueta);
  fila.appendChild(celda);
}

function claseEstado(estado) {
  const clases = {
    recibida: "text-bg-info",
    en_revision: "text-bg-primary",
    pendiente_informacion: "text-bg-warning",
    resuelta: "text-bg-success",
    cerrada: "text-bg-secondary"
  };

  return clases[estado] || "text-bg-secondary";
}

function agregarCeldaAsignacion(fila, solicitud) {
  const celda = document.createElement("td");
  const asignacion = obtenerAsignacionAdmin(solicitud.id);

  if (asignacion) {
    const funcionario = perfilesAdmin.find(
      p => p.id === asignacion.funcionario_id
    );

    const nombre = funcionario
      ? `${funcionario.nombres || ""} ${funcionario.apellidos || ""}`.trim()
      : "Funcionario asignado";

    const texto = document.createElement("span");
    texto.textContent = nombre;
    celda.appendChild(texto);
  } else {
    const funcionarios = perfilesAdmin.filter(
      p => p.rol === "funcionario"
    );

    if (funcionarios.length === 0) {
      celda.textContent = "No hay funcionarios disponibles";
    } else {
      const selector = document.createElement("select");
      selector.className = "form-select form-select-sm mb-2";
      selector.setAttribute("aria-label", "Seleccionar funcionario");

      const inicial = document.createElement("option");
      inicial.value = "";
      inicial.textContent = "Seleccionar funcionario";
      selector.appendChild(inicial);

      funcionarios.forEach(funcionario => {
        const opcion = document.createElement("option");
        opcion.value = funcionario.id;
        opcion.textContent =
          `${funcionario.nombres || ""} ${funcionario.apellidos || ""}`.trim() ||
          funcionario.correo ||
          "Funcionario";

        selector.appendChild(opcion);
      });

      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-sm btn-primary";
      boton.textContent = "Asignar";

      boton.addEventListener("click", async () => {
        if (!selector.value) {
          mostrarMensaje(
            "Selecciona un funcionario antes de asignar.",
            "warning"
          );
          return;
        }

        await asignarFuncionarioAdmin(
          solicitud.id,
          selector.value,
          boton
        );
      });

      celda.append(selector, boton);
    }
  }

  fila.appendChild(celda);
}

function obtenerAsignacionAdmin(solicitudId) {
  return asignacionesAdmin.find(
    a => a.solicitud_id === solicitudId
  );
}

async function asignarFuncionarioAdmin(
  solicitudId,
  funcionarioId,
  boton
) {
  const cliente = window.supabaseClient;

  if (!usuarioAdministrador) {
    mostrarMensaje("La sesión administrativa no está disponible.", "danger");
    return;
  }

  if (obtenerAsignacionAdmin(solicitudId)) {
    mostrarMensaje("Esta solicitud ya tiene un funcionario asignado.", "warning");
    await cargarDatosAdmin();
    return;
  }

  const confirmar = window.confirm(
    "¿Confirmas la asignación de esta solicitud al funcionario seleccionado?"
  );

  if (!confirmar) return;

  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Asignando...";

  try {
    // Verificar de nuevo para reducir el riesgo de duplicados.
    const { data: existente, error: errorConsulta } = await cliente
      .from("asignaciones")
      .select("id")
      .eq("solicitud_id", solicitudId)
      .maybeSingle();

    if (errorConsulta) throw errorConsulta;

    if (existente) {
      mostrarMensaje(
        "La solicitud ya fue asignada. Actualizando la información.",
        "warning"
      );
      await cargarDatosAdmin();
      return;
    }

    const { error } = await cliente
      .from("asignaciones")
      .insert({
        solicitud_id: solicitudId,
        funcionario_id: funcionarioId,
        asignado_por: usuarioAdministrador.id
      });

    if (error) throw error;

    mostrarMensaje("Funcionario asignado correctamente.", "success");
    await cargarDatosAdmin();

  } catch (error) {
    console.error("Error al asignar funcionario:", error);

    mostrarMensaje(
      "No fue posible asignar la solicitud: " +
      (error.message || "error desconocido"),
      "danger"
    );
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

function verDetalleAdmin(solicitudId) {
  const solicitud = solicitudesAdmin.find(s => s.id === solicitudId);
  if (!solicitud) return;

  const perfil = perfilesAdmin.find(
    p => p.id === solicitud.estudiante_id
  );

  const categoria = categoriasAdmin.find(
    c => c.id === solicitud.categoria_id
  );

  const asignacion = obtenerAsignacionAdmin(solicitud.id);

  const funcionario = asignacion
    ? perfilesAdmin.find(p => p.id === asignacion.funcionario_id)
    : null;

  const nombreEstudiante = perfil
    ? `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim()
    : "No disponible";

  const nombreFuncionario = funcionario
    ? `${funcionario.nombres || ""} ${funcionario.apellidos || ""}`.trim()
    : "Sin asignar";

  window.alert([
    `Radicado: ${solicitud.radicado || "Sin radicado"}`,
    `Estudiante: ${nombreEstudiante}`,
    `Categoría: ${categoria?.nombre || "Sin categoría"}`,
    `Asunto: ${solicitud.asunto || "Sin asunto"}`,
    `Estado: ${formatearEstado(solicitud.estado)}`,
    `Funcionario: ${nombreFuncionario}`,
    `Fecha: ${formatearFecha(solicitud.created_at)}`,
    "",
    "Descripción:",
    solicitud.descripcion || "Sin descripción"
  ].join("\n"));
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
  return ESTADOS_ADMIN[estado] ||
    (estado || "Sin estado")
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

function mostrarMensaje(texto, tipo = "info") {
  const mensaje = document.getElementById("mensajeAdmin");

  if (!mensaje) {
    console.log(texto);
    return;
  }

  mensaje.className = `alert alert-${tipo}`;
  mensaje.textContent = texto;
  mensaje.classList.remove("d-none");
}

window.mostrarSolicitudesAdmin = mostrarSolicitudesAdmin;
window.cargarDatosAdmin = cargarDatosAdmin;
