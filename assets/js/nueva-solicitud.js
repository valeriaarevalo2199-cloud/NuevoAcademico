
document.addEventListener("DOMContentLoaded", iniciarNuevaSolicitud);

async function iniciarNuevaSolicitud() {
  const client = window.supabaseClient;

  const formulario = document.getElementById("formSolicitud");
  const selectorCategoria = document.getElementById("categoria");
  const campoAsunto = document.getElementById("asunto");
  const campoDescripcion = document.getElementById("descripcion");
  const confirmacion = document.getElementById("confirmacion");
  const botonEnviar = document.getElementById("btnEnviarSolicitud");
  const botonCerrarSesion = document.getElementById("btnCerrarSesion");
  const mensaje = document.getElementById("mensajeSolicitud");
  const contador = document.getElementById("contadorDescripcion");

  let usuarioActual = null;
  let categoriasCargadas = false;
  let enviando = false;

  function mostrarMensaje(tipo, texto) {
    mensaje.className = `alert alert-${tipo}`;
    mensaje.textContent = texto;
    mensaje.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function ocultarMensaje() {
    mensaje.className = "alert d-none";
    mensaje.textContent = "";
  }

  function actualizarBoton() {
    botonEnviar.disabled =
      !usuarioActual || !categoriasCargadas || enviando;
  }

  function actualizarContador() {
    contador.textContent = `${campoDescripcion.value.length}/2000`;
  }

  if (!client) {
    mostrarMensaje(
      "danger",
      "No se pudo inicializar la conexión. Recarga la página e inténtalo de nuevo."
    );
    return;
  }

  // Verificar que exista una sesión autenticada.
  const { data: sesionData, error: errorSesion } =
    await client.auth.getSession();

  if (errorSesion || !sesionData.session) {
    window.location.replace("login.html");
    return;
  }

  usuarioActual = sesionData.session.user;

  // Cerrar sesión de forma real.
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

  // Cargar categorías activas desde la base de datos.
  try {
    const { data: categorias, error } = await client
      .from("categorias")
      .select("id, nombre")
      .eq("activa", true)
      .order("nombre", { ascending: true });

    if (error) throw error;

    selectorCategoria.replaceChildren();

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Selecciona una categoría";
    selectorCategoria.appendChild(opcionInicial);

    (categorias || []).forEach((categoria) => {
      const opcion = document.createElement("option");
      opcion.value = categoria.id;
      opcion.textContent = categoria.nombre;
      selectorCategoria.appendChild(opcion);
    });

    if (!categorias || categorias.length === 0) {
      selectorCategoria.replaceChildren();
      const opcion = document.createElement("option");
      opcion.value = "";
      opcion.textContent = "No hay categorías disponibles";
      selectorCategoria.appendChild(opcion);
      mostrarMensaje("warning", "No hay categorías activas disponibles en este momento.");
      return;
    }

    selectorCategoria.disabled = false;
    categoriasCargadas = true;
    actualizarBoton();
  } catch (error) {
    console.error("Error al cargar categorías:", error.message);
    selectorCategoria.replaceChildren();

    const opcion = document.createElement("option");
    opcion.value = "";
    opcion.textContent = "No se pudieron cargar las categorías";
    selectorCategoria.appendChild(opcion);

    mostrarMensaje(
      "danger",
      "No fue posible cargar las categorías. Recarga la página para intentarlo nuevamente."
    );
    return;
  }

  campoDescripcion.addEventListener("input", actualizarContador);

  formulario.addEventListener("reset", () => {
    window.setTimeout(() => {
      ocultarMensaje();
      actualizarContador();
    }, 0);
  });

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (enviando) return;

    ocultarMensaje();

    const categoriaId = selectorCategoria.value;
    const asunto = campoAsunto.value.trim();
    const descripcion = campoDescripcion.value.trim();

    if (!categoriaId || !asunto || !descripcion || !confirmacion.checked) {
      mostrarMensaje("warning", "Completa todos los campos obligatorios antes de continuar.");
      return;
    }

    if (asunto.length > 120 || descripcion.length > 2000) {
      mostrarMensaje("warning", "Revisa la longitud del asunto y de la descripción.");
      return;
    }

    enviando = true;
    actualizarBoton();
    botonEnviar.textContent = "Registrando...";

    try {
      // Comprobar nuevamente la sesión antes de insertar.
      const { data: sesionActual, error: errorSesionActual } =
        await client.auth.getSession();

      if (errorSesionActual || !sesionActual.session) {
        window.location.replace("login.html");
        return;
      }

      const usuarioId = sesionActual.session.user.id;

      // El radicado y el estado inicial deben generarse en la base de datos.
      const { data: solicitud, error } = await client
        .from("solicitudes")
        .insert({
          estudiante_id: usuarioId,
          categoria_id: categoriaId,
          asunto: asunto,
          descripcion: descripcion
        })
        .select("id, radicado")
        .single();

      if (error) throw error;

      formulario.reset();
      actualizarContador();

      mostrarMensaje(
        "success",
        `¡Solicitud registrada correctamente! Tu número de radicado es ${solicitud.radicado}. Guarda este número para consultar el estado de tu solicitud.`
      );
    } catch (error) {
      console.error("Error al registrar solicitud:", error.message);

      mostrarMensaje(
        "danger",
        "No se pudo registrar la solicitud. Tu información sigue en el formulario. Verifica los permisos de la base de datos e inténtalo nuevamente."
      );
    } finally {
      enviando = false;
      botonEnviar.textContent = "Registrar solicitud";
      actualizarBoton();
    }
  });

  actualizarContador();
}
