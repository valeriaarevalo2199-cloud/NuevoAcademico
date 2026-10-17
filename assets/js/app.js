
document.addEventListener("DOMContentLoaded", () => {
  const supabaseClient = window.supabaseClient;

  const formRegistro = document.getElementById("formRegistro");
  const formLogin = document.getElementById("formLogin");
  const formRecuperar = document.getElementById("formRecuperar");

  const mensajeAuth = document.getElementById("mensajeAuth");
  const claveRegistro = document.getElementById("claveRegistro");
  const confirmarClave = document.getElementById("confirmarClave");

  function mostrarMensaje(mensaje, tipo = "success") {
    if (!mensajeAuth) return;

    mensajeAuth.textContent = mensaje;
    mensajeAuth.className = `alert alert-${tipo}`;
    mensajeAuth.classList.remove("d-none");
    mensajeAuth.setAttribute("role", "status");
    mensajeAuth.setAttribute("aria-live", "polite");
  }

  function limpiarMensaje() {
    if (!mensajeAuth) return;

    mensajeAuth.textContent = "";
    mensajeAuth.className = "alert d-none";
  }

  function bloquearFormulario(formulario, bloquear) {
    if (!formulario) return;

    formulario.querySelectorAll('button[type="submit"]').forEach((boton) => {
      boton.disabled = bloquear;
    });
  }

  function mensajeError(error) {
    const errores = {
      "User already registered":
        "Este correo ya tiene una cuenta. Intenta iniciar sesión.",
      "Invalid login credentials":
        "El correo o la contraseña son incorrectos.",
      "Email not confirmed":
        "Confirma tu correo electrónico antes de iniciar sesión.",
      "Password should be at least 6 characters":
        "La contraseña debe tener al menos 6 caracteres."
    };

    return errores[error?.message] ||
      "No fue posible completar la operación. Verifica los datos e inténtalo nuevamente.";
  }

  if (!supabaseClient) {
    mostrarMensaje(
      "No se pudo conectar con Supabase. Recarga la página e inténtalo nuevamente.",
      "danger"
    );
    return;
  }

  // VALIDACIÓN DE CONFIRMACIÓN DE CONTRASEÑA
  function validarConfirmacion() {
    if (!claveRegistro || !confirmarClave) return;

    confirmarClave.setCustomValidity(
      confirmarClave.value === claveRegistro.value
        ? ""
        : "Las contraseñas no coinciden."
    );
  }

  claveRegistro?.addEventListener("input", validarConfirmacion);
  confirmarClave?.addEventListener("input", validarConfirmacion);

  // REGISTRO
  if (formRegistro) {
    formRegistro.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      limpiarMensaje();

      validarConfirmacion();

      if (!formRegistro.reportValidity()) return;

      bloquearFormulario(formRegistro, true);

      const nombres = formRegistro.elements["nombres"].value.trim();
      const apellidos = formRegistro.elements["apellidos"].value.trim();
      const correo = formRegistro.elements["correo"].value.trim();
      const clave = formRegistro.elements["password"].value;

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: correo,
          password: clave,
          options: {
            data: { nombres, apellidos },
            emailRedirectTo:
              "https://valeriaarevalo2199-cloud.github.io/NuevoAcademico/"
          }
        });

        if (error) throw error;

        if (data.session) {
          mostrarMensaje(
            "Tu cuenta fue creada. Ya puedes iniciar sesión.",
            "success"
          );
        } else {
          mostrarMensaje(
            "Registro recibido. Revisa tu correo y confirma tu cuenta antes de iniciar sesión.",
            "success"
          );
        }

        formRegistro.reset();
        confirmarClave?.setCustomValidity("");
      } catch (error) {
        console.error("Error en el registro:", error);
        mostrarMensaje(mensajeError(error), "danger");
      } finally {
        bloquearFormulario(formRegistro, false);
      }
    });
  }

  // INICIO DE SESIÓN
 
  // INICIO DE SESIÓN
  if (formLogin) {
    formLogin.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      limpiarMensaje();

      if (!formLogin.reportValidity()) return;

      bloquearFormulario(formLogin, true);

      const correo = formLogin.elements["correo"].value.trim();
      const clave = formLogin.elements["password"].value;

      try {
        // 1. Autenticar al usuario
        const { data: loginData, error: loginError } =
          await supabaseClient.auth.signInWithPassword({
            email: correo,
            password: clave
          });

        if (loginError) throw loginError;

        const usuario = loginData.user;

        if (!usuario) {
          throw new Error("No se pudo identificar al usuario.");
        }

        // 2. Consultar su rol en el perfil
        const { data: perfil, error: perfilError } =
          await supabaseClient
            .from("perfiles")
            .select("rol")
            .eq("id", usuario.id)
            .maybeSingle();

        if (perfilError) {
          console.error("Error consultando el perfil:", perfilError);
          mostrarMensaje(
            "Iniciaste sesión, pero no pudimos verificar tu rol. Revisa los permisos del perfil en Supabase.",
            "warning"
          );
          return;
        }

        if (!perfil) {
          mostrarMensaje(
            "Tu cuenta no tiene un perfil académico registrado. Contacta al administrador.",
            "warning"
          );
          return;
        }

        // 3. Redirigir según el rol registrado
        switch (perfil.rol) {
          case "administrador":
            window.location.href = "administracion.html";
            break;

          case "estudiante":
            window.location.href = "panel-estudiante.html";
            break;

          case "funcionario":
            mostrarMensaje(
              "Tu cuenta es de funcionario. El módulo correspondiente aún está en construcción.",
              "info"
            );
            break;

          default:
            mostrarMensaje(
              "Tu cuenta tiene un rol no reconocido. Contacta al administrador.",
              "warning"
            );
        }
      } catch (error) {
        console.error("Error al iniciar sesión:", error);
        mostrarMensaje(mensajeError(error), "danger");
      } finally {
        bloquearFormulario(formLogin, false);
      }
    });
