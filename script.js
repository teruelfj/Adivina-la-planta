/* =========================================================
   ADIVINA LA PLANTA
   ---------------------------------------------------------
   Estructura esperada:
     index.html, style.css, script.js
     img/  <- aquí van las fotos
   Nombres de imagen (ejemplos):
     img/Quercus ilex.jpg          (una sola imagen)
     img/Quercus ilex 1.jpg        (varias: 1, 2, 3...)
     También se detectan "Quercus_ilex_1.png", "Quercus ilex1.webp", etc.
   ========================================================= */

const CARPETA_IMG = "img";
const EXTENSIONES = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG"];
const SEPARADORES = [" ", "_", "", "-"];
const MAX_IMAGENES = 30;

/* `archivo`: nombre base del fichero si difiere del nombre.
   `alias`: otras respuestas válidas en modo escribir. */
const PLANTAS = [
  { familia: "Cupresáceas", nombre: "Thuja orientalis" },
  { familia: "Cupresáceas", nombre: "Thuja occidentalis" },
  { familia: "Cupresáceas", nombre: "Juniperus oxycedrus" },
  { familia: "Cupresáceas", nombre: "Juniperus phoenicea" },

  { familia: "Fagáceas", nombre: "Quercus coccifera" },
  { familia: "Fagáceas", nombre: "Quercus ilex" },

  { familia: "Rosáceas", nombre: "Prunus spinosa" },
  { familia: "Rosáceas", nombre: "Crataegus monogyna" },
  { familia: "Rosáceas", nombre: "Amelanchier ovalis" },

  { familia: "Caprifoliáceas (Adoxáceas)", nombre: "Viburnum tinus" },
  { familia: "Asparagáceas", nombre: "Ruscus aculeatus" },
  { familia: "Buxáceas", nombre: "Buxus sempervirens" },
  { familia: "Cistáceas", nombre: "Cistus laurifolius" },
  { familia: "Ramnáceas", nombre: "Rhamnus alaternus" },
  { familia: "Aceráceas", nombre: "Acer monspessulanum" },
  { familia: "Oleáceas", nombre: "Fraxinus angustifolia" },
  { familia: "Tiliáceas", nombre: "Tilia platyphyllos" },
  { familia: "Fabáceas o Leguminosas", nombre: "Retama sphaerocarpa" },

  // Si tus fotos se llaman "Berberis sp", cambia `archivo` a "Berberis sp"
  { familia: "Berberidáceas", nombre: "Berberis thunbergii", archivo: "Berberis thunbergii",
    mostrar: "Berberis sp. (Berberis thunbergii)", alias: ["Berberis sp", "Berberis"] },

  { familia: "Ericáceas", nombre: "Arbutus unedo" }
];

/* ---------- Utilidades ---------- */
const $ = (id) => document.getElementById(id);
const barajar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const normalizar = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

function distancia(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1, d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[m][n];
}

const etiqueta = (p) => p.mostrar || p.nombre;

/* ---------- Detección de imágenes ---------- */
const cacheImagenes = new Map();
let patronPreferido = null; // {ext, sep, guiones}

function probar(url) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = url;
  });
}

async function recolectar(base, ext, sep) {
  const url = (suf) => `${CARPETA_IMG}/${base}${suf}.${ext}`;
  const encontradas = [];
  if (await probar(url(""))) encontradas.push(url(""));
  let fallos = 0, numeradas = 0;
  for (let n = 1; n <= MAX_IMAGENES; n++) {
    const u = url(sep + n);
    if (await probar(u)) { encontradas.push(u); numeradas++; fallos = 0; }
    else {
      fallos++;
      if (fallos >= 2 || numeradas > 0) break;
    }
  }
  return encontradas;
}

async function detectarImagenes(p) {
  if (cacheImagenes.has(p.nombre)) return cacheImagenes.get(p.nombre);

  const archivo = p.archivo || p.nombre;
  const bases = [archivo, archivo.replace(/ /g, "_")];

  // Combinaciones; la que funcionó antes va primero
  let combos = [];
  for (const ext of EXTENSIONES)
    for (const g of [false, true])
      for (const sep of SEPARADORES) combos.push({ ext, sep, guiones: g });
  if (patronPreferido) {
    combos = [patronPreferido, ...combos.filter(
      (c) => !(c.ext === patronPreferido.ext && c.sep === patronPreferido.sep && c.guiones === patronPreferido.guiones))];
  }

  let resultado = [];
  for (const c of combos) {
    const base = c.guiones ? bases[1] : bases[0];
    if (c.guiones && bases[0] === bases[1]) continue;
    resultado = await recolectar(base, c.ext, c.sep);
    if (resultado.length) { patronPreferido = c; break; }
  }
  cacheImagenes.set(p.nombre, resultado);
  return resultado;
}

/* ---------- Estado ---------- */
let estado = null;

function nuevoEstado() {
  return {
    cola: [], indice: 0, puntos: 0, aciertos: 0, racha: 0,
    fallos: [], modo: "test", estricto: false, total: 0,
    imgs: [], imgIdx: 0, nivelPista: 0, respondida: false, actual: null
  };
}

/* ---------- Inicio ---------- */
function cargarFiltro() {
  const sel = $("filtro-familia");
  const familias = [...new Set(PLANTAS.map((p) => p.familia))];
  sel.innerHTML = `<option value="">Todas las familias</option>` +
    familias.map((f) => `<option>${f}</option>`).join("");
}

async function empezar() {
  const modo = document.querySelector('input[name="modo"]:checked').value;
  const cantidad = parseInt(document.querySelector('input[name="cantidad"]:checked').value, 10);
  const familia = $("filtro-familia").value;

  let pool = PLANTAS.filter((p) => !familia || p.familia === familia);
  if (modo === "test" && PLANTAS.length < 4) { alert("Hacen falta al menos 4 plantas."); return; }

  $("btn-empezar").disabled = true;
  $("btn-empezar").textContent = "Buscando imágenes…";
  $("aviso-inicio").classList.add("oculto");

  // Comprobamos qué plantas tienen imágenes
  const conImagen = [];
  const sinImagen = [];
  for (const p of pool) {
    const imgs = await detectarImagenes(p);
    (imgs.length ? conImagen : sinImagen).push(p);
  }

  $("btn-empezar").disabled = false;
  $("btn-empezar").textContent = "Empezar";

  if (!conImagen.length) {
    const av = $("aviso-inicio");
    av.textContent = `No he encontrado ninguna imagen en la carpeta "${CARPETA_IMG}/". ` +
      `Comprueba que existe, que los archivos se llaman como la planta (p. ej. "Quercus ilex 1.jpg") ` +
      `y que abres la web con un servidor local (no con file://).`;
    av.classList.remove("oculto");
    return;
  }
  if (sinImagen.length) {
    const av = $("aviso-inicio");
    av.textContent = "Sin imágenes (excluidas): " + sinImagen.map(etiqueta).join(", ");
    av.classList.remove("oculto");
    console.warn("Plantas sin imágenes:", sinImagen.map((p) => p.nombre));
  }

  estado = nuevoEstado();
  estado.modo = modo;
  estado.estricto = modo === "escribir" && $("estricto").checked;
  let cola = barajar(conImagen);
  if (cantidad > 0) cola = cola.slice(0, cantidad);
  estado.cola = cola;
  estado.total = cola.length;

  $("inicio").classList.add("oculto");
  $("fin").classList.add("oculto");
  $("juego").classList.remove("oculto");
  $("marcador").classList.remove("oculto");
  $("total-preguntas").textContent = estado.total;
  mostrarPregunta();
}

/* ---------- Pregunta ---------- */
function mostrarPregunta() {
  const e = estado;
  const p = e.cola[e.indice];
  e.actual = p;
  e.imgs = cacheImagenes.get(p.nombre);
  e.imgIdx = 0;
  e.nivelPista = 0;
  e.respondida = false;

  $("num-pregunta").textContent = e.indice + 1;
  $("puntos").textContent = e.puntos;
  $("racha").textContent = e.racha;
  $("texto-pista").textContent = "";
  $("btn-pista").disabled = false;
  $("feedback").classList.add("oculto");
  $("btn-siguiente").classList.add("oculto");
  $("btn-saltar").classList.remove("oculto");

  mostrarImagen();

  if (e.modo === "test") {
    $("zona-test").classList.remove("oculto");
    $("zona-escribir").classList.add("oculto");
    montarOpciones(p);
  } else {
    $("zona-test").classList.add("oculto");
    $("zona-escribir").classList.remove("oculto");
    const inp = $("entrada");
    inp.value = ""; inp.disabled = false;
    $("zona-escribir").querySelector("button").disabled = false;
    inp.focus();
  }
}

function mostrarImagen() {
  const e = estado;
  const img = $("imagen");
  $("cargando").classList.remove("oculto");
  img.onload = () => $("cargando").classList.add("oculto");
  img.onerror = () => { $("cargando").textContent = "No se pudo cargar la imagen"; };
  img.src = e.imgs[e.imgIdx];

  const multiple = e.imgs.length > 1;
  $("btn-prev").classList.toggle("oculto", !multiple);
  $("btn-next").classList.toggle("oculto", !multiple);
  const cont = $("puntitos");
  cont.innerHTML = "";
  if (multiple) {
    e.imgs.forEach((_, i) => {
      const s = document.createElement("span");
      if (i === e.imgIdx) s.classList.add("activo");
      s.onclick = () => { e.imgIdx = i; mostrarImagen(); };
      cont.appendChild(s);
    });
  }
}

function cambiarImagen(delta) {
  const e = estado;
  if (!e || e.imgs.length < 2) return;
  e.imgIdx = (e.imgIdx + delta + e.imgs.length) % e.imgs.length;
  mostrarImagen();
}

function montarOpciones(p) {
  const genero = p.nombre.split(" ")[0];
  const otras = PLANTAS.filter((x) => x.nombre !== p.nombre);
  const mismas = barajar(otras.filter((x) => x.familia === p.familia || x.nombre.startsWith(genero)));
  const resto = barajar(otras.filter((x) => !mismas.includes(x)));
  const distractores = [...mismas.slice(0, 1), ...resto].slice(0, 3);
  const opciones = barajar([p, ...distractores]);

  const cont = $("zona-test");
  cont.innerHTML = "";
  opciones.forEach((o) => {
    const b = document.createElement("button");
    b.textContent = etiqueta(o);
    b.dataset.nombre = o.nombre;
    b.onclick = () => responderTest(o, b);
    cont.appendChild(b);
  });
}

/* ---------- Respuestas ---------- */
function puntuar(acierto) {
  const e = estado;
  e.respondida = true;
  if (acierto) {
    e.puntos += e.nivelPista > 0 ? 0.5 : 1;
    e.aciertos++;
    e.racha++;
  } else {
    e.racha = 0;
    e.fallos.push(e.actual);
  }
  $("puntos").textContent = e.puntos;
  $("racha").textContent = e.racha;
  $("btn-pista").disabled = true;
  $("btn-saltar").classList.add("oculto");
  $("btn-siguiente").classList.remove("oculto");
  $("btn-siguiente").textContent = e.indice + 1 >= e.total ? "Ver resultado" : "Siguiente →";
  $("btn-siguiente").focus();
}

function mostrarFeedback(acierto, extra = "") {
  const p = estado.actual;
  const fb = $("feedback");
  fb.className = "feedback " + (acierto ? "ok" : "mal");
  fb.innerHTML = (acierto ? "✅ <b>¡Correcto!</b> " : "❌ <b>Era:</b> ") +
    `<em>${etiqueta(p)}</em> — ${p.familia}.` + extra +
    (estado.nivelPista > 0 && acierto ? " (½ punto por usar pista)" : "");
}

function responderTest(opcion, boton) {
  if (estado.respondida) return;
  const acierto = opcion.nombre === estado.actual.nombre;
  document.querySelectorAll("#zona-test button").forEach((b) => {
    b.disabled = true;
    if (b.dataset.nombre === estado.actual.nombre) b.classList.add("correcta");
  });
  if (!acierto) boton.classList.add("incorrecta");
  puntuar(acierto);
  mostrarFeedback(acierto);
}

// Estricto: las letras deben ser exactas (se ignoran mayúsculas y espacios sobrantes)
const normalizarEstricto = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

function comprobarEscrito(texto) {
  const p = estado.actual;
  const t = normalizar(texto);
  if (!t) return null;
  const nombres = [p.nombre, ...(p.alias || [])];

  // Coincidencia exacta (letra por letra)
  const tEstricto = normalizarEstricto(texto);
  if (nombres.some((n) => normalizarEstricto(n) === tEstricto)) return { ok: true, aprox: false };

  // Con tolerancia a erratas pequeñas
  const validas = nombres.map(normalizar);
  let cercano = validas.includes(t);
  if (!cercano) {
    cercano = validas.some((v) => distancia(t, v) <= (v.length > 14 ? 2 : 1));
  }
  if (cercano) {
    // En modo estricto una errata es un fallo
    return estado.estricto ? { ok: false, casi: true } : { ok: true, aprox: true };
  }
  return { ok: false };
}

function responderEscrito(e) {
  e.preventDefault();
  if (estado.respondida) return;
  const r = comprobarEscrito($("entrada").value);
  if (r === null) return;
  $("entrada").disabled = true;
  $("zona-escribir").querySelector("button").disabled = true;
  puntuar(r.ok);
  let extra = "";
  if (r.aprox) extra = " (con una errata, pero te la doy por buena)";
  if (r.casi) extra = ` Estabas muy cerca, pero en modo estricto cuenta como fallo (escribiste «${$("entrada").value.trim()}»).`;
  mostrarFeedback(r.ok, extra);
}

function saltar() {
  if (estado.respondida) return;
  document.querySelectorAll("#zona-test button").forEach((b) => {
    b.disabled = true;
    if (b.dataset.nombre === estado.actual.nombre) b.classList.add("correcta");
  });
  $("entrada").disabled = true;
  $("zona-escribir").querySelector("button").disabled = true;
  puntuar(false);
  mostrarFeedback(false);
}

/* ---------- Pistas ---------- */
function darPista() {
  const e = estado;
  if (e.respondida || e.nivelPista >= 2) return;
  e.nivelPista++;
  const p = e.actual;
  if (e.nivelPista === 1) $("texto-pista").textContent = `Familia: ${p.familia}`;
  else {
    $("texto-pista").textContent = `Familia: ${p.familia} · Género: ${p.nombre.split(" ")[0]}`;
    $("btn-pista").disabled = true;
  }
}

/* ---------- Flujo ---------- */
function siguiente() {
  estado.indice++;
  if (estado.indice >= estado.total) return terminar();
  mostrarPregunta();
}

function terminar() {
  const e = estado;
  $("juego").classList.add("oculto");
  $("marcador").classList.add("oculto");
  $("fin").classList.remove("oculto");
  $("res-puntos").textContent = e.puntos;
  $("res-aciertos").textContent = e.aciertos;
  $("res-total").textContent = e.total;

  const rep = $("repaso");
  if (e.fallos.length) {
    rep.innerHTML = "<h3>Para repasar:</h3><ul>" +
      e.fallos.map((p) => `<li><em>${etiqueta(p)}</em> — ${p.familia}</li>`).join("") + "</ul>";
  } else {
    rep.innerHTML = "<h3>🎉 ¡Sin fallos!</h3>";
  }
}

function reiniciar() {
  $("fin").classList.add("oculto");
  $("inicio").classList.remove("oculto");
}

/* ---------- Eventos ---------- */
$("btn-empezar").onclick = empezar;
$("btn-reiniciar").onclick = reiniciar;
$("btn-siguiente").onclick = siguiente;
$("btn-saltar").onclick = saltar;
$("btn-pista").onclick = darPista;
$("btn-prev").onclick = () => cambiarImagen(-1);
$("btn-next").onclick = () => cambiarImagen(1);
$("zona-escribir").addEventListener("submit", responderEscrito);

document.addEventListener("keydown", (ev) => {
  if ($("juego").classList.contains("oculto") || !estado) return;
  if (ev.key === "ArrowLeft" && document.activeElement !== $("entrada")) cambiarImagen(-1);
  if (ev.key === "ArrowRight" && document.activeElement !== $("entrada")) cambiarImagen(1);
  if (ev.key === "Enter" && estado.respondida) { ev.preventDefault(); siguiente(); }
});

// El modo estricto solo tiene sentido al escribir
function actualizarCajaEstricto() {
  const escribir = document.querySelector('input[name="modo"]:checked').value === "escribir";
  $("caja-estricto").classList.toggle("oculto", !escribir);
}
document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", actualizarCajaEstricto));

cargarFiltro();
actualizarCajaEstricto();
