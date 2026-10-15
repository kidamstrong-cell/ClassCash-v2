function showErr(m) {
  const p = document.createElement('pre');
  p.textContent = 'ERROR: ' + m;
  p.style.cssText = 'background:#fee2e2;color:#991b1b;padding:10px;font-size:12px;white-space:pre-wrap;position:relative;z-index:99';
  document.body.prepend(p);
}
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr((e.reason && e.reason.message) || e.reason));

// ClassCash v2 - semua data lewat Supabase. Hak akses dijaga RLS di server;
// pengecekan peran di sini hanya untuk menyembunyikan tombol.
const sb = supabase.createClient(CONFIG.url, CONFIG.key);
const $ = s => document.querySelector(s);
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const BLN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const S = { tab: 'dash', user: null, prof: null, cls: null, y: now.getFullYear(), m: now.getMonth() + 1, w: Math.min(5, Math.ceil(now.getDate() / 7)) };

// Membuat elemen dengan textContent (aman dari XSS, tidak memakai innerHTML)
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k.startsWith('on')) e[k] = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  kids.flat().forEach(c => e.append(c instanceof Node ? c : String(c ?? '')));
  return e;
}
function toast(t, bad) {
  const el = $('#toast'); el.textContent = t; el.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.className = '', 2600);
}
const isB = () => S.prof.role === 'bendahara';
const mount = (...n) => { const a = $('#app'); a.replaceChildren(...n.flat()); };

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  S.user = session.user;
  const { data: p } = await sb.from('profiles').select('full_name,role,class_id').eq('id', S.user.id).maybeSingle();
  const { data: c } = await sb.from('classes').select('id,name,weekly_amount').maybeSingle();
  if (!p || !c) { await sb.auth.signOut(); return showLogin('Akun belum terhubung ke kelas.'); }
  S.prof = p; S.cls = c; showApp();
}

function showLogin(msg) {
  const em = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'username' });
  const pw = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const err = h('p', { class: 'out' }, msg || '');
  const btn = h('button', { class: 'p w' }, 'Masuk');
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Memuat...';
    const { error } = await sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
    if (error) { err.textContent = 'Email atau password salah'; btn.disabled = false; btn.textContent = 'Masuk'; return; }
    init();
  };
  mount(h('div', { class: 'login' }, h('h1', {}, 'ClassCash'), h('p', {}, 'Kas digital kelas'), em, pw, err, btn));
  $('nav')?.remove();
}

function showApp() {
  document.querySelector('nav')?.remove();
  const tabs = [['dash', '🏠', 'Dashboard'], ['kas', '💰', 'Kas'], ['lap', '📒', 'Laporan'], ['akun', '👤', 'Akun']];
  const nav = h('nav', {}, h('div', {}, tabs.map(([k, i, l]) => h('button', { class: k === S.tab ? 'on' : '', onclick: () => { S.tab = k; showApp(); } }, h('span', {}, i), l))));
  document.body.append(nav);
  ({ dash, kas, lap, akun })[S.tab]();
}

const pageTop = t => h('div', { class: 'top' }, h('h1', {}, t), h('span', { class: 'badge' }, S.prof.role));

function txRow(t, onDone) {
  const inc = t.type === 'income';
  const del = h('button', { class: 'd' }, '✕');
  del.onclick = async () => {
    if (!confirm('Hapus catatan ini?')) return;
    const { error } = await sb.from('transactions').delete().eq('id', t.id);
    error ? toast(error.message, 1) : (toast('Dihapus'), onDone());
  };
  return h('div', { class: 'row' },
    h('div', {}, t.description, h('small', {}, new Date(t.tx_date).toLocaleDateString('id-ID'))),
    h('div', { class: 'acts' }, h('b', { class: inc ? 'in' : 'out' }, (inc ? '+ ' : '- ') + rp(t.amount)),
      isB() && !t.student_id && onDone ? del : ''));
}

// ---------- F5: Dashboard ----------
async function dash() {
  mount(pageTop('Dashboard'), h('p', { class: 'empty' }, 'Memuat...'));
  const [b, t] = await Promise.all([
    sb.from('class_balance').select('*').maybeSingle(),
    sb.from('transactions').select('id,type,amount,description,tx_date,student_id').order('tx_date', { ascending: false }).order('created_at', { ascending: false }).limit(5)
  ]);
  const bal = b.data || { balance: 0, total_income: 0, total_expense: 0 };
  mount(pageTop('Dashboard'),
    h('div', { class: 'card hero' }, h('small', {}, 'Saldo kas ' + S.cls.name), h('b', {}, rp(bal.balance))),
    h('div', { class: 'grid' },
      h('div', { class: 'card' }, h('small', {}, 'Pemasukan'), h('b', { class: 'in' }, rp(bal.total_income))),
      h('div', { class: 'card' }, h('small', {}, 'Pengeluaran'), h('b', { class: 'out' }, rp(bal.total_expense)))),
    h('div', { class: 'card' }, h('h2', {}, 'Transaksi terakhir'),
      t.data?.length ? t.data.map(x => txRow(x)) : h('p', { class: 'empty' }, 'Belum ada transaksi')));
}

// ---------- F3: Kas mingguan (dicicil, status otomatis) ----------
async function kas() {
  const W = S.cls.weekly_amount;
  const [st, py] = await Promise.all([
    sb.from('students').select('id,name').eq('active', true).order('name'),
    sb.from('weekly_payments').select('id,student_id,created_at,transactions(amount)').eq('year', S.y).eq('month', S.m).eq('week', S.w)
  ]);
  const info = {};
  (py.data || []).forEach(p => {
    const a = [].concat(p.transactions)[0]?.amount || 0, i = info[p.student_id] ||= { paid: 0, last: null, at: '' };
    i.paid += a; if (p.created_at >= i.at) { i.at = p.created_at; i.last = p.id; }
  });
  const call = async (fn, args) => {
    const { error } = await sb.rpc(fn, args);
    error ? toast(error.message, 1) : (toast('Tersimpan'), kas());
  };
  const pay = (id, amt) => call('add_weekly_payment', { p_student: id, p_year: S.y, p_month: S.m, p_week: S.w, p_amount: amt });
  const students = st.data || [];
  const lunas = students.filter(s => (info[s.id]?.paid || 0) >= W).length;
  const total = Object.values(info).reduce((a, i) => a + i.paid, 0);
  const step = (lbl, f) => h('button', { onclick: f }, lbl);
  const nm = h('input', { placeholder: 'Nama siswa baru' });
  const add = h('button', { class: 'p w' }, '+ Tambah siswa');
  add.onclick = async () => {
    if (!nm.value.trim()) return toast('Nama wajib diisi', 1);
    const { error } = await sb.from('students').insert({ class_id: S.cls.id, name: nm.value.trim() });
    error ? toast(error.message, 1) : (toast('Siswa ditambah'), kas());
  };
    const rename = async s => {
    const n = prompt('Nama baru untuk ' + s.name, s.name);
    if (n === null || !n.trim() || n.trim() === s.name) return;
    const { error } = await sb.from('students').update({ name: n.trim() }).eq('id', s.id);
    error ? toast(error.message, 1) : (toast('Nama diubah'), kas());
  };
  const off = async s => {
    if (!confirm('Nonaktifkan ' + s.name + '? Riwayat uangnya tetap ada di laporan.')) return;
    const { error } = await sb.from('students').update({ active: false }).eq('id', s.id);
    error ? toast(error.message, 1) : (toast('Siswa dinonaktifkan'), kas());
  };
  mount(pageTop('Kas Mingguan'),
    h('div', { class: 'card' },
      h('div', { class: 'nav2' }, step('‹', () => { S.m--; if (S.m < 1) { S.m = 12; S.y--; } kas(); }), h('span', {}, BLN[S.m - 1] + ' ' + S.y), step('›', () => { S.m++; if (S.m > 12) { S.m = 1; S.y++; } kas(); })),
      h('div', { class: 'nav2' }, step('‹', () => { if (S.w > 1) { S.w--; kas(); } }), h('span', {}, 'Minggu ' + S.w + ' · ' + rp(W)), step('›', () => { if (S.w < 5) { S.w++; kas(); } })),
      h('small', { class: 'empty' }, `${lunas} lunas · ${students.length - lunas} belum · terkumpul ${rp(total)}`)),
    h('div', { class: 'card' },
      students.length ? students.map(s => {
        const i = info[s.id] || { paid: 0 }, stt = i.paid >= W ? 'Lunas' : i.paid > 0 ? 'Sebagian' : 'Belum';
        return h('div', { class: 'row' },
          h('div', {}, s.name, h('small', {}, rp(i.paid) + ' / ' + rp(W))),
          h('div', { class: 'acts' }, h('span', { class: 'st ' + stt }, stt),
            isB() ? [
              h('button', { disabled: i.paid >= W ? 'disabled' : null, onclick: () => pay(s.id, Math.min(1000, W - i.paid)) }, '+1rb'),
              h('button', { disabled: i.paid >= W ? 'disabled' : null, onclick: () => pay(s.id, W - i.paid) }, 'Lunasi'),
              h('button', { class: 'd', disabled: i.last ? null : 'disabled', onclick: () => confirm('Batalkan pembayaran terakhir?') && call('remove_weekly_payment', { p_payment: i.last }) }, '↩')
            ] : ''));
      }) : h('p', { class: 'empty' }, 'Belum ada siswa')),
         isB() ? h('div', { class: 'card' }, h('h2', {}, 'Tambah siswa'), nm, add) : '',
    isB() && students.length ? h('div', { class: 'card' }, h('h2', {}, 'Kelola siswa'),
      students.map(s => h('div', { class: 'row' }, s.name,
        h('div', { class: 'acts' },
          h('button', { onclick: () => rename(s) }, 'Ubah'),
          h('button', { class: 'd', onclick: () => off(s) }, 'Nonaktifkan'))))) : '');
}

// ---------- F4 + F5: Catatan dan Laporan ----------
async function lap() {
  const mv = `${S.y}-${pad(S.m)}`;
  const from = `${mv}-01`, nx = new Date(S.y, S.m, 1), to = `${nx.getFullYear()}-${pad(nx.getMonth() + 1)}-01`;
  const { data } = await sb.from('transactions').select('id,type,amount,description,tx_date,student_id').gte('tx_date', from).lt('tx_date', to).order('tx_date', { ascending: false }).order('created_at', { ascending: false });
  const list = data || [];
  const inc = list.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const exp = list.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const mi = h('input', { type: 'month', value: mv });
  mi.onchange = () => { const [y, m] = mi.value.split('-'); if (y && m) { S.y = +y; S.m = +m; lap(); } };
  const ty = h('select', {}, h('option', { value: 'expense' }, 'Pengeluaran'), h('option', { value: 'income' }, 'Pemasukan lain'));
  const ds = h('input', { placeholder: 'Keterangan (mis. Beli spidol)', maxlength: '200' });
  const am = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'Nominal (Rp)', min: '1' });
  const sv = h('button', { class: 'p w' }, 'Simpan catatan');
  sv.onclick = async () => {
    const a = parseInt(am.value, 10);
    if (!ds.value.trim() || !(a > 0)) return toast('Isi keterangan dan nominal', 1);
    if (!confirm(`Simpan ${ty.value === 'income' ? 'pemasukan' : 'pengeluaran'} ${rp(a)} - ${ds.value.trim()}?`)) return;
    const { error } = await sb.from('transactions').insert({ class_id: S.cls.id, type: ty.value, amount: a, description: ds.value.trim() });
    error ? toast(error.message, 1) : (toast('Tersimpan'), lap());
  };
  mount(pageTop('Laporan'),
    isB() ? h('div', { class: 'card' }, h('h2', {}, 'Tambah catatan'), ty, ds, am, sv) : '',
    h('div', { class: 'card' }, h('h2', {}, 'Riwayat'), mi,
      h('div', { class: 'grid' },
        h('div', {}, h('small', {}, 'Pemasukan'), h('b', { class: 'in' }, rp(inc))),
        h('div', {}, h('small', {}, 'Pengeluaran'), h('b', { class: 'out' }, rp(exp)))),
      list.length ? list.map(t => txRow(t, lap)) : h('p', { class: 'empty' }, 'Tidak ada transaksi bulan ini')));
}

// ---------- F1: Akun ----------
function akun() {
  const out = h('button', { class: 'd w' }, 'Keluar');
  out.onclick = async () => { await sb.auth.signOut(); S.tab = 'dash'; showLogin(); };
  mount(pageTop('Akun'), h('div', { class: 'card' },
    h('div', { class: 'row' }, h('span', {}, 'Email'), h('b', {}, S.user.email)),
    h('div', { class: 'row' }, h('span', {}, 'Peran'), h('b', {}, S.prof.role)),
    h('div', { class: 'row' }, h('span', {}, 'Kelas'), h('b', {}, S.cls.name))), out);
}

init();