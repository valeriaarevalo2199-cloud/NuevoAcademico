
document.addEventListener("DOMContentLoaded", iniciarAdministracion);

let solicitudesAdmin = [];
let perfilesAdmin = [];
let categoriasAdmin = [];
let asignacionesAdmin = [];
let usuarioAdministrador = null;
let guardandoAsignacionAdmin = false;

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

  conectarEventosAdmin();

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
    .maybeSingle();

  if (errorPerfil) {
    console.error("Error consultando perfil:", errorPerfil);
    mostrarMensaje(
      "No se pudo verificar tu perfil. Revisa los permisos de lectura de perfiles.",
      "danger"
    );
    return;
  }

  if (!perfil || perfil.rol !== "administrador") {
    mostrarMensaje(
      "No tienes permisos para acceder al módulo administrativo.",
      "danger"
    );
    return;
  }

  await cargarDatosAdmin();
}

function conectarEventosAdmin() {
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

  document.getElementById("btnActualizarAdmin")
    ?.addEventListener("click", cargarDatosAdmin);

  document.getElementById("btnActualizarPrincipalAdmin")
    ?.addEventListener("click", cargarDatosAdmin);

  document.getElementById("btnCerrarSesion")
    ?.addEventListener("click", async () => {
      const cliente = window.supabaseClient;
      const { error } = await cliente.auth.signOut();

      if (error) {
        mostrarMensaje("No fue posible cerrar la sesión.", "danger");
        return;
      }

      window.location.href = "login.html";
    });

  document.getElementById("confirmarAsignacionAdmin")
    ?.addEventListener("click", confirmarAsignacionAdmin);
}

async function cargarDatosAdmin() {
  const cliente = window.supabaseClient;
  if (!cliente) return;

  mostrarCargaAdmin(true);
  mostrarMensaje("", "info", true);

  try {
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
      throw new Error(
        "No se pudieron cargar las solicitudes: " +
        resultadoSolicitudes.error.message
      );
    }

    solicitudesAdmin = resultadoSolicitudes.data || [];

    const advertencias = [];

    if (resultadoPerfiles.error) {
      console.error(resultadoPerfiles.error);
      perfilesAdmin = [];
      advertencias.push("No se pudieron consultar los perfiles.");
    } else {
      perfilesAdmin = resultadoPerfiles.data || [];
    }

    if (resultadoCategorias.error) {
      console.error(resultadoCategorias.error);
      categoriasAdmin = [];
      advertencias.push("No se pudieron consultar las categorías.");
    } else {
      categoriasAdmin = resultadoCategorias.data || [];
    }

    if (resultadoAsignaciones.error) {
      console.error(resultadoAsignaciones.error);
      asignacionesAdmin = [];
      advertencias.push("No se pudieron consultar las asignaciones.");
    } else {
      asignacionesAdmin = resultadoAsignaciones.data || [];
    }

    actualizarMetricasAdmin();
    mostrarSolicitudesAdmin();

    if (advertencias.length) {
      mostrarMensaje(
        advertencias.join(" ") +
        " Revisa las políticas RLS de las tablas correspondientes.",
        "warning"
      );
    } else {
      mostrarMensaje(
        `Se cargaron ${solicitudesAdmin.length} solicitudes.`,
        "success"
      );
    }

  } catch (error) {
    console.error("Error en administración:", error);
    mostrarMensaje(error.message || "Error al cargar información.", "danger");

    const tabla = document.getElementById("tablaAdmin");

    if (tabla) {
      tabla.replaceChildren();

      const fila = document.createElement("tr");
      const celda = document.createElement("td");

      celda.colSpan = 7;
      celda.className = "text-center text-danger py-4";
      celda.textContent = "No fue posible cargar las solicitudes.";

      fila.appendChild(celda);
      tabla.appendChild(fila);
    }
  } finally {
    mostrarCargaAdmin(false);
  }
}

function mostrarCargaAdmin(mostrar) {
  document.getElementById("cargandoAdmin")
    ?.classList.toggle("d-none", !mostrar);

  const boton = document.getElementById("btnActualizarAdmin");
  const botonPrincipal = document.getElementById("btnActualizarPrincipalAdmin");

  if (boton) boton.disabled = mostrar;
  if (botonPrincipal) botonPrincipal.disabled = mostrar;
}

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
    solicitudesAdmin.filter(s =>
      ["resuelta", "cerrada"].includes(s.estado)
    ).length
  );
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
    const estudiante = buscarPerfilAdmin(solicitud.estudiante_id);
    const categoria = categoriasAdmin.find(
      c => c.id === solicitud.categoria_id
    );
    const asignacion = obtenerAsignacionAdmin(solicitud.id);
    const funcionario = asignacion
      ? buscarPerfilAdmin(asignacion.funcionario_id)
      : null;

    const nombreEstudiante = nombrePerfilAdmin(estudiante);
    const nombreFuncionario = nombrePerfilAdmin(funcionario);

    const texto = [
      solicitud.radicado,
      solicitud.asunto,
      solicitud.descripcion,
      nombreEstudiante,
      estudiante?.correo,
      categoria?.nombre,
      nombreFuncionario
    ].filter(Boolean).join(" ").toLowerCase();

    return texto.includes(busqueda) &&
      (!estadoSeleccionado || solicitud.estado === estadoSeleccionado);
  });

  tabla.replaceChildren();

  if (!filtradas.length) {
    const fila = document.createElement("tr");
    const celda = document.createElement("td");

    celda.colSpan = 7;
    celda.className = "text-center text-secondary py-4";
    celda.textContent = "No se encontraron solicitudes.";

    fila.appendChild(celda);
    tabla.appendChild(fila);
  } else {
    filtradas.forEach(solicitud => {
      const fila = document.createElement("tr");
      const estudiante = buscarPerfilAdmin(solicitud.estudiante_id);

      agregarCelda(
        fila,
        solicitud.radicado || "Sin radicado"
      );

      agregarCelda(
        fila,
        nombrePerfilAdmin(estudiante) || "Estudiante no disponible"
      );

      agregarCelda(
        fila,
        solicitud.asunto || "Sin asunto"
      );

      agregarCelda(
        fila,
        formatearFechaAdmin(solicitud.created_at)
      );

      agregarCeldaEstadoAdmin(fila, solicitud.estado);
      agregarCeldaAsignacionAdmin(fila, solicitud);

      const celdaAccion = document.createElement("td");
      const boton = document.createElement("button");

      boton.type = "button";
      boton.className = "btn btn-sm btn-outline-primary";
      boton.textContent = "Ver detalle";

      boton.addEventListener("click", () => {
        verDetalleAdmin(solicitud.id);
      });

      celdaAccion.appendChild(boton);
      fila.appendChild(celdaAccion);

      tabla.appendChild(fila);
    });
  }

  asignarTexto("contadorAdmin", `Registros encontrados: ${filtradas.length}`);

  document.getElementById("sinResultadosAdmin")
    ?.classList.toggle("d-none", filtradas.length > 0);
}

function agregarCelda(fila, contenido) {
  const celda = document.createElement("td");
  celda.textContent = contenido;
  fila.appendChild(celda);
}

function agregarCeldaEstadoAdmin(fila, estado) {
  const celda = document.createElement("td");
  const badge = document.createElement("span");

  badge.className = "badge " + claseEstadoAdmin(estado);
  badge.textContent = formatearEstadoAdmin(estado);

  celda.appendChild(badge);
  fila.appendChild(celda);
}

function claseEstadoAdmin(estado) {
  const clases = {
    recibida: "text-bg-info",
    en_revision: "text-bg-primary",
    pendiente_informacion: "text-bg-warning",
    resuelta: "text-bg-success",
    cerrada: "text-bg-secondary"
  };

  return clases[estado] || "text-bg-secondary";
}

function agregarCeldaAsignacionAdmin(fila, solicitud) {
  const celda = document.createElement("td");
  const asignacion = obtenerAsignacionAdmin(solicitud.id);

  if (asignacion) {
    const funcionario = buscarPerfilAdmin(asignacion.funcionario_id);
    const badge = document.createElement("span");

    badge.className = "badge text-bg-success";
    badge.textContent = nombrePerfilAdmin(funcionario) ||
      "Funcionario asignado";

    celda.appendChild(badge);
  } else {
    const badge = document.createElement("span");

    badge.className = "badge text-bg-warning";
    badge.textContent = "Sin asignar";

    celda.appendChild(badge);
  }

  fila.appendChild(celda);

  const celdaAccion = document.createElement("td");
  const boton = document.createElement("button");

  boton.type = "button";
  boton.className = "btn btn-sm btn-primary";
  boton.textContent = asignacion ? "Asignada" : "Asignar";
  boton.disabled = Boolean(asignacion);

  if (asignacion) {
    boton.title = "Esta solicitud ya tiene un funcionario asignado";
  } else {
    boton.addEventListener("click", () => abrirModalAsignacionAdmin(solicitud));
  }

  celdaAccion.appendChild(boton);
  fila.appendChild(celdaAccion);
}

function abrirModalAsignacionAdmin(solicitud) {
  const modalElemento = document.getElementById("modalAsignacionAdmin");
  const selector = document.getElementById("funcionarioAsignacionAdmin");

  if (!modalElemento || !selector || !window.bootstrap?.Modal) {
    mostrarMensaje("No se pudo abrir la ventana de asignación.", "danger");
    return;
  }

  document.getElementById("solicitudSeleccionadaAdmin").value = solicitud.id;

  asignarTexto(
    "radicadoModalAdmin",
    `Radicado: ${solicitud.radicado || "Sin radicado"}`
  );

  selector.replaceChildren();

  const inicial = document.createElement("option");
  inicial.value = "";
  inicial.textContent = "Selecciona un funcionario";
  selector.appendChild(inicial);

  const funcionarios = perfilesAdmin.filter(
    p => p.rol === "funcionario"
  );

  funcionarios.forEach(funcionario => {
    const opcion = document.createElement("option");

    opcion.value = funcionario.id;
    opcion.textContent = nombrePerfilAdmin(funcionario) ||
      funcionario.correo ||
      "Funcionario";

    selector.appendChild(opcion);
  });

  if (!funcionarios.length) {
    mostrarMensaje(
      "No se encontraron funcionarios. Verifica los perfiles y sus permisos de lectura.",
      "warning"
    );
    return;
  }

  const botonConfirmar = document.getElementById("confirmarAsignacionAdmin");
  if (botonConfirmar) botonConfirmar.disabled = false;

  window.bootstrap.Modal
    .getOrCreateInstance(modalElemento)
    .show();
}

async function confirmarAsignacionAdmin() {
  if (guardandoAsignacionAdmin) return;

  const solicitudId =
    document.getElementById("solicitudSeleccionadaAdmin")?.value;

  const funcionarioId =
    document.getElementById("funcionarioAsignacionAdmin")?.value;

  if (!solicitudId || !funcionarioId) {
    mostrarMensaje("Selecciona un funcionario antes de confirmar.", "warning");
    return;
  }

  const asignacionActual = obtenerAsignacionAdmin(solicitudId);

  if (asignacionActual) {
    mostrarMensaje("Esta solicitud ya tiene una asignación.", "warning");
    await cargarDatosAdmin();
    return;
  }

  const funcionario = buscarPerfilAdmin(funcionarioId);

  if (!funcionario || funcionario.rol !== "funcionario") {
    mostrarMensaje("El funcionario seleccionado no es válido.", "danger");
    return;
  }

  if (!window.confirm(
    `¿Asignar la solicitud a ${nombrePerfilAdmin(funcionario)}?`
  )) {
    return;
  }

  const boton = document.getElementById("confirmarAsignacionAdmin");
  const textoOriginal = boton?.textContent;

  guardandoAsignacionAdmin = true;

  if (boton) {
    boton.disabled = true;
    boton.textContent = "Guardando...";
  }

  try {
    const cliente = window.supabaseClient;

    // Comprobar otra vez que no se haya asignado entretanto.
    const { data: existente, error: errorConsulta } = await cliente
      .from("asignaciones")
      .select("id")
      .eq("solicitud_id", solicitudId)
      .maybeSingle();

    if (errorConsulta) throw errorConsulta;

    if (existente) {
      mostrarMensaje(
        "La solicitud ya fue asignada. Actualizando la bandeja.",
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

    mostrarMensaje("Asignación guardada correctamente.", "success");

    // Recargar desde la base de datos para confirmar el resultado.
    await cargarDatosAdmin();

    if (obtenerAsignacionAdmin(solicitudId)) {
      window.bootstrap.Modal
        .getOrCreateInstance(
          document.getElementById("modalAsignacionAdmin")
        )
        .hide();
    }

  } catch (error) {
    console.error("Error al asignar funcionario:", error);

    mostrarMensaje(
      "No fue posible guardar la asignación: " +
      (error.message || "Error desconocido"),
      "danger"
    );
  } finally {
    guardandoAsignacionAdmin = false;

    if (boton) {
      boton.disabled = false;
      boton.textContent = textoOriginal || "Confirmar asignación";
    }
  }
}

function verDetalleAdmin(solicitudId) {
  const solicitud = solicitudesAdmin.find(s => s.id === solicitudId);
  if (!solicitud) return;

  const estudiante = buscarPerfilAdmin(solicitud.estudiante_id);
  const categoria = categoriasAdmin.find(
    c => c.id === solicitud.categoria_id
  );

  const asignacion = obtenerAsignacionAdmin(solicitud.id);
  const funcionario = asignacion
    ? buscarPerfilAdmin(asignacion.funcionario_id)
    : null;

  window.alert([
    `Radicado: ${solicitud.radicado || "Sin radicado"}`,
    `Estudiante: ${nombrePerfilAdmin(estudiante) || "No disponible"}`,
    `Categoría: ${categoria?.nombre || "Sin categoría"}`,
    `Asunto: ${solicitud.asunto || "Sin asunto"}`,
    `Estado: ${formatearEstadoAdmin(solicitud.estado)}`,
    `Responsable: ${nombrePerfilAdmin(funcionario) || "Sin asignar"}`,
    `Fecha: ${formatearFechaAdmin(solicitud.created_at)}`,
    "",
    "Descripción:",
    solicitud.descripcion || "Sin descripción"
  ].join("\n"));
}

function obtenerAsignacionAdmin(solicitudId) {
  return asignacionesAdmin.find(
    a => a.solicitud_id === solicitudId
  );
}

function buscarPerfilAdmin(id) {
  return perfilesAdmin.find(p => p.id === id);
}

function nombrePerfilAdmin(perfil) {
  if (!perfil) return "";

  return `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim() ||
    perfil.correo ||
    "";
}

function formatearEstadoAdmin(estado) {
  return ESTADOS_ADMIN[estado] || estado || "Sin estado";
}

function formatearFechaAdmin(fecha) {
  if (!fecha) return "Sin fecha";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "Sin fecha";

  return valor.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function asignarTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (elemento) elemento.textContent = valor;
}

function mostrarMensaje(texto, tipo = "info", ocultar = false) {
  const mensaje = document.getElementById("mensajeAdmin");
  if (!mensaje) return;

  if (ocultar || !texto) {
    mensaje.classList.add("d-none");
    mensaje.textContent = "";
    return;
  }

  mensaje.className = `alert alert-${tipo}`;
  mensaje.textContent = texto;
  mensaje.classList.remove("d-none");
}

window.cargarDatosAdmin = cargarDatosAdmin;
window.mostrarSolicitudesAdmin = mostrarSolicitudesAdmin;
