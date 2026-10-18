
document.addEventListener("DOMContentLoaded", () => {
  const supabaseClient = window.supabaseClient;

  const ESTADOS = {
    recibida: "Recibida",
    en_revision: "En revisión",
    pendiente_informacion: "Pendiente de información",
    resuelta: "Resuelta",
    cerrada: "Cerrada"
  };

  const $ = (id) => document.getElementById(id);

  let usuarioActual = null;
  let solicitudes = [];
  let asignaciones = [];
  let categorias = [];
  let solicitudActual = null;
  let mensajes = [];
  let historial = [];
  let cargando = false;

  const elementos = {
    mensaje: $("mensajeFuncionario"),
    cargando: $("cargandoFuncionario"),
    buscar: $("buscarFuncionario"),
    estado: $("estadoFuncionario"),
    limpiar: $("limpiarFuncionario"),
    actualizar: $("btnActualizarFuncionario"),
    cerrarSesion: $("btnCerrarSesion"),
    tabla: $("tablaFuncionario"),
    contador: $("contadorFuncionario"),
    total: $("totalFuncionario"),
    recibidas: $("recibidasFuncionario"),
    revision: $("revisionFuncionario"),
    pendientes: $("pendientesFuncionario"),
    resueltas: $("resueltasFuncionario"),
    sinResultados: $("sinResultadosFuncionario"),
    modal: $("modalDetalleFuncionario"),
    tituloDetalle: $("tituloDetalleFuncionario"),
    radicadoDetalle: $("radicadoDetalleFuncionario"),
    categoriaDetalle: $("categoriaDetalleFuncionario"),
    fechaDetalle: $("fechaDetalleFuncionario"),
    estadoDetalle: $("estadoDetalleFuncionario"),
    asuntoDetalle: $("asuntoDetalleFuncionario"),
    descripcionDetalle: $("descripcionDetalleFuncionario"),
    estadoNuevo: $("nuevoEstadoFuncionario"),
    guardarEstado: $("guardarEstadoFuncionario"),
    formularioMensaje: $("formMensajeFuncionario"),
    contenidoMensaje: $("contenidoMensajeFuncionario"),
    listaMensajes: $("listaMensajesFuncionario"),
    listaHistorial: $("listaHistorialFuncionario"),
    estudianteDetalle: $("estudianteDetalleFuncionario")
  };

  const modalDetalle = elementos.modal && window.bootstrap
    ? new bootstrap.Modal(elementos.modal)
    : null;

  // ==========================================
  // MENSAJES Y UTILIDADES
  // ==========================================

  function mostrarMensaje(texto, tipo = "info") {
    if (!elementos.mensaje) {
      console.log(texto);
      return;
    }

    elementos.mensaje.textContent = texto;
    elementos.mensaje.className = `alert alert-${tipo}`;
    elementos.mensaje.classList.remove("d-none");
    elementos.mensaje.setAttribute("role", "status");
    elementos.mensaje.setAttribute("aria-live", "polite");
  }

  function ocultarMensaje() {
    if (!elementos.mensaje) return;

    elementos.mensaje.textContent = "";
    elementos.mensaje.className = "alert d-none";
  }

  function mostrarCarga(visible) {
    if (elementos.cargando) {
      elementos.cargando.classList.toggle("d-none", !visible);
    }

    if (elementos.actualizar) {
      elementos.actualizar.disabled = visible;
    }

    cargando = visible;
  }

  function fechaLegible(fecha) {
    if (!fecha) return "Sin fecha";

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) return "Fecha no disponible";

    return valor.toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function crearElemento(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;

    elemento.textContent = texto ?? "";

    return elemento;
  }

  function etiquetaEstado(estado) {
    const colores = {
      recibida: "text-bg-info",
      en_revision: "text-bg-primary",
      pendiente_informacion: "text-bg-warning",
      resuelta: "text-bg-success",
      cerrada: "text-bg-secondary"
    };

    return crearElemento(
      "span",
      `badge ${colores[estado] || "text-bg-secondary"}`,
      ESTADOS[estado] || estado || "Sin estado"
    );
  }

  function mostrarErrorSupabase(error, contexto) {
    console.error(`${contexto}:`, error);

    mostrarMensaje(
      `${contexto}. Revisa la conexión, los permisos de Supabase y vuelve a intentarlo.`,
      "danger"
    );
  }

  // ==========================================
  // SESIÓN Y ROL
  // ==========================================

  async function verificarSesion() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    const usuario = data.session?.user;

    if (!usuario) {
      window.location.href = "login.html";
      return false;
    }

    const { data: perfil, error: errorPerfil } =
      await supabaseClient
        .from("perfiles")
        .select("id, nombres, apellidos, correo, rol")
        .eq("id", usuario.id)
        .maybeSingle();

    if (errorPerfil) throw errorPerfil;

    if (!perfil) {
      mostrarMensaje(
        "Tu cuenta no tiene un perfil académico registrado.",
        "warning"
      );

      return false;
    }

    if (perfil.rol !== "funcionario") {
      if (perfil.rol === "administrador") {
        window.location.href = "administracion.html";
      } else if (perfil.rol === "estudiante") {
        window.location.href = "panel-estudiante.html";
      } else {
        mostrarMensaje("Tu rol no tiene acceso a este módulo.", "danger");
      }

      return false;
    }

    usuarioActual = perfil;

    const nombre = [perfil.nombres, perfil.apellidos]
      .filter(Boolean)
      .join(" ");

    const saludo = $("nombreFuncionario");

    if (saludo) {
      saludo.textContent = nombre || perfil.correo || "Funcionario";
    }

    return true;
  }

  // ==========================================
  // CARGAR DATOS
  // ==========================================

  async function cargarSolicitudes() {
    ocultarMensaje();
    mostrarCarga(true);

    try {
      // Las políticas RLS limitan las asignaciones al usuario autorizado.
      const { data: datosAsignaciones, error: errorAsignaciones } =
        await supabaseClient
          .from("asignaciones")
          .select("id, solicitud_id, funcionario_id, created_at")
          .eq("funcionario_id", usuarioActual.id);

      if (errorAsignaciones) throw errorAsignaciones;

      asignaciones = datosAsignaciones || [];

      const ids = [
        ...new Set(asignaciones.map((asignacion) => asignacion.solicitud_id))
      ];

      if (ids.length === 0) {
        solicitudes = [];
        categorias = [];
        actualizarInterfaz();
        return;
      }

      const { data: datosSolicitudes, error: errorSolicitudes } =
        await supabaseClient
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
          .in("id", ids)
          .order("created_at", { ascending: false });

      if (errorSolicitudes) throw errorSolicitudes;

      solicitudes = datosSolicitudes || [];

      const idsCategorias = [
        ...new Set(
          solicitudes
            .map((solicitud) => solicitud.categoria_id)
            .filter(Boolean)
        )
      ];

      if (idsCategorias.length) {
        const { data: datosCategorias, error: errorCategorias } =
          await supabaseClient
            .from("categorias")
            .select("id, nombre")
            .in("id", idsCategorias);

        if (errorCategorias) {
          console.warn("No se pudieron consultar algunas categorías:", errorCategorias);
          categorias = [];
        } else {
          categorias = datosCategorias || [];
        }
      } else {
        categorias = [];
      }

      actualizarInterfaz();
    } catch (error) {
      mostrarErrorSupabase(error, "No fue posible cargar las solicitudes");
    } finally {
      mostrarCarga(false);
    }
  }

  // ==========================================
  // TABLA E INDICADORES
  // ==========================================

  function nombreCategoria(id) {
    return categorias.find((categoria) => categoria.id === id)?.nombre
      || "Categoría no disponible";
  }

  function actualizarIndicadores() {
    if (elementos.total) {
      elementos.total.textContent = solicitudes.length;
    }

    if (elementos.recibidas) {
      elementos.recibidas.textContent =
        solicitudes.filter((s) => s.estado === "recibida").length;
    }

    if (elementos.revision) {
      elementos.revision.textContent =
        solicitudes.filter((s) => s.estado === "en_revision").length;
    }

    if (elementos.pendientes) {
      elementos.pendientes.textContent =
        solicitudes.filter((s) => s.estado === "pendiente_informacion").length;
    }

    if (elementos.resueltas) {
      elementos.resueltas.textContent =
        solicitudes.filter((s) =>
          ["resuelta", "cerrada"].includes(s.estado)
        ).length;
    }
  }

  function obtenerSolicitudesFiltradas() {
    const termino = (elementos.buscar?.value || "")
      .trim()
      .toLocaleLowerCase("es");

    const estado = elementos.estado?.value || "";

    return solicitudes.filter((solicitud) => {
      const coincideTexto = [
        solicitud.radicado,
        solicitud.asunto,
        nombreCategoria(solicitud.categoria_id)
      ]
        .some((valor) =>
          String(valor || "").toLocaleLowerCase("es").includes(termino)
        );

      const coincideEstado = !estado || solicitud.estado === estado;

      return coincideTexto && coincideEstado;
    });
  }

  function actualizarInterfaz() {
    actualizarIndicadores();
    renderizarTabla();
  }

  function renderizarTabla() {
    if (!elementos.tabla) return;

    elementos.tabla.replaceChildren();

    const filtradas = obtenerSolicitudesFiltradas();

    if (elementos.contador) {
      elementos.contador.textContent =
        `Registros encontrados: ${filtradas.length}`;
    }

    elementos.sinResultados?.classList.toggle(
      "d-none",
      filtradas.length > 0
    );

    if (!filtradas.length) {
      const fila = document.createElement("tr");
      const celda = crearElemento(
        "td",
        "text-center text-secondary py-4",
        solicitudes.length
          ? "No hay solicitudes que coincidan con los filtros."
          : "Todavía no tienes solicitudes asignadas."
      );

      celda.colSpan = 6;
      fila.appendChild(celda);
      elementos.tabla.appendChild(fila);

      return;
    }

    filtradas.forEach((solicitud) => {
      const fila = document.createElement("tr");

      const celdaRadicado = crearElemento(
        "td",
        "fw-semibold text-nowrap",
        solicitud.radicado || "Sin radicado"
      );

      const celdaAsunto = document.createElement("td");
      celdaAsunto.appendChild(
        crearElemento("div", "fw-semibold", solicitud.asunto || "Sin asunto")
      );
      celdaAsunto.appendChild(
        crearElemento("div", "small text-secondary", nombreCategoria(solicitud.categoria_id))
      );

      const celdaFecha = crearElemento(
        "td",
        "text-nowrap small",
        fechaLegible(solicitud.created_at)
      );

      const celdaEstado = document.createElement("td");
      celdaEstado.appendChild(etiquetaEstado(solicitud.estado));

      const celdaActualizacion = crearElemento(
        "td",
        "small",
        fechaLegible(solicitud.updated_at || solicitud.created_at)
      );

      const celdaAccion = document.createElement("td");
      const boton = crearElemento(
        "button",
        "btn btn-sm btn-primary text-nowrap",
        "Ver solicitud"
      );

      boton.type = "button";
      boton.addEventListener("click", () => abrirDetalle(solicitud.id));
      celdaAccion.appendChild(boton);

      fila.append(
        celdaRadicado,
        celdaAsunto,
        celdaFecha,
        celdaEstado,
        celdaActualizacion,
        celdaAccion
      );

      elementos.tabla.appendChild(fila);
    });
  }

  // ==========================================
  // DETALLE, MENSAJES E HISTORIAL
  // ==========================================

  async function abrirDetalle(id) {
    const solicitud = solicitudes.find((item) => item.id === id);

    if (!solicitud) {
      mostrarMensaje("No se encontró la solicitud seleccionada.", "warning");
      return;
    }

    solicitudActual = solicitud;

    if (elementos.tituloDetalle) {
      elementos.tituloDetalle.textContent = solicitud.asunto || "Detalle de solicitud";
    }

    if (elementos.radicadoDetalle) {
      elementos.radicadoDetalle.textContent = solicitud.radicado || "";
    }

    if (elementos.categoriaDetalle) {
      elementos.categoriaDetalle.textContent = nombreCategoria(solicitud.categoria_id);
    }

    if (elementos.fechaDetalle) {
      elementos.fechaDetalle.textContent = fechaLegible(solicitud.created_at);
    }

    if (elementos.estadoDetalle) {
      elementos.estadoDetalle.replaceChildren(etiquetaEstado(solicitud.estado));
    }

    if (elementos.asuntoDetalle) {
      elementos.asuntoDetalle.textContent = solicitud.asunto || "Sin asunto";
    }

    if (elementos.descripcionDetalle) {
      elementos.descripcionDetalle.textContent =
        solicitud.descripcion || "Sin descripción.";
    }

    if (elementos.estudianteDetalle) {
      // RLS solo permite al funcionario leer su propio perfil.
      // No consultamos los perfiles de los estudiantes desde este módulo.
      elementos.estudianteDetalle.textContent =
        "Información personal protegida por las políticas de acceso.";
    }

    if (elementos.estadoNuevo) {
      elementos.estadoNuevo.value = solicitud.estado;
    }

    if (elementos.guardarEstado) {
      elementos.guardarEstado.disabled =
        ["resuelta", "cerrada"].includes(solicitud.estado);
    }

    if (elementos.contenidoMensaje) {
      elementos.contenidoMensaje.value = "";
    }

    if (modalDetalle) modalDetalle.show();

    await Promise.all([
      cargarMensajes(solicitud.id),
      cargarHistorial(solicitud.id)
    ]);
  }

  async function cargarMensajes(solicitudId) {
    if (!elementos.listaMensajes) return;

    elementos.listaMensajes.replaceChildren(
      crearElemento("p", "text-secondary small", "Cargando mensajes...")
    );

    try {
      const { data, error } = await supabaseClient
        .from("mensajes")
        .select("id, remitente_id, contenido, created_at")
        .eq("solicitud_id", solicitudId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      mensajes = data || [];
      elementos.listaMensajes.replaceChildren();

      if (!mensajes.length) {
        elementos.listaMensajes.appendChild(
          crearElemento("p", "text-secondary small", "Todavía no hay mensajes.")
        );
        return;
      }

      mensajes.forEach((mensaje) => {
        const tarjeta = crearElemento("div", "border rounded p-3 mb-2");
        const soyYo = mensaje.remitente_id === usuarioActual.id;

        tarjeta.appendChild(
          crearElemento(
            "div",
            "small fw-semibold mb-2",
            soyYo ? "Tú · Funcionario" : "Mensaje del solicitante"
          )
        );

        tarjeta.appendChild(
          crearElemento("p", "mb-2", mensaje.contenido)
        );

        tarjeta.appendChild(
          crearElemento("div", "small text-secondary", fechaLegible(mensaje.created_at))
        );

        elementos.listaMensajes.appendChild(tarjeta);
      });
    } catch (error) {
      console.error("Error cargando mensajes:", error);

      elementos.listaMensajes.replaceChildren(
        crearElemento(
          "p",
          "text-danger small",
          "No fue posible cargar los mensajes. Verifica los permisos de acceso."
        )
      );
    }
  }

  async function cargarHistorial(solicitudId) {
    if (!elementos.listaHistorial) return;

    elementos.listaHistorial.replaceChildren(
      crearElemento("p", "text-secondary small", "Cargando historial...")
    );

    try {
      const { data, error } = await supabaseClient
        .from("historial_solicitudes")
        .select("id, usuario_id, estado_anterior, estado_nuevo, comentario, created_at")
        .eq("solicitud_id", solicitudId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      historial = data || [];
      elementos.listaHistorial.replaceChildren();

      if (!historial.length) {
        elementos.listaHistorial.appendChild(
          crearElemento("p", "text-secondary small", "No hay eventos de historial.")
        );
        return;
      }

      historial.forEach((evento) => {
        const tarjeta = crearElemento("div", "border-start border-3 ps-3 pb-3 mb-2");

        const transicion = evento.estado_anterior
          ? `${ESTADOS[evento.estado_anterior] || evento.estado_anterior} → ${ESTADOS[evento.estado_nuevo] || evento.estado_nuevo}`
          : ESTADOS[evento.estado_nuevo] || evento.estado_nuevo;

        tarjeta.appendChild(
          crearElemento("div", "fw-semibold small", transicion)
        );

        tarjeta.appendChild(
          crearElemento(
            "div",
            "small text-secondary",
            evento.comentario || "Actualización de solicitud"
          )
        );

        tarjeta.appendChild(
          crearElemento("div", "small text-secondary", fechaLegible(evento.created_at))
        );

        elementos.listaHistorial.appendChild(tarjeta);
      });
    } catch (error) {
      console.error("Error cargando historial:", error);

      elementos.listaHistorial.replaceChildren(
        crearElemento(
          "p",
          "text-danger small",
          "No fue posible consultar el historial."
        )
      );
    }
  }

  // ==========================================
  // ENVIAR MENSAJE
  // ==========================================

  async function enviarMensaje(evento) {
    evento.preventDefault();

    if (!solicitudActual || !usuarioActual) return;

    const contenido = (elementos.contenidoMensaje?.value || "").trim();

    if (!contenido) {
      mostrarMensaje("Escribe un mensaje antes de enviarlo.", "warning");
      return;
    }

    const boton = elementos.formularioMensaje?.querySelector(
      'button[type="submit"]'
    );

    if (boton) boton.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("mensajes")
        .insert({
          solicitud_id: solicitudActual.id,
          remitente_id: usuarioActual.id,
          contenido
        });

      if (error) throw error;

      if (elementos.contenidoMensaje) {
        elementos.contenidoMensaje.value = "";
      }

      await cargarMensajes(solicitudActual.id);

      mostrarMensaje("Mensaje enviado correctamente.", "success");
    } catch (error) {
      mostrarErrorSupabase(
        error,
        "No fue posible enviar el mensaje"
      );
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  // ==========================================
  // ACTUALIZAR ESTADO
  // ==========================================

  async function actualizarEstado() {
    if (!solicitudActual || !elementos.estadoNuevo) return;

    const estadoNuevo = elementos.estadoNuevo.value;

    if (!Object.hasOwn(ESTADOS, estadoNuevo)) {
      mostrarMensaje("Selecciona un estado válido.", "warning");
      return;
    }

    if (estadoNuevo === solicitudActual.estado) {
      mostrarMensaje("La solicitud ya tiene ese estado.", "info");
      return;
    }

    const boton = elementos.guardarEstado;

    if (boton) boton.disabled = true;

    try {
      const { data, error } = await supabaseClient
        .from("solicitudes")
        .update({ estado: estadoNuevo })
        .eq("id", solicitudActual.id)
        .select("id, estado, updated_at")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "No se actualizó la solicitud. Verifica que continúe asignada a tu usuario."
        );
      }

      solicitudActual = {
        ...solicitudActual,
        estado: data.estado,
        updated_at: data.updated_at
      };

      solicitudes = solicitudes.map((solicitud) =>
        solicitud.id === data.id ? solicitudActual : solicitud
      );

      actualizarInterfaz();

      if (elementos.estadoDetalle) {
        elementos.estadoDetalle.replaceChildren(etiquetaEstado(data.estado));
      }

      await cargarHistorial(solicitudActual.id);

      mostrarMensaje(
        "Estado actualizado correctamente.",
        "success"
      );
    } catch (error) {
      mostrarErrorSupabase(
        error,
        "No fue posible actualizar el estado"
      );
    } finally {
      if (boton) {
        boton.disabled = ["resuelta", "cerrada"].includes(
          solicitudActual?.estado
        );
      }
    }
  }

  // ==========================================
  // CERRAR SESIÓN Y EVENTOS
  // ==========================================

  async function cerrarSesion() {
    if (elementos.cerrarSesion) {
      elementos.cerrarSesion.disabled = true;
    }

    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) throw error;

      window.location.href = "login.html";
    } catch (error) {
      mostrarErrorSupabase(error, "No fue posible cerrar la sesión");

      if (elementos.cerrarSesion) {
        elementos.cerrarSesion.disabled = false;
      }
    }
  }

  function configurarEventos() {
    elementos.buscar?.addEventListener("input", renderizarTabla);
    elementos.estado?.addEventListener("change", renderizarTabla);

    elementos.limpiar?.addEventListener("click", () => {
      if (elementos.buscar) elementos.buscar.value = "";
      if (elementos.estado) elementos.estado.value = "";

      renderizarTabla();
    });

    elementos.actualizar?.addEventListener("click", cargarSolicitudes);
    elementos.cerrarSesion?.addEventListener("click", cerrarSesion);

    elementos.formularioMensaje?.addEventListener("submit", enviarMensaje);
    elementos.guardarEstado?.addEventListener("click", actualizarEstado);
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  async function iniciar() {
    if (!supabaseClient) {
      mostrarMensaje(
        "No se pudo conectar con Supabase. Recarga la página.",
        "danger"
      );
      return;
    }

    configurarEventos();

    try {
      const autorizado = await verificarSesion();

      if (!autorizado) return;

      await cargarSolicitudes();
    } catch (error) {
      mostrarErrorSupabase(
        error,
        "No fue posible iniciar el módulo de funcionarios"
      );
    }
  }

  iniciar();
});
