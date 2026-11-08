import * as SQLite from 'expo-sqlite';

const SUPABASE_URL = 'https://alxbydjpoxoavasklwpd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Kc8wekwUqIs78ILNF-j-Qg_LNMYRhn0';

const HEADERS_ESQ2 = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Accept-Profile': 'esquema2',
  'Content-Profile': 'esquema2',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache'
};

let dbLocal = null;

async function obtenerSqlite() {
  if (!dbLocal) {
    dbLocal = await SQLite.openDatabaseAsync('motor_universal_esquema2_v1.db');
    await dbLocal.execAsync(`
      CREATE TABLE IF NOT EXISTS cache_contratos_json (
        modulo TEXT PRIMARY KEY NOT NULL,
        version_num INTEGER NOT NULL,
        version_txt TEXT NOT NULL,
        json_data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS boveda_universal (
        clave TEXT PRIMARY KEY NOT NULL,
        valor_json TEXT NOT NULL
      );
    `);
  }
  return dbLocal;
}

async function fetchSeguro(url, opciones = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opciones, signal: ctrl.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function ejecutarRpcUniversal(nombreRpc, payload = {}) {
  try {
    const res = await fetchSeguro(`${SUPABASE_URL}/rest/v1/rpc/${nombreRpc}`, {
      method: 'POST',
      headers: HEADERS_ESQ2,
      body: JSON.stringify(payload)
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(txt);
    return txt ? JSON.parse(txt) : { exito: true };
  } catch (e) {
    return { exito: false, mensaje: e.message };
  }
}

export async function guardarDatoBoveda(clave, objeto) {
  const db = await obtenerSqlite();
  await db.runAsync('INSERT OR REPLACE INTO boveda_universal (clave, valor_json) VALUES (?, ?);', [clave, JSON.stringify(objeto)]);
}

export async function leerDatoBoveda(clave) {
  const db = await obtenerSqlite();
  const f = await db.getFirstAsync('SELECT valor_json FROM boveda_universal WHERE clave = ?;', [clave]);
  return f ? JSON.parse(f.valor_json) : null;
}

export async function sincronizarContratoSdui(modulo = 'MODULO_MAESTRO_V1') {
  const db = await obtenerSqlite();
  const local = await db.getFirstAsync('SELECT * FROM cache_contratos_json WHERE modulo = ?;', [modulo]);
  const verLocal = local ? local.version_num : 0;

  try {
    const check = await ejecutarRpcUniversal('esq1_rpc_verificar_version', {
      p_modulo: modulo,
      p_version_cliente: verLocal
    });

    if (check && check.requiere_descarga && check.contrato) {
      await db.runAsync(
        'INSERT OR REPLACE INTO cache_contratos_json (modulo, version_num, version_txt, json_data) VALUES (?, ?, ?, ?);',
        [modulo, check.version_numero, check.version_etiqueta, JSON.stringify(check.contrato)]
      );
      return { origen: 'NUBE_ESQ2', version: check.version_etiqueta, contrato: check.contrato };
    }
  } catch (e) {}

  if (local) {
    return { origen: 'SQLITE_ESQ2', version: local.version_txt, contrato: JSON.parse(local.json_data) };
  }
  return { origen: 'INICIAL_ESQ2', version: 'V1', contrato: null };
}