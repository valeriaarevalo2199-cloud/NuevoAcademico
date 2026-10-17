

(() => {
  "use strict";

  const client = window.supabaseClient;

  const $ = (id) => document.getElementById(id);

  const elementos = {
    mensaje: $("mensajePerfil"),
    carga: $("estadoCarga"),
    contenido: $("contenidoPerfil"),
    form: $("formPerfil"),
    nombres: $("nombres"),
    apellidos: $("apellidos"),
    correo: $("correo"),
    rol: $("rol"),
    rolPerfil: $("rolPerfil"),
    nombreCompleto: $("nombreCompleto"),
    correoResumen: $("correoResumen"),
    fechaRegistro: $("fechaRegistro"),
    avatar: $("avatarPerfil"),
    btnGuardar: $("btnGuardar"),
    btnRestablecer: $("btnRestablecer"),
    btnCerrarSesion: $("btnCerrarSesion")
  };

  let usuarioActual = null;
  let valoresOriginales = { nombres: "", apellidos: "" };

  function mostrarMensaje(texto, tipo = "info") {
    elementos.mensaje.textContent = texto;
    elementos.mensaje.className = `alert alert-${tipo}`;
    elementos.mensaje.classList.remove("d-none");
  }

  function ocultarMensaje() {
    elementos.mensaje.textContent = "";
    elementos.mensaje.classList.add("d-none");
  }

  function normalizarTexto(valor) {
    return String(valor ?? "").trim().replace(/\s+/g, " ");
  }

  function obtenerIniciales(nombres, apellidos) {
    const primera = normalizarTexto(nombres).charAt(0);
    const segunda = normalizarTexto(apellidos).charAt(0);
    return (primera + segunda).toUpperCase() || "AF";
  }

  function formatearFecha(fecha) {
    if (!fecha) return "No disponible";

    const fechaValida = new Date(fecha);
    if (Number.isNaN(fechaValida.getTime())) return "No disponible";

    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(fechaValida);
  }

  function actualizarResumen() {
    const nombres = normalizarTexto(elementos.nombres.value);
    const apellidos = normalizarTexto(elementos.apellidos.value);
    const nombre = `${nombres} ${apellidos}`.trim();

    elementos.nombreCompleto.textContent = nombre || "Mi perfil";
    elementos.avatar.textContent = obtenerIniciales(nombres, apellidos);
  }

  function mostrarPerfil(perfil, usuarioAuth) {
    const nombres = perfil.nombres || "";
    const apellidos = perfil.apellidos || "";
    const correo = perfil.correo || usuarioAuth.email || "";

    valoresOriginales = { nombres, apellidos };

    elementos.nombres.value = nombres;
    elementos.apellidos.value = apellidos;
    elementos.correo.value = correo;
    elementos.correoResumen.textContent = correo || "No disponible";
    elementos.rol.value = perfil.rol || "No asignado";
    elementos.rolPerfil.textContent = perfil.rol || "No asignado";
    elementos.fechaRegistro.textContent =
      formatearFecha(perfil.created_at);

    actualizarResumen();
    elementos.carga.classList.add("d-none");
    elementos.contenido.classList.remove("d-none");
  }

  async function cargarPerfil() {
    if (!client) {
      elementos.carga.classList.add("d-none");
      mostrarMensaje(
        "No se pudo iniciar la conexión con la base de datos. Recarga la página.",
        "danger"
      );
      return;
    }

    try {
      const { data: sesionData, error: errorSesion } =
        await client.auth.getSession();

      if (errorSesion) throw errorSesion;

      const sesion = sesionData.session;

      if (!sesion?.user) {
        window.location.href = "../index.html";
        return;
      }

      usuarioActual = sesion.user;

      const { data: perfil, error } = await client
        .from("perfiles")
        .select("id, nombres, apellidos, correo, rol, created_at")
        .eq("id", usuarioActual.id)
        .maybeSingle();

      if (error) throw error;

      if (!perfil) {
        elementos.carga.classList.add("d-none");
        mostrarMensaje(
          "No encontramos tu perfil en la base de datos. Contacta al administrador de la plataforma.",
          "warning"
        );
        return;
      }

      mostrarPerfil(perfil, usuarioActual);
    } catch (error) {
      console.error("Error al cargar el perfil:", error);

      elementos.carga.classList.add("d-none");
      mostrarMensaje(
        "No fue posible cargar tu perfil. Verifica tu conexión e inténtalo de nuevo.",
        "danger"
      );
    }
  }

  async function guardarPerfil(evento) {
    evento.preventDefault();
    ocultarMensaje();

    if (!usuarioActual) {
      mostrarMensaje("Tu sesión no está disponible. Inicia sesión de nuevo.", "warning");
      return;
    }

    const nombres = normalizarTexto(elementos.nombres.value);
    const apellidos = normalizarTexto(elementos.apellidos.value);

    if (!nombres || !apellidos) {
      mostrarMensaje("Escribe tus nombres y apellidos para continuar.", "warning");
      return;
    }

    if (nombres.length > 100 || apellidos.length > 100) {
      mostrarMensaje("Los nombres y apellidos no pueden superar los 100 caracteres.", "warning");
      return;
    }

    const sinCambios =
      nombres === normalizarTexto(valoresOriginales.nombres) &&
      apellidos === normalizarTexto(valoresOriginales.apellidos);

    if (sinCambios) {
      mostrarMensaje("No hay cambios para guardar.", "info");
      return;
    }

    elementos.btnGuardar.disabled = true;
    elementos.btnRestablecer.disabled = true;
    elementos.btnGuardar.textContent = "Guardando...";

    try {
      // Actualizamos solo las columnas autorizadas y la fila del usuario actual.
      const { data, error } = await client
        .from("perfiles")
        .update({ nombres, apellidos })
        .eq("id", usuarioActual.id)
        .select("id, nombres, apellidos, correo, rol, created_at")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "No se actualizó ningún registro. Verifica la política de seguridad del perfil."
        );
      }

      mostrarPerfil(data, usuarioActual);
      mostrarMensaje("¡Tus datos se actualizaron correctamente!", "success");
    } catch (error) {
      console.error("Error al guardar el perfil:", error);

      mostrarMensaje(
        "No se pudieron guardar los cambios. Revisa los permisos de UPDATE y la política RLS de perfiles.",
        "danger"
      );
    } finally {
      elementos.btnGuardar.disabled = false;
      elementos.btnRestablecer.disabled = false;
      elementos.btnGuardar.textContent = "Guardar cambios";
    }
  }

  function restablecerCambios() {
    elementos.nombres.value = valoresOriginales.nombres;
    elementos.apellidos.value = valoresOriginales.apellidos;
    actualizarResumen();
    ocultarMensaje();
  }

  async function cerrarSesion() {
    elementos.btnCerrarSesion.disabled = true;

    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;

      window.location.href = "../index.html";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      mostrarMensaje("No se pudo cerrar la sesión. Inténtalo de nuevo.", "danger");
      elementos.btnCerrarSesion.disabled = false;
    }
  }

  elementos.form.addEventListener("submit", guardarPerfil);
  elementos.btnRestablecer.addEventListener("click", restablecerCambios);
  elementos.btnCerrarSesion.addEventListener("click", cerrarSesion);

  elementos.nombres.addEventListener("input", actualizarResumen);
  elementos.apellidos.addEventListener("input", actualizarResumen);

  cargarPerfil();
})();
