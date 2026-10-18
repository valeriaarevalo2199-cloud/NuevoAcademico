
"use strict";

const cliente = window.supabaseClient;

const elementos = {
  mensaje: document.getElementById("mensajeSistema"),
  estadoCarga: document.getElementById("estadoCarga"),
  nombreAdmin: document.getElementById("adminNombre"),
  btnActualizar: document.getElementById("btnActualizar"),
  btnCerrarSesion: document.getElementById("btnCerrarSesion"),
  total: document.getElementById("totalSolicitudes"),
  recibidas: document.getElementById("totalRecibidas"),
  revision: document.getElementById("totalRevision"),
  resueltas: document.getElementById("totalResueltas"),
  contador: document.getElementById("contadorRegistros"),
  buscar: document.getElementById("buscarSolicitud"),
  filtro: document.getElementById("filtroEstado"),
  tabla: document.getElementById("tablaSolicitudes")
};

let solicitudes = [];
let funcionarios = [];
let categorias = [];
let asignaciones = [];
let cargando = false;

function mostrarMensaje(texto, tipo = "info") {
  elementos.mensaje.textContent = texto;
  elementos.mensaje.className = `alert alert-${tipo}`;
  elementos.mensaje.classList.remove("d-none");
}

function ocultarMensaje() {
  elementos.mensaje.textContent = "";
  elementos.mensaje.className = "alert d-none";
}

function nombreCompleto(perfil) {
  const nombre = [
    perfil.nombres || "",
    perfil.apellidos || ""
  ].join(" ").trim();

  return nombre || perfil.correo || "Usuario sin nombre";
}

function formatearFecha(fecha) {
  if (!fecha) return "—";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "—";

  return valor.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function nombreEstado(estado) {
  const estados = {
    recibida: "Recibida",
    en_revision: "En revisión",
    pendiente_informacion: "Pendiente de información",
    resuelta: "Resuelta",
    cerrada: "Cerrada"
  };

  return estados[estado] || estado || "Sin estado";
}

function crearCelda(texto) {
  const celda = document.createElement("td");
  celda.textContent = texto ?? "—";
  return celda;
}

function buscarCategoria(id) {
  return categorias.find(categoria => categoria.id === id);
}

function buscarFuncionario(id) {
  return funcionarios.find(funcionario => funcionario.id === id);
}

function buscarAsignacion(idSolicitud) {
  return asignaciones.find(
    asignacion => asignacion.solicitud_id === idSolicitud
  );
}

function crearSelectFuncionario(solicitud, asignacionActual) {
  const contenedor = document.createElement("div");
  contenedor.className = "d-flex flex-column gap-2";

  if (asignacionActual) {
    const funcionario = buscarFuncionario(
      asignacionActual.funcionario_id
    );

    const nombre = funcionario
      ? nombreCompleto(funcionario)
      : "Funcionario asignado";

    const etiqueta = document.createElement("span");
    etiqueta.className = "fw-semibold";
    etiqueta.textContent = nombre;

    const nota = document.createElement("small");
    nota.className = "text-muted";
    nota.textContent = "Esta solicitud ya tiene una asignación.";

    contenedor.append(etiqueta, nota);
    return contenedor;
  }

  if (funcionarios.length === 0) {
    const aviso = document.createElement("span");
    aviso.className = "text-danger small";
    aviso.textContent = "No hay funcionarios disponibles.";
    contenedor.appendChild(aviso);
    return contenedor;
  }

  const selector = document.createElement("select");
  selector.className = "form-select form-select-sm";
  selector.setAttribute("aria-label", "Seleccionar funcionario");

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.textContent = "Selecciona un funcionario";
  selector.appendChild(opcionInicial);

  funcionarios.forEach(funcionario => {
    const opcion = document.createElement("option");
    opcion.value = funcionario.id;
    opcion.textContent = nombreCompleto(funcionario);
    selector.appendChild(opcion);
  });

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "btn btn-primary btn-sm";
  boton.textContent = "Asignar funcionario";

  boton.addEventListener("click", async () => {
    const funcionarioId = selector.value;

    if (!funcionarioId) {
      mostrarMensaje(
        "Selecciona un funcionario antes de asignar la solicitud.",
        "warning"
      );
      return;
    }

    if (cargando) return;

    const funcionarioElegido = buscarFuncionario(funcionarioId);

    if (!funcionarioElegido) {
      mostrarMensaje(
        "El funcionario seleccionado no está disponible. Actualiza la información.",
        "warning"
      );
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas asignar la solicitud ${solicitud.radicado} a ` +
      `${nombreCompleto(funcionarioElegido)}?`
    );

    if (!confirmar) return;

    await asignarSolicitud(solicitud, funcionarioId, boton);
  });

  contenedor.append(selector, boton);
  return contenedor;
}

function renderizarTabla() {
  const busqueda = elementos.buscar.value.trim().toLowerCase();
  const estadoSeleccionado = elementos.filtro.value;

  const filtradas = solicitudes.filter(solicitud => {
    const perfil = perfilesEstudiantes.get(solicitud.estudiante_id);
    const categoria = buscarCategoria(solicitud.categoria_id);

    const texto = [
      solicitud.radicado,
      perfil ? nombreCompleto(perfil) : "",
      categoria?.nombre || "",
      solicitud.asunto || "",
      solicitud.descripcion || ""
    ].join(" ").toLowerCase();

    const coincideBusqueda = texto.includes(busqueda);
    const coincideEstado =
      !estadoSeleccionado || solicitud.estado === estadoSeleccionado;

    return coincideBusqueda && coincideEstado;
  });

  elementos.tabla.replaceChildren();
  elementos.contador.textContent = `Registros: ${filtradas.length}`;

  if (filtradas.length === 0) {
    const fila = document.createElement("tr");
    const celda = crearCelda(
      solicitudes.length
        ? "No hay solicitudes que coincidan con los filtros."
        : "Todavía no hay solicitudes registradas."
    );

    celda.colSpan = 7;
    celda.className = "text-center text-muted py-4";
    fila.appendChild(celda);
    elementos.tabla.appendChild(fila);
    return;
  }

  filtradas.forEach(solicitud => {
    const fila = document.createElement("tr");

    const estudiante = perfilesEstudiantes.get(solicitud.estudiante_id);
    const categoria = buscarCategoria(solicitud.categoria_id);
    const asignacion = buscarAsignacion(solicitud.id);

    fila.appendChild(crearCelda(solicitud.radicado));
    fila.appendChild(
      crearCelda(estudiante ? nombreCompleto(estudiante) : "Estudiante")
    );
    fila.appendChild(crearCelda(categoria?.nombre || "Sin categoría"));
    fila.appendChild(crearCelda(solicitud.asunto || "Sin asunto"));

    const celdaEstado = document.createElement("td");
    const insignia = document.createElement("span");
    insignia.className = "badge text-bg-secondary";
    insignia.textContent = nombreEstado(solicitud.estado);
    celdaEstado.appendChild(insignia);
    fila.appendChild(celdaEstado);

    fila.appendChild(crearCelda(formatearFecha(solicitud.created_at)));

    const celdaFuncionario = document.createElement("td");
    celdaFuncionario.appendChild(
      crearSelectFuncionario(solicitud, asignacion)
    );
    fila.appendChild(celdaFuncionario);

    elementos.tabla.appendChild(fila);
  });
}

const perfilesEstudiantes = new Map();

function actualizarResumen() {
  elementos.total.textContent = solicitudes.length;

  elementos.recibidas.textContent = solicitudes.filter(
    solicitud => solicitud.estado === "recibida"
  ).length;

  elementos.revision.textContent = solicitudes.filter(
    solicitud => solicitud.estado === "en_revision"
  ).length;

  elementos.resueltas.textContent = solicitudes.filter(
    solicitud => solicitud.estado === "resuelta"
  ).length;
}

async function verificarAdministrador() {
  const { data: sesionData, error: errorSesion } =
    await cliente.auth.getSession();

  if (errorSesion) throw errorSesion;

  const usuario = sesionData.session?.user;

  if (!usuario) {
    window.location.href = "login.html";
    return null;
  }

  const { data: perfil, error } = await cliente
    .from("perfiles")
    .select("id, nombres, apellidos, correo, rol")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) throw error;

  if (!perfil || perfil.rol !== "administrador") {
    mostrarMensaje(
      "No tienes permisos para acceder al módulo administrativo.",
      "danger"
    );

    await cliente.auth.signOut();
    window.location.href = "login.html";
    return null;
  }

  elementos.nombreAdmin.textContent = nombreCompleto(perfil);
  return usuario;
}

async function cargarDatos() {
  if (cargando) return;

  cargando = true;
  elementos.btnActualizar.disabled = true;
  elementos.estadoCarga.textContent = "Consultando Supabase...";
  ocultarMensaje();

  try {
    const resultados = await Promise.all([
      cliente
        .from("solicitudes")
        .select(
          "id, radicado, estudiante_id, categoria_id, asunto, descripcion, estado, created_at"
        )
        .order("created_at", { ascending: false }),

      cliente
        .from("perfiles")
        .select("id, nombres, apellidos, correo, rol")
        .eq("rol", "funcionario"),

      cliente
        .from("categorias")
        .select("id, nombre, activa"),

      cliente
        .from("asignaciones")
        .select("id, solicitud_id, funcionario_id, asignado_por, created_at")
    ]);

    const nombresConsultas = [
      "solicitudes",
      "perfiles de funcionarios",
      "categorías",
      "asignaciones"
    ];

    for (let i = 0; i < resultados.length; i++) {
      if (resultados[i].error) {
        console.error(
          `Error consultando ${nombresConsultas[i]}:`,
          resultados[i].error
        );
        throw new Error(
          `No se pudo consultar ${nombresConsultas[i]}: ` +
          resultados[i].error.message
        );
      }
    }

    solicitudes = resultados[0].data || [];
    funcionarios = resultados[1].data || [];
    categorias = (resultados[2].data || []).filter(
      categoria => categoria.activa !== false
    );
    asignaciones = resultados[3].data || [];

    const idsEstudiantes = [
      ...new Set(solicitudes.map(solicitud => solicitud.estudiante_id))
    ].filter(Boolean);

    perfilesEstudiantes.clear();

    if (idsEstudiantes.length > 0) {
      const { data: estudiantes, error: errorEstudiantes } = await cliente
        .from("perfiles")
        .select("id, nombres, apellidos, correo, rol")
        .in("id", idsEstudiantes);

      if (errorEstudiantes) {
        console.error("Error consultando estudiantes:", errorEstudiantes);
        throw new Error(
          "No se pudieron consultar los perfiles de los estudiantes: " +
          errorEstudiantes.message
        );
      }

      (estudiantes || []).forEach(estudiante => {
        perfilesEstudiantes.set(estudiante.id, estudiante);
      });
    }

    actualizarResumen();
    renderizarTabla();

    elementos.estadoCarga.textContent =
      `Se cargaron ${solicitudes.length} solicitudes y ` +
      `${funcionarios.length} funcionarios.`;

    if (funcionarios.length === 0) {
      mostrarMensaje(
        "Las solicitudes se cargaron, pero no se encontraron funcionarios. " +
        "Verifica que exista al menos un perfil con rol exactamente igual a " +
        "'funcionario' y que el administrador tenga permiso para consultar perfiles.",
        "warning"
      );
    } else {
      mostrarMensaje(
        "Información cargada correctamente. Funcionarios disponibles: " +
        funcionarios.length + ".",
        "success"
      );
    }
  } catch (error) {
    console.error("Error al cargar administración:", error);

    elementos.estadoCarga.textContent = "No se pudo cargar toda la información.";

    mostrarMensaje(
      error.message || "Ocurrió un error al consultar Supabase.",
      "danger"
    );

    elementos.tabla.replaceChildren();

    const fila = document.createElement("tr");
    const celda = crearCelda(
      "No se pudieron cargar los datos. Revisa el mensaje anterior."
    );
    celda.colSpan = 7;
    celda.className = "text-center text-danger py-4";
    fila.appendChild(celda);
    elementos.tabla.appendChild(fila);
  } finally {
    cargando = false;
    elementos.btnActualizar.disabled = false;
  }
}

async function asignarSolicitud(solicitud, funcionarioId, boton) {
  boton.disabled = true;
  boton.textContent = "Asignando...";
  ocultarMensaje();

  try {
    // Verificar que la solicitud no haya sido asignada previamente.
    const { data: existentes, error: errorExistentes } = await cliente
      .from("asignaciones")
      .select("id, funcionario_id")
      .eq("solicitud_id", solicitud.id);

    if (errorExistentes) {
      throw new Error(
        "No se pudo verificar si la solicitud ya está asignada: " +
        errorExistentes.message
      );
    }

    if (existentes && existentes.length > 0) {
      await cargarDatos();

      mostrarMensaje(
        "Esta solicitud ya tiene una asignación. Se actualizó la información.",
        "warning"
      );
      return;
    }

    const { data: usuarioData, error: errorUsuario } =
      await cliente.auth.getUser();

    if (errorUsuario) throw errorUsuario;

    const usuario = usuarioData.user;

    if (!usuario) {
      throw new Error("La sesión expiró. Inicia sesión nuevamente.");
    }

    const { error: errorInsertar } = await cliente
      .from("asignaciones")
      .insert({
        solicitud_id: solicitud.id,
        funcionario_id: funcionarioId,
        asignado_por: usuario.id
      });

    if (errorInsertar) {
      console.error("Error de Supabase al asignar:", errorInsertar);

      throw new Error(
        "Supabase no permitió guardar la asignación: " +
        errorInsertar.message +
        (errorInsertar.code ? ` (código ${errorInsertar.code})` : "")
      );
    }

    await cargarDatos();

    mostrarMensaje(
      `La solicitud ${solicitud.radicado} fue asignada correctamente.`,
      "success"
    );
  } catch (error) {
    console.error("Error al asignar funcionario:", error);

    mostrarMensaje(
      error.message || "No se pudo asignar el funcionario.",
      "danger"
    );
  } finally {
    boton.disabled = false;
    boton.textContent = "Asignar funcionario";
  }
}

async function cerrarSesion() {
  elementos.btnCerrarSesion.disabled = true;

  const { error } = await cliente.auth.signOut();

  if (error) {
    console.error("Error al cerrar sesión:", error);
    mostrarMensaje(
      "No se pudo cerrar la sesión: " + error.message,
      "danger"
    );
    elementos.btnCerrarSesion.disabled = false;
    return;
  }

  window.location.href = "login.html";
}

async function iniciarModulo() {
  if (!cliente) {
    mostrarMensaje(
      "No se encontró el cliente de Supabase. Revisa el orden de los scripts en el HTML.",
      "danger"
    );
    return;
  }

  try {
    const usuario = await verificarAdministrador();

    if (!usuario) return;

    elementos.btnActualizar.addEventListener("click", cargarDatos);
    elementos.buscar.addEventListener("input", renderizarTabla);
    elementos.filtro.addEventListener("change", renderizarTabla);
    elementos.btnCerrarSesion.addEventListener("click", cerrarSesion);

    await cargarDatos();
  } catch (error) {
    console.error("Error al iniciar el módulo:", error);

    mostrarMensaje(
      "No se pudo iniciar el módulo administrativo: " +
      error.message,
      "danger"
    );

    elementos.estadoCarga.textContent = "Error de inicio.";
  }
}

iniciarModulo();

