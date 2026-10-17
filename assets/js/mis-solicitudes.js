
document.addEventListener("DOMContentLoaded", iniciarMisSolicitudes);

async function iniciarMisSolicitudes() {
  const client = window.supabaseClient;

  const mensajePagina = document.getElementById("mensajePagina");
  const estadoCarga = document.getElementById("estadoCarga");
  const contenedorTabla = document.getElementById("contenedorTabla");
  const tabla = document.getElementById("tablaSolicitudes");
  const buscador = document.getElementById("buscar");
  const filtroEstado = document.getElementById("filtroEstado");
  const filtroCategoria = document.getElementById("filtroCategoria");
  const limpiarFiltros = document.getElementById("limpiarFiltros");
  const sinResultados = document.getElementById("sinResultados");
  const contadorResultados = document.getElementById("contadorResultados");
  const botonCerrarSesion = document.getElementById("btnCerrarSesion");

  const modalElemento = document.getElementById("modalDetalle");
  const modalDetalle = bootstrap.Modal.getOrCreateInstance(modalElemento);

  let solicitudes = [];
  let categorias = [];
  let usuarioActual = null;

  function mostrarMensaje(tipo, texto) {
    mensajePagina.className = `alert alert-${tipo}`;
    mensajePagina.textContent = texto;
  }

  function ocultarMensaje() {
    mensajePagina.className = "alert d-none";
    mensajePagina.textContent = "";
  }

  function normalizar(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function fechaLegible(valor) {
    if (!valor) return "No disponible";

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "No disponible";

    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(fecha);
  }

  function fechaHoraLegible(valor) {
    if (!valor) return "No disponible";

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "No disponible";

    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(fecha);
  }

  function nombreEstado(estado) {
    const nombres = {
      recibida: "Recibida",
      "en revisión": "En revisión",
      "en revision": "En revisión",
      "en proceso": "En proceso",
      "pendiente de información": "Pendiente de información",
      "pendiente de informacion": "Pendiente de información",
      resuelta: "Resuelta",
      finalizada: "Finalizada",
      cerrada: "Cerrada",
      rechazada: "Rechazada"
    };

    return nombres[normalizar(estado)] || estado || "Sin estado";
  }

  function claseEstado(estado) {
    const valor = normalizar(estado);

    if (valor === "recibida") return "text-bg-info";
    if (valor.includes("revision") || valor === "en proceso") return "text-bg-primary";
    if (valor.includes("pendiente")) return "text-bg-warning";
    if (["resuelta", "finalizada", "cerrada"].includes(valor)) return "text-bg-success";
    if (valor === "rechazada") return "text-bg-danger";

    return "text-bg-secondary";
  }

  function agregarCelda(fila, contenido) {
    const celda = document.createElement("td");
    celda.textContent = contenido;
    fila.appendChild(celda);
    return celda;
  }

  function obtenerCategoria(id) {
    const categoria = categorias.find((item) => item.id === id);
    return categoria ? categoria.nombre : "Categoría no disponible";
  }

  function cargarFiltros() {
    const estados = [...new Set(
      solicitudes.map((solicitud) => nombreEstado(solicitud.estado))
    )].sort((a, b) => a.localeCompare(b, "es"));

    estados.forEach((estado) => {
      const opcion = document.createElement("option");
      opcion.value = estado;
      opcion.textContent = estado;
      filtroEstado.appendChild(opcion);
    });

    const categoriasUsadas = [...new Set(
      solicitudes.map((solicitud) => solicitud.categoria_id)
    )];

    categoriasUsadas.forEach((id) => {
      const categoria = categorias.find((item) => item.id === id);
      if (!categoria) return;

      const opcion = document.createElement("option");
      opcion.value = categoria.id;
      opcion.textContent = categoria.nombre;
      filtroCategoria.appendChild(opcion);
    });
  }

  function actualizarResumen() {
    const estados = solicitudes.map((solicitud) => normalizar(solicitud.estado));

    document.getElementById("totalSolicitudes").textContent = solicitudes.length;

    document.getElementById("totalRecibidas").textContent =
      estados.filter((estado) => estado === "recibida").length;

    document.getElementById("totalProceso").textContent =
      estados.filter((estado) =>
        ["en revisión", "en proceso", "pendiente de información"].includes(estado)
      ).length;

    document.getElementById("totalFinalizadas").textContent =
      estados.filter((estado) =>
        ["resuelta", "finalizada", "cerrada"].includes(estado)
      ).length;
  }

  function renderizarTabla() {
    const texto = normalizar(buscador.value);
    const estadoSeleccionado = filtroEstado.value;
    const categoriaSeleccionada = filtroCategoria.value;

    const filtradas = solicitudes.filter((solicitud) => {
      const categoria = obtenerCategoria(solicitud.categoria_id);

      const coincideTexto =
        normalizar(solicitud.radicado).includes(texto) ||
        normalizar(solicitud.asunto).includes(texto);

      const coincideEstado =
        !estadoSeleccionado ||
        nombreEstado(solicitud.estado) === estadoSeleccionado;

      const coincideCategoria =
        !categoriaSeleccionada ||
        solicitud.categoria_id === categoriaSeleccionada;

      return coincideTexto && coincideEstado && coincideCategoria;
    });

    tabla.replaceChildren();

    filtradas.forEach((solicitud) => {
      const fila = document.createElement("tr");

      agregarCelda(fila, solicitud.radicado || "Sin radicado");
      agregarCelda(fila, solicitud.asunto || "Sin asunto");
      agregarCelda(fila, obtenerCategoria(solicitud.categoria_id));
      agregarCelda(fila, fechaLegible(solicitud.created_at));

      const celdaEstado = document.createElement("td");
      const insignia = document.createElement("span");
      insignia.className = `badge ${claseEstado(solicitud.estado)}`;
      insignia.textContent = nombreEstado(solicitud.estado);
      celdaEstado.appendChild(insignia);
      fila.appendChild(celdaEstado);

      const celdaAccion = document.createElement("td");
      const botonDetalle = document.createElement("button");
      botonDetalle.type = "button";
      botonDetalle.className = "btn btn-sm btn-outline-primary";
      botonDetalle.textContent = "Ver detalle";
      botonDetalle.setAttribute(
        "aria-label",
        `Ver detalle de ${solicitud.radicado || solicitud.asunto}`
      );
      botonDetalle.addEventListener("click", () => abrirDetalle(solicitud));
      celdaAccion.appendChild(botonDetalle);
      fila.appendChild(celdaAccion);

      tabla.appendChild(fila);
    });

    sinResultados.classList.toggle("d-none", filtradas.length > 0);
    contadorResultados.textContent =
      `Mostrando ${filtradas.length} de ${solicitudes.length} solicitudes.`;
  }

  function agregarCampoDetalle(contenedor, etiqueta, valor) {
    const grupo = document.createElement("div");
    grupo.className = "mb-3";

    const titulo = document.createElement("div");
    titulo.className = "small text-secondary fw-semibold";
    titulo.textContent = etiqueta;

    const texto = document.createElement("div");
    texto.className = "text-break";
    texto.style.whiteSpace = "pre-wrap";
    texto.textContent = valor || "No disponible";

    grupo.append(titulo, texto);
    contenedor.appendChild(grupo);
  }

  async function cargarHistorial(solicitudId) {
    const contenedor = document.getElementById("historialDetalle");
    contenedor.replaceChildren();

    const cargando = document.createElement("p");
    cargando.className = "text-secondary small";
    cargando.textContent = "Consultando historial...";
    contenedor.appendChild(cargando);

    const { data, error } = await client
      .from("historial_solicitudes")
      .select("estado_anterior, estado_nuevo, comentario, created_at")
      .eq("solicitud_id", solicitudId)
      .order("created_at", { ascending: false });

    contenedor.replaceChildren();

    if (error) {
      console.error("No se pudo consultar el historial:", error.message);

      const aviso = document.createElement("p");
      aviso.className = "text-secondary small";
      aviso.textContent =
        "El historial no está disponible. Puede ser necesario revisar los permisos de acceso.";
      contenedor.appendChild(aviso);
      return;
    }

    if (!data || data.length === 0) {
      const aviso = document.createElement("p");
      aviso.className = "text-secondary small";
      aviso.textContent = "Todavía no hay movimientos de seguimiento registrados.";
      contenedor.appendChild(aviso);
      return;
    }

    const lista = document.createElement("div");
    lista.className = "list-group list-group-flush";

    data.forEach((movimiento) => {
      const elemento = document.createElement("div");
      elemento.className = "list-group-item px-0";

      const estado = document.createElement("div");
      estado.className = "fw-semibold";
      estado.textContent = movimiento.estado_anterior
        ? `${nombreEstado(movimiento.estado_anterior)} → ${nombreEstado(movimiento.estado_nuevo)}`
        : `Estado inicial: ${nombreEstado(movimiento.estado_nuevo)}`;

      const fecha = document.createElement("div");
      fecha.className = "small text-secondary";
      fecha.textContent = fechaHoraLegible(movimiento.created_at);

      elemento.append(estado, fecha);

      if (movimiento.comentario) {
        const comentario = document.createElement("p");
        comentario.className = "small mt-2 mb-0";
        comentario.style.whiteSpace = "pre-wrap";
        comentario.textContent = movimiento.comentario;
        elemento.appendChild(comentario);
      }

      lista.appendChild(elemento);
    });

    contenedor.appendChild(lista);
  }

  async function abrirDetalle(solicitud) {
    document.getElementById("radicadoDetalle").textContent =
      solicitud.radicado || "Radicado no disponible";

    const contenido = document.getElementById("contenidoDetalle");
    contenido.replaceChildren();

    agregarCampoDetalle(contenido, "Asunto", solicitud.asunto);
    agregarCampoDetalle(contenido, "Categoría", obtenerCategoria(solicitud.categoria_id));
    agregarCampoDetalle(contenido, "Estado actual", nombreEstado(solicitud.estado));
    agregarCampoDetalle(contenido, "Fecha de creación", fechaHoraLegible(solicitud.created_at));
    agregarCampoDetalle(contenido, "Última actualización", fechaHoraLegible(solicitud.updated_at));
    agregarCampoDetalle(contenido, "Descripción", solicitud.descripcion);

    modalDetalle.show();
    await cargarHistorial(solicitud.id);
  }

  if (!client) {
    estadoCarga.classList.add("d-none");
    mostrarMensaje("danger", "No se pudo inicializar la conexión con la base de datos.");
    return;
  }

  // Verificar sesión.
  const { data: sesionData, error: errorSesion } =
    await client.auth.getSession();

  if (errorSesion || !sesionData.session) {
    window.location.replace("login.html");
    return;
  }

  usuarioActual = sesionData.session.user;

  botonCerrarSesion.addEventListener("click", async () => {
    botonCerrarSesion.disabled = true;

    const { error } = await client.auth.signOut();

    if (error) {
      botonCerrarSesion.disabled = false;
      mostrarMensaje("danger", "No fue posible cerrar la sesión. Inténtalo nuevamente.");
      console.error("Error al cerrar sesión:", error.message);
      return;
    }

    window.location.replace("login.html");
  });

  buscador.addEventListener("input", renderizarTabla);
  filtroEstado.addEventListener("change", renderizarTabla);
  filtroCategoria.addEventListener("change", renderizarTabla);

  limpiarFiltros.addEventListener("click", () => {
    buscador.value = "";
    filtroEstado.value = "";
    filtroCategoria.value = "";
    renderizarTabla();
  });

  try {
    const [respuestaCategorias, respuestaSolicitudes] = await Promise.all([
      client
        .from("categorias")
        .select("id, nombre")
        .eq("activa", true)
        .order("nombre", { ascending: true }),

      client
        .from("solicitudes")
        .select("id, radicado, estudiante_id, categoria_id, asunto, descripcion, estado, created_at, updated_at")
        .eq("estudiante_id", usuarioActual.id)
        .order("created_at", { ascending: false })
    ]);

    if (respuestaCategorias.error) throw respuestaCategorias.error;
    if (respuestaSolicitudes.error) throw respuestaSolicitudes.error;

    categorias = respuestaCategorias.data || [];
    solicitudes = respuestaSolicitudes.data || [];

    actualizarResumen();
    cargarFiltros();
    renderizarTabla();

    estadoCarga.classList.add("d-none");
    contenedorTabla.classList.remove("d-none");

    if (solicitudes.length === 0) {
      mostrarMensaje("info", "Todavía no tienes solicitudes registradas. Puedes crear una con el botón Nueva solicitud.");
    } else {
      ocultarMensaje();
    }
  } catch (error) {
    console.error("Error al cargar Mis solicitudes:", error.message);

    estadoCarga.classList.add("d-none");
    contenedorTabla.classList.add("d-none");

    mostrarMensaje(
      "danger",
      "No fue posible cargar tus solicitudes. Revisa la conexión y los permisos de acceso de Supabase e inténtalo de nuevo."
    );
  }
}
