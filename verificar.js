// Verifica el comprobante cuyo código viene después de "#" en la dirección.
// El código es "<datos>.<firma>", ambos en base64url; los datos son un JSON firmado con Ed25519
// por la app de la tesorería. Aquí solo está la clave pública (config.json): sirve para comprobar
// firmas, no para crearlas.
import { verifyAsync } from './vendor/ed25519.js';

const resultado = document.querySelector('#resultado');

function base64url(texto) {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = '='.repeat((4 - (normal.length % 4)) % 4);
  return Uint8Array.from(atob(normal + relleno), (c) => c.charCodeAt(0));
}

/** Muestra un estado. Todo el contenido variable va como texto, nunca como HTML. */
function mostrar(titulo, clase, parrafos, detalle = []) {
  resultado.replaceChildren();
  const h1 = document.createElement('h1');
  h1.textContent = titulo;
  if (clase) h1.className = clase;
  resultado.append(h1);
  for (const [texto, extra] of parrafos) {
    const p = document.createElement('p');
    p.textContent = texto;
    if (extra) p.className = extra;
    resultado.append(p);
  }
  if (detalle.length) {
    const dl = document.createElement('dl');
    for (const [termino, valor] of detalle) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = termino;
      dd.textContent = valor;
      dl.append(dt, dd);
    }
    // El detalle va justo después del título, antes de las notas.
    h1.after(dl);
  }
}

const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'UTC' }).format(Date.UTC(a, m - 1, d));
};

async function verificar() {
  let config;
  try {
    const respuesta = await fetch('config.json', { cache: 'no-store' });
    if (!respuesta.ok) throw new Error(respuesta.status);
    config = await respuesta.json();
  } catch {
    mostrar('No se pudo verificar', 'invalido', [['No se pudo cargar la información de verificación. Revisa tu conexión e intenta de nuevo.']]);
    return;
  }
  if (config.nombreCoro) {
    document.querySelector('#organizacion').textContent = config.nombreCoro;
  }

  const codigo = decodeURIComponent(location.hash.slice(1));
  if (!codigo) {
    mostrar('Verificar un comprobante', '', [
      ['Escanea con la cámara del celular el código QR que aparece en el comprobante de pago. Se abrirá esta página con el resultado.'],
    ]);
    return;
  }

  let datos;
  let bytes;
  let firma;
  try {
    const [parteDatos, parteFirma, ...resto] = codigo.split('.');
    if (resto.length || !parteDatos || !parteFirma) throw new Error('formato');
    bytes = base64url(parteDatos);
    firma = base64url(parteFirma);
    datos = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!Array.isArray(datos) || datos[0] !== 1 || datos.length !== 9) throw new Error('versión');
  } catch {
    mostrar('Código no válido', 'invalido', [
      ['El código del comprobante está incompleto o dañado. Vuelve a escanear el QR; si el problema sigue, el comprobante no es auténtico.'],
    ]);
    return;
  }

  const [, idClave, folio, fecha, nombre, concepto, total, moneda, tesorero] = datos;
  const clave = config.claves?.[idClave];
  if (!clave) {
    mostrar('No se pudo verificar', 'invalido', [
      ['El comprobante fue firmado con una clave que esta página no reconoce. Consulta directamente con la tesorería del coro.'],
    ]);
    return;
  }

  let valido = false;
  try {
    valido = firma.length === 64 && await verifyAsync(firma, bytes, base64url(clave.publica));
  } catch {
    valido = false;
  }
  if (!valido) {
    mostrar('Comprobante no válido', 'invalido', [
      ['La firma no corresponde a los datos. El código fue alterado o el comprobante no fue emitido por la tesorería del coro.'],
      ['Si recibiste este comprobante como respaldo de un pago, consulta directamente con la tesorería.'],
    ]);
    return;
  }

  let monto = String(total);
  try {
    monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: moneda }).format(total);
  } catch { /* moneda desconocida: se muestra el número tal cual */ }

  mostrar('Comprobante auténtico', 'valido', [
    ['Estos datos fueron firmados por la tesorería del coro. Compáralos con los del comprobante que tienes: si alguno no coincide, el documento fue modificado.', 'nota'],
  ], [
    ['Folio', String(folio).padStart(6, '0')],
    ['Recibido de', nombre],
    ['Concepto', concepto],
    ['Total pagado', monto],
    ['Emitido el', fechaLarga(fecha)],
    ...(tesorero ? [['Firmado por', `${tesorero}, tesorero`]] : []),
  ]);
}

window.addEventListener('hashchange', verificar);
verificar();
