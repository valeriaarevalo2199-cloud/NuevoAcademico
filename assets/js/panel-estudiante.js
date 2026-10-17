
document.addEventListener("DOMContentLoaded", async () => {
  const cliente = window.supabaseClient;

  const elemento = (id) => document.getElementById(id);

  const mensajePanel = elemento("mensajePanel");
  const botonCerrar = elemento("btnCerrarSesion");

  function mostrarMensaje(texto, tipo = "info") {
    mensajePanel.textContent = texto;
    mensajePanel.className = `alert alert-${tipo}`;
    mensajePanel.classList.remove("d-none");
  }

  function ocultarMensaje() {
    mensajePanel.textContent = "";
    mensajePanel.className = "alert d-none";
  }

  function fechaLegible(fecha) {
    if (!fecha) return "—";

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return "—";

    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(valor);
  }

  function normalizarEstado(estado) {
    return String(estado || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function clasificarEstado(estado) {
    const valor = normalizarEstado(estado);

    if (
      ["resuelta", "resuelto", "completada", "completado",
       "cerrada", "cerrado", "finalizada", "finalizado"].includes(valor)
    ) {
      return "resuelta";
    }

    if (
      ["en revision", "en proceso", "en tramite",
       "en gestion", "en atencion"].includes(valor)
    ) {
      return "revision";
    }

    return "pendiente";
  }

  function etiquetaEstado(estado) {
    const grupo = clasificarEstado(estado);
    const badge = document.createElement("span");

    const clases = {
      resuelta: "badge text-bg-success",
      revision: "badge text-bg-primary",
      pendiente: "badge text-bg-warning"
    };

    badge.className = clases[grupo];
    badge.textContent = estado || "Sin estado";
    return badge;
  }

  function celda(texto) {
    const td = document.createElement("td");
    td.textContent = texto ?? "";
    return td;
  }

  function mostrarSolicitudes(solicitudes, categorias) {
    const cuerpo = elemento("tablaSolicitudes");
    const estadoTabla = elemento("estadoTabla");

    cuerpo.replaceChildren();

    if (solicitudes.length === 0) {
      estadoTabla.textContent =
        "Todavía no tienes solicitudes registradas. Puedes crear la primera desde Nueva solicitud.";
      return;
    }

    estadoTabla.textContent = "";

    solicitudes.slice(0, 5).forEach((solicitud) => {
      const fila = document.createElement("tr");
      const nombreCategoria =
        categorias.get(solicitud.categoria_id) || solicitud.asunto || "Solicitud académica";

      fila.append(
        celda(solicitud.radicado),
        celda(nombreCategoria),
        celda(fechaLegible(solicitud.created_at))
      );

      const tdEstado = document.createElement("td");
      tdEstado.appendChild(etiquetaEstado(solicitud.estado));
      fila.appendChild(tdEstado);
      cuerpo.appendChild(fila);
    });
  }

  function mostrarActividad(historial, solicitudesPorId) {
    const lista = elemento("listaActividad");
    const estadoActividad = elemento("estadoActividad");

    lista.replaceChildren();

    if (!historial.length) {
      estadoActividad.textContent =
        "Todavía no hay movimientos registrados en tus solicitudes.";
      return;
    }

    estadoActividad.textContent = "";

    historial.forEach((movimiento) => {
      const li = document.createElement("li");
      li.className = "mb-3";

      const solicitud = solicitudesPorId.get(movimiento.solicitud_id);
      const radicado = solicitud?.radicado || "Solicitud académica";
      const fecha = fechaLegible(movimiento.created_at);
      const estado = movimiento.estado_nuevo || "Actualización";
      const comentario = movimiento.comentario
        ? ` — ${movimiento.comentario}`
        : "";

      li.textContent = `${fecha}: ${radicado} pasó a "${estado}"${comentario}`;
      lista.appendChild(li);
    });
  }

  // Sin cliente Supabase, no mostrar información del panel.
  if (!cliente) {
    mostrarMensaje(
      "No se pudo inicializar la conexión. Recarga la página e inténtalo nuevamente.",
      "danger"
    );
    return;
  }

  // Comprobar la sesión.
  const { data: sesionData, error: sesionError } =
    await cliente.auth.getSession();

  if (sesionError || !sesionData.session) {
    window.location.replace("login.html");
    return;
  }

  const usuario = sesionData.session.user;

  elemento("correoUsuario").textContent = usuario.email || "Correo no disponible";

  // Cerrar la sesión real.
  botonCerrar.addEventListener("click", async () => {
    botonCerrar.disabled = true;

    const { error } = await cliente.auth.signOut();

    if (error) {
      mostrarMensaje(
        "No fue posible cerrar la sesión. Inténtalo nuevamente.",
        "danger"
      );
      botonCerrar.disabled = false;
      return;
    }

    window.location.replace("login.html");
  });

  try {
    // Cargar el perfil de la cuenta autenticada.
    const { data: perfil, error: errorPerfil } = await cliente
      .from("perfiles")
      .select("id, nombres, apellidos, correo, rol")
      .eq("id", usuario.id)
      .maybeSingle();

    if (errorPerfil) throw errorPerfil;

    if (perfil) {
      const nombre = [perfil.nombres, perfil.apellidos]
        .filter(Boolean)
        .join(" ")
        .trim();

      elemento("nombreUsuario").textContent = nombre || "estudiante";
      elemento("correoUsuario").textContent =
        perfil.correo || usuario.email || "Correo no disponible";
    } else {
      elemento("nombreUsuario").textContent = "estudiante";
    }

    // Consultar exclusivamente las solicitudes del usuario autenticado.
    const { data: solicitudes, error: errorSolicitudes } = await cliente
      .from("solicitudes")
      .select("id, radicado, estudiante_id, categoria_id, asunto, descripcion, estado, created_at, updated_at")
      .eq("estudiante_id", usuario.id)
      .order("created_at", { ascending: false });

    if (errorSolicitudes) throw errorSolicitudes;

    const listaSolicitudes = solicitudes || [];

    const total = listaSolicitudes.length;
    const revision = listaSolicitudes.filter(
      (s) => clasificarEstado(s.estado) === "revision"
    ).length;
    const resueltas = listaSolicitudes.filter(
      (s) => clasificarEstado(s.estado) === "resuelta"
    ).length;
    const pendientes = total - revision - resueltas;

    elemento("totalSolicitudes").textContent = total;
    elemento("totalRevision").textContent = revision;
    elemento("totalResueltas").textContent = resueltas;
    elemento("totalPendientes").textContent = pendientes;

    // Obtener los nombres de las categorías de los trámites del usuario.
    const idsCategorias = [
      ...new Set(listaSolicitudes.map((s) => s.categoria_id).filter(Boolean))
    ];

    const categorias = new Map();

    if (idsCategorias.length > 0) {
      const { data: datosCategorias, error: errorCategorias } = await cliente
        .from("categorias")
        .select("id, nombre")
        .in("id", idsCategorias);

      if (errorCategorias) throw errorCategorias;

      (datosCategorias || []).forEach((categoria) => {
        categorias.set(categoria.id, categoria.nombre);
      });
    }

    mostrarSolicitudes(listaSolicitudes, categorias);

    // Consultar la actividad asociada a las solicitudes propias.
    if (listaSolicitudes.length === 0) {
      mostrarActividad([], new Map());
    } else {
      const idsSolicitudes = listaSolicitudes.map((s) => s.id);
      const solicitudesPorId = new Map(
        listaSolicitudes.map((s) => [s.id, s])
      );

      const { data: historial, error: errorHistorial } = await cliente
        .from("historial_solicitudes")
        .select("solicitud_id, estado_anterior, estado_nuevo, comentario, created_at")
        .in("solicitud_id", idsSolicitudes)
        .order("created_at", { ascending: false })
        .limit(5);

      if (errorHistorial) {
        elemento("estadoActividad").textContent =
          "No se pudo cargar la actividad. Revisa los permisos del historial en Supabase.";
        console.error("Error al consultar el historial:", errorHistorial.message);
      } else {
        mostrarActividad(historial || [], solicitudesPorId);
      }
    }

    ocultarMensaje();
  } catch (error) {
    console.error("Error al cargar el panel:", error.message);

    mostrarMensaje(
      "No se pudo cargar toda la información. Verifica las políticas de acceso RLS de perfiles, solicitudes, categorías e historial_solicitudes.",
      "danger"
    );

    elemento("estadoTabla").textContent =
      "No se pudieron consultar tus solicitudes.";
    elemento("estadoActividad").textContent =
      "No se pudo consultar la actividad.";

    // No presentar cifras de demostración ni aparentar una carga correcta.
    elemento("totalSolicitudes").textContent = "—";
    elemento("totalRevision").textContent = "—";
    elemento("totalResueltas").textContent = "—";
    elemento("totalPendientes").textContent = "—";
  }
});
