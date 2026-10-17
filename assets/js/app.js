
const supabaseClient = window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  const formRegistro = document.getElementById("formRegistro");
  const formLogin = document.getElementById("formLogin");
  const mensajeAuth = document.getElementById("mensajeAuth");
  const authOverlay = document.getElementById("authOverlay");

  function mostrarMensaje(mensaje, tipo = "success") {
    if (!mensajeAuth) return;

    mensajeAuth.textContent = mensaje;
    mensajeAuth.className = `alert alert-${tipo}`;
    mensajeAuth.classList.remove("d-none");
    mensajeAuth.setAttribute("role", "status");
  }

  function limpiarMensaje() {
    if (!mensajeAuth) return;

    mensajeAuth.textContent = "";
    mensajeAuth.className = "d-none";
  }

  function bloquearFormulario(formulario, bloquear) {
    const botones = formulario.querySelectorAll(
      'button[type="submit"], input[type="submit"]'
    );

    botones.forEach((boton) => {
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
        "Debes confirmar tu correo electrónico antes de iniciar sesión.",
      "Password should be at least 6 characters":
        "La contraseña no cumple la longitud mínima."
    };

    return errores[error?.message] ||
      "No fue posible completar la operación. Verifica los datos e inténtalo nuevamente.";
  }

  if (!supabaseClient) {
    mostrarMensaje(
      "No se pudo conectar con el servicio. Recarga la página e inténtalo nuevamente.",
      "danger"
    );
    return;
  }

  // REGISTRO
  if (formRegistro) {
    formRegistro.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      limpiarMensaje();
      bloquearFormulario(formRegistro, true);

      const nombres = formRegistro.elements["nombres"].value.trim();
      const apellidos = formRegistro.elements["apellidos"].value.trim();
      const correo = formRegistro.elements["correo"].value.trim();
      const clave = formRegistro.elements["password"].value;

      if (!nombres || !apellidos || !correo || !clave) {
        mostrarMensaje("Completa todos los campos.", "warning");
        bloquearFormulario(formRegistro, false);
        return;
      }

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: correo,
          password: clave,
          options: {
            data: {
              nombres,
              apellidos
            },
            emailRedirectTo:
              "https://valeriaarevalo2199-cloud.github.io/NuevoAcademico/"
          }
        });

        if (error) throw error;

        if (data.session) {
          mostrarMensaje(
            "¡Tu cuenta fue creada correctamente! Ya puedes comenzar.",
            "success"
          );
        } else {
          mostrarMensaje(
            "Tu registro fue recibido. Revisa tu correo y confirma la cuenta antes de iniciar sesión.",
            "success"
          );
        }

        formRegistro.reset();
      } catch (error) {
        console.error("Error en el registro:", error);
        mostrarMensaje(mensajeError(error), "danger");
      } finally {
        bloquearFormulario(formRegistro, false);
      }
    });
  }

  // INICIO DE SESIÓN
  if (formLogin) {
    formLogin.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      limpiarMensaje();
      bloquearFormulario(formLogin, true);

      const correo = formLogin.elements["correo"].value.trim();
      const clave = formLogin.elements["password"].value;

      if (!correo || !clave) {
        mostrarMensaje(
          "Escribe tu correo y contraseña.",
          "warning"
        );
        bloquearFormulario(formLogin, false);
        return;
      }

      try {
        const { data, error } =
          await supabaseClient.auth.signInWithPassword({
            email: correo,
            password: clave
          });

        if (error) throw error;

        mostrarMensaje(
          `¡Bienvenido${data.user?.email ? `, ${data.user.email}` : ""}! Has iniciado sesión correctamente.`,
          "success"
        );

        formLogin.reset();
      } catch (error) {
        console.error("Error al iniciar sesión:", error);
        mostrarMensaje(mensajeError(error), "danger");
      } finally {
        bloquearFormulario(formLogin, false);
      }
    });
  }

  // Mantener el mensaje accesible y visible en el modal.
  if (authOverlay && mensajeAuth) {
    authOverlay.addEventListener("click", () => {
      // El mensaje se conserva hasta que el usuario cambie de formulario
      // o vuelva a enviar uno de los formularios.
    });
  }
});
