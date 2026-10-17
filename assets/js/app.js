
"use strict";

/**
 * Académico Fácil
 * Funciones generales de la página pública.
 */

document.addEventListener("DOMContentLoaded", () => {
  const currentYear = document.getElementById("currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }
});
