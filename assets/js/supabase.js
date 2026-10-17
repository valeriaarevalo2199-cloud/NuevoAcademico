
const SUPABASE_URL = "https://trjjgjxdexpufzdbugnr.supabase.co";

// Reemplaza el texto de abajo con tu clave pública sb_publishable_...
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FNi50iCV-yVwKWvqz9nGDQ_EMf--Ole";

const { createClient } = supabase;

window.supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
console.log(
  "Cliente Supabase cargado:",
  Boolean(window.supabaseClient)
);

(async () => {
  const { data, error } = await window.supabaseClient
    .from("categorias")
    .select("nombre")
    .eq("activa", true);

  if (error) {
    console.error("Error al consultar categorías:", error.message);
    return;
  }

  console.log("Conexión con la base de datos correcta.");
  console.log("Categorías encontradas:", data.length);
  console.table(data);
})();
