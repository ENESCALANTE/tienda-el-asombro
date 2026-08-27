import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  ShoppingBag, Search, ShoppingCart, X, Plus, Minus, ExternalLink, 
  MessageCircle, ArrowLeft, Lock, Edit3, Trash2, Tag, Check, Image as ImageIcon, KeyRound, LogOut, Upload, Loader2, Settings, Sparkles, MapPin
} from 'lucide-react';
import ModalProducto from './components/ModalProducto';

const CLOUDINARY_CLOUD_NAME = "okej62yk"; 
const CLOUDINARY_UPLOAD_PRESET = "preset_elasombro";

export default function App() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloOfertas, setSoloOfertas] = useState(false);

  // Estado para controlar el Producto Seleccionado en el Modal
  const [productoModal, setProductoModal] = useState(null);

  // Configuración Negocio con Logo Local (/logo.jpg) y WhatsApp Real
  const [configNegocio, setConfigNegocio] = useState({
    id: null,
    nombre: 'TIENDA EL ASOMBRO',
    subtitulo: 'BLANQUERÍA, NOVEDADES & BAZAR',
    logo_url: '/logo.jpg',
    whatsapp: '5493462368051'
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Carrito
  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Modo Admin (Supabase Auth)
  const [esAdmin, setEsAdmin] = useState(false);
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const [cargandoAuth, setCargandoAuth] = useState(false);
  
  // Formulario Producto Admin
  const [productoEditar, setProductoEditar] = useState(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [formProd, setFormProd] = useState({
    titulo: '',
    categoria: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
    imagen_url: ''
  });

  const GUIA_CLIC_URL = "https://guiaclic.com.ar";

  useEffect(() => {
    fetchProductos();
    fetchConfigNegocio();
    verificarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEsAdmin(!!session);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    setEsAdmin(!!session);
  }

  async function fetchProductos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tienda_el_asombro')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      setProductos(data || []);
    } catch (error) {
      console.error('Error cargando productos:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfigNegocio() {
    try {
      const { data, error } = await supabase
        .from('config_tienda_el_asombro')
        .select('*')
        .limit(1)
        .single();

      if (data) {
        setConfigNegocio((prev) => ({
          ...data,
          logo_url: data.logo_url || prev.logo_url
        }));
      }
    } catch (error) {
      console.error('Error cargando datos del negocio:', error.message);
    }
  }

  const handleSubirImagen = async (e, esLogo = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (esLogo) setSubiendoLogo(true);
      else setSubiendoImagen(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.secure_url) {
        if (esLogo) {
          setConfigNegocio((prev) => ({ ...prev, logo_url: data.secure_url }));
        } else {
          setFormProd((prev) => ({ ...prev, imagen_url: data.secure_url }));
        }
      } else {
        throw new Error(data.error?.message || 'Error al subir la imagen');
      }
    } catch (error) {
      alert('Error al subir la imagen: ' + error.message);
    } finally {
      if (esLogo) setSubiendoLogo(false);
      else setSubiendoImagen(false);
    }
  };

  const guardarConfigNegocio = async (e) => {
    e.preventDefault();
    try {
      if (configNegocio.id) {
        const { error } = await supabase
          .from('config_tienda_el_asombro')
          .update({
            nombre: configNegocio.nombre,
            subtitulo: configNegocio.subtitulo,
            logo_url: configNegocio.logo_url,
            whatsapp: configNegocio.whatsapp
          })
          .eq('id', configNegocio.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('config_tienda_el_asombro')
          .insert([{
            nombre: configNegocio.nombre,
            subtitulo: configNegocio.subtitulo,
            logo_url: configNegocio.logo_url,
            whatsapp: configNegocio.whatsapp
          }])
          .select()
          .single();
        if (error) throw error;
        if (data) setConfigNegocio(data);
      }
      alert('¡Configuración guardada!');
    } catch (error) {
      alert('Error al guardar datos del negocio: ' + error.message);
    }
  };

  const handleLoginAdmin = async (e) => {
    e.preventDefault();
    setErrorPassword('');
    setCargandoAuth(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });

      if (error) throw error;

      setEsAdmin(true);
      setModalAdminAbierto(false);
      setEmailInput('');
      setPasswordInput('');
    } catch (error) {
      setErrorPassword('Email o contraseña incorrectos.');
    } finally {
      setCargandoAuth(false);
    }
  };

  const handleLogoutAdmin = async () => {
    await supabase.auth.signOut();
    setEsAdmin(false);
  };

  const agregarAlCarrito = (producto, e) => {
    if (e) e.stopPropagation();
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      const precioFinal = producto.precio_oferta ? Number(producto.precio_oferta) : Number(producto.precio);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, precioEfectivo: precioFinal, cantidad: 1 }];
    });
    setCarritoAbierto(true);
  };

  const modificarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nuevaCant = item.cantidad + delta;
            return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const vaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;
    setCarrito([]);
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + item.precioEfectivo * item.cantidad, 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  const enviarPedidoWhatsApp = () => {
    if (carrito.length === 0) return;
    let mensaje = `Hola! Quisiera realizar la siguiente compra en *${configNegocio.nombre}*:\n\n`;
    carrito.forEach((item) => {
      mensaje += `• *${item.titulo}* x${item.cantidad} - $${item.precioEfectivo * item.cantidad}\n`;
    });
    mensaje += `\n*TOTAL ESTIMADO: $${totalCarrito}*`;

    const wsNumber = configNegocio.whatsapp || "5493462368051";
    window.open(`https://wa.me/${wsNumber}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const normalizarCategoria = (valorIngresado) => {
    const limpio = (valorIngresado || '').trim();
    if (!limpio) return '';
    const existente = categorias.find((c) => c.toLowerCase() === limpio.toLowerCase());
    if (existente) return existente;
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        titulo: formProd.titulo,
        categoria: normalizarCategoria(formProd.categoria),
        descripcion: formProd.descripcion || '',
        precio: Number(formProd.precio) || 0,
        precio_oferta: formProd.precio_oferta ? Number(formProd.precio_oferta) : null,
        imagen_url: formProd.imagen_url
      };

      if (productoEditar) {
        const { error } = await supabase
          .from('tienda_el_asombro')
          .update(payload)
          .eq('id', productoEditar.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tienda_el_asombro')
          .insert([payload]);
        if (error) throw error;
      }

      setFormProd({ titulo: '', categoria: '', descripcion: '', precio: '', precio_oferta: '', imagen_url: '' });
      setProductoEditar(null);
      fetchProductos();
    } catch (err) {
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const editarProducto = (prod, e) => {
    if (e) e.stopPropagation();
    setProductoEditar(prod);
    setFormProd({
      titulo: prod.titulo || '',
      categoria: prod.categoria || '',
      descripcion: prod.descripcion || '',
      precio: prod.precio || '',
      precio_oferta: prod.precio_oferta || '',
      imagen_url: prod.imagen_url || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarProducto = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm('¿Seguro que querés eliminar este producto?')) return;
    try {
      const { error } = await supabase.from('tienda_el_asombro').delete().eq('id', id);
      if (error) throw error;
      fetchProductos();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const categorias = [...new Map(
    productos
      .map((p) => (p?.categoria || '').trim())
      .filter(Boolean)
      .map((cat) => [cat.toLowerCase(), cat])
  ).values()];

  const obtenerImagenCategoria = (cat) => {
    const prod = productos.find(
      (p) => (p.categoria || '').trim().toLowerCase() === cat.trim().toLowerCase() && p.imagen_url
    );
    return prod?.imagen_url || 'https://res.cloudinary.com/okej62yk/image/upload/v1787762681/frazadas.jpg';
  };

  const productosFiltrados = productos.filter((p) => {
    const titulo = (p?.titulo || '').toLowerCase();
    const query = busqueda.toLowerCase();
    const coincideCategoria =
      !categoriaSeleccionada ||
      (p?.categoria || '').trim().toLowerCase() === categoriaSeleccionada.trim().toLowerCase();
    const coincideBusqueda = titulo.includes(query);
    const coincideOferta = !soloOfertas || (p?.precio_oferta && Number(p.precio_oferta) > 0);
    return coincideCategoria && coincideBusqueda && coincideOferta;
  });

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col justify-between font-sans antialiased">
      <div>
        {/* Banner Superior Promocional */}
        <div className="bg-zinc-950 text-amber-400 text-xs sm:text-base py-2.5 px-4 font-bold text-center flex justify-center items-center gap-2 border-b border-amber-500/20">
          <span>🚀 ENVÍOS RÁPIDOS Y ATENCIÓN PERSONALIZADA POR WHATSAPP</span>
          <a href={GUIA_CLIC_URL} target="_blank" rel="noreferrer" className="underline font-extrabold flex items-center gap-1 hover:text-amber-300">
            Ver en GuíaClic <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* HEADER PRINCIPAL */}
        <header className="bg-zinc-900 text-white sticky top-0 z-30 shadow-xl border-b border-amber-500/30">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            
            {/* LOGO + NOMBRE */}
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); }}
            >
              <img 
                src={configNegocio.logo_url || '/logo.jpg'} 
                alt={configNegocio.nombre} 
                className="w-14 h-14 rounded-full object-cover shadow-lg border-2 border-amber-400"
              />
              <div>
                <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-none text-white">{configNegocio.nombre}</h1>
                <span className="text-xs sm:text-sm text-amber-400 tracking-widest uppercase font-bold">{configNegocio.subtitulo}</span>
              </div>
            </div>

            {/* BUSCADOR DESKTOP */}
            <div className="flex-1 max-w-lg hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="¿Qué producto estás buscando?"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-5 pr-12 py-3 rounded-full text-zinc-900 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner bg-zinc-100"
                />
                <Search className="absolute right-4 top-3.5 w-5 h-5 text-zinc-500" />
              </div>
            </div>

            {/* BOTONES ACCIÓN */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCarritoAbierto(true)}
                className="relative p-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-full transition-all flex items-center gap-2 px-5 shadow-lg"
              >
                <ShoppingCart className="w-6 h-6" />
                <span className="text-sm font-black hidden sm:inline uppercase tracking-wider">Carrito</span>
                {totalItems > 0 && (
                  <span className="bg-zinc-950 text-amber-400 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                onClick={() => esAdmin ? handleLogoutAdmin() : setModalAdminAbierto(true)}
                className={`p-3 rounded-full transition-colors ${esAdmin ? 'bg-amber-400 text-zinc-950' : 'hover:bg-zinc-800 text-zinc-300'}`}
                title={esAdmin ? 'Cerrar Sesión Admin' : 'Ingresar como Admin'}
              >
                {esAdmin ? <LogOut className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* BARRA DE CATEGORÍAS */}
          <nav className="bg-zinc-950 border-t border-zinc-800 text-sm sm:text-base font-extrabold uppercase tracking-wider overflow-x-auto">
            <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center gap-10 whitespace-nowrap">
              <button 
                onClick={() => { setCategoriaSeleccionada(null); setSoloOfertas(false); setBusqueda(''); }}
                className={`hover:text-amber-400 transition-colors ${!categoriaSeleccionada && !soloOfertas ? 'text-amber-400 font-black border-b-2 border-amber-400 pb-0.5' : 'text-zinc-200'}`}
              >
                Inicio
              </button>
              <button 
                onClick={() => { setSoloOfertas(true); setCategoriaSeleccionada(null); }}
                className={`flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors ${soloOfertas ? 'font-black border-b-2 border-amber-400 pb-0.5' : ''}`}
              >
                <Tag className="w-5 h-5 fill-current" /> Ofertas Destacadas
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategoriaSeleccionada(cat); setSoloOfertas(false); }}
                  className={`capitalize hover:text-amber-400 transition-colors ${categoriaSeleccionada === cat ? 'text-amber-400 font-black border-b-2 border-amber-400 pb-0.5' : 'text-zinc-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </nav>
        </header>

        {/* Buscador Mobile */}
        <div className="md:hidden p-3 bg-white border-b border-zinc-200 shadow-sm">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-100 text-base font-medium focus:outline-none focus:bg-white border border-zinc-200"
            />
            <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-400" />
          </div>
        </div>

        {/* BANNER FULL WIDTH */}
        {!categoriaSeleccionada && !busqueda && !soloOfertas && (
          <section className="relative w-full min-h-[420px] sm:min-h-[520px] lg:min-h-[600px] flex items-center justify-center bg-zinc-950 overflow-hidden border-b border-amber-500/20">
            <img
              src={productos[0]?.imagen_url || "https://res.cloudinary.com/okej62yk/image/upload/v1787769438/logo.jpg"}
              alt="Banner Principal Tienda El Asombro"
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 text-center md:text-left flex flex-col items-center md:items-start space-y-6">
              <span className="bg-amber-400 text-zinc-950 text-xs sm:text-sm font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> SURTIDO DE ASOMBRO
              </span>
              
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight leading-none text-white max-w-4xl drop-shadow-md">
                DESCUBRÍ LO NUEVO PARA TU HOGAR
              </h2>
              
              <p className="text-zinc-200 text-base sm:text-xl lg:text-2xl font-medium leading-relaxed max-w-2xl drop-shadow">
                Blanquería, indumentaria, bazar y novedades con el mejor precio y atención personalizada.
              </p>
              
              <div className="pt-2">
                <button
                  onClick={() => setSoloOfertas(true)}
                  className="bg-amber-400 hover:bg-amber-500 text-zinc-950 px-8 py-4 rounded-2xl font-black text-sm sm:text-lg uppercase tracking-wider shadow-2xl transition-transform hover:scale-105 border-2 border-amber-300"
                >
                  VER OFERTAS DESTACADAS
                </button>
              </div>
            </div>
          </section>
        )}

        {/* PANEL ADMIN */}
        {esAdmin && (
          <section className="bg-zinc-900 text-white border-2 border-amber-500/40 p-6 max-w-7xl mx-auto my-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-amber-400 font-black text-lg sm:text-xl uppercase tracking-wide">
                <KeyRound className="w-6 h-6 text-amber-400" /> Panel de Administración
              </div>
              <button 
                onClick={handleLogoutAdmin} 
                className="text-xs font-bold bg-zinc-800 hover:bg-zinc-700 px-3.5 py-1.5 rounded-lg text-amber-400 flex items-center gap-1 border border-zinc-700"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión Admin
              </button>
            </div>

            {/* EDICIÓN DE MARCA Y LOGO */}
            <form onSubmit={guardarConfigNegocio} className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 space-y-4 shadow-sm">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> Configuración de la Marca
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Nombre del Negocio</label>
                  <input
                    type="text"
                    required
                    placeholder="TIENDA EL ASOMBRO"
                    value={configNegocio.nombre}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, nombre: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Subtítulo / Rubro</label>
                  <input
                    type="text"
                    required
                    placeholder="BLANQUERÍA. NOVEDADES & BAZAR"
                    value={configNegocio.subtitulo}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, subtitulo: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">WhatsApp de Pedidos</label>
                  <input
                    type="text"
                    required
                    placeholder="5493462368051"
                    value={configNegocio.whatsapp}
                    onChange={(e) => setConfigNegocio({ ...configNegocio, whatsapp: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Logo del Negocio</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow transition-colors">
                      {subiendoLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoLogo ? 'Subiendo...' : '📷 Cambiar Logo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleSubirImagen(e, true)} 
                        disabled={subiendoLogo} 
                        className="hidden" 
                      />
                    </label>

                    {configNegocio.logo_url && (
                      <img src={configNegocio.logo_url} alt="Logo previo" className="w-9 h-9 object-cover rounded-full border border-amber-400 shadow-sm" />
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={subiendoLogo}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Guardar Cambios de Marca
              </button>
            </form>

            {/* CARGA DE PRODUCTOS */}
            <form onSubmit={guardarProducto} className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 space-y-4 shadow-sm text-zinc-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                {productoEditar ? '✏️ Modificar Producto' : '➕ PUBLICAR NUEVO PRODUCTO'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Título / Nombre</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Frazada Térmica 2 Plazas"
                    value={formProd.titulo}
                    onChange={(e) => setFormProd({ ...formProd, titulo: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Rubro / Categoría</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Frazadas, Bazar, Regalería..."
                    value={formProd.categoria}
                    onChange={(e) => setFormProd({ ...formProd, categoria: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Precio Normal ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="28000"
                    value={formProd.precio}
                    onChange={(e) => setFormProd({ ...formProd, precio: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-400 block mb-1">Precio Oferta ($ - Opcional)</label>
                  <input
                    type="number"
                    placeholder="Ej. 24500"
                    value={formProd.precio_oferta}
                    onChange={(e) => setFormProd({ ...formProd, precio_oferta: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-rose-900/50 text-white rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold block mb-1">Descripción Breve (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Detalles sobre materiales, medidas o especificaciones"
                    value={formProd.descripcion}
                    onChange={(e) => setFormProd({ ...formProd, descripcion: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold block mb-1">Imagen del Producto</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 border border-zinc-700 transition-colors">
                      {subiendoImagen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoImagen ? 'Subiendo foto...' : '📷 Seleccionar o Tomar Foto'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleSubirImagen(e, false)} 
                        disabled={subiendoImagen} 
                        className="hidden" 
                      />
                    </label>

                    {formProd.imagen_url && (
                      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg">
                        <img src={formProd.imagen_url} alt="Vista previa" className="w-8 h-8 object-cover rounded" />
                        <span className="text-[11px] text-amber-400 font-bold">¡Imagen vinculada!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={subiendoImagen}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {productoEditar ? 'Guardar Cambios' : 'Publicar Producto'}
                </button>
                {productoEditar && (
                  <button
                    type="button"
                    onClick={() => { setProductoEditar(null); setFormProd({ titulo: '', categoria: '', descripcion: '', precio: '', precio_oferta: '', imagen_url: '' }); }}
                    className="bg-zinc-800 text-zinc-300 font-bold text-xs uppercase px-4 py-2.5 rounded-xl border border-zinc-700"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {/* LISTADO Y RUBROS */}
        <main className="max-w-7xl mx-auto px-4 py-10">
          {categoriaSeleccionada || busqueda || soloOfertas ? (
            <div>
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200">
                <button
                  onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); }}
                  className="flex items-center gap-2 text-sm font-black text-amber-600 hover:underline uppercase tracking-wider"
                >
                  <ArrowLeft className="w-5 h-5" /> Volver a la portada
                </button>
                <h2 className="text-2xl sm:text-4xl font-black text-zinc-900 uppercase tracking-tight">
                  {soloOfertas ? '🔥 Ofertas Especiales' : categoriaSeleccionada || `Búsqueda: "${busqueda}"`}
                </h2>
              </div>

              {productosFiltrados.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200 text-zinc-500 text-base font-semibold">
                  No encontramos productos para esta sección.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {productosFiltrados.map((prod) => {
                    const tieneOferta = prod.precio_oferta && Number(prod.precio_oferta) > 0;
                    return (
                      <div 
                        key={prod.id} 
                        onClick={() => setProductoModal(prod)}
                        className="bg-white rounded-3xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between relative group cursor-pointer"
                      >
                        {tieneOferta && (
                          <div className="absolute top-3 left-3 z-10 bg-rose-600 text-white text-xs font-black uppercase px-3 py-1 rounded-full shadow-md">
                            OFERTA
                          </div>
                        )}

                        {esAdmin && (
                          <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow">
                            <button onClick={(e) => editarProducto(prod, e)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => eliminarProducto(prod.id, e)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        <div>
                          <div className="h-52 sm:h-64 w-full bg-zinc-100 relative overflow-hidden">
                            {prod.imagen_url ? (
                              <img src={prod.imagen_url} alt={prod.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                                <ImageIcon className="w-10 h-10 mb-1" />
                                <span className="text-xs font-semibold">Sin imagen</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-4">
                            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">{prod.categoria}</span>
                            <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 line-clamp-2 mt-1 leading-snug">{prod.titulo}</h3>
                            {prod.descripcion && (
                              <p className="text-xs sm:text-sm text-zinc-500 line-clamp-2 mt-1">{prod.descripcion}</p>
                            )}
                            
                            <div className="mt-3 flex items-baseline gap-2">
                              {tieneOferta ? (
                                <>
                                  <span className="text-xl sm:text-2xl font-black text-rose-600">${prod.precio_oferta}</span>
                                  <span className="text-xs sm:text-sm text-zinc-400 line-through font-bold">${prod.precio}</span>
                                </>
                              ) : (
                                <span className="text-xl sm:text-2xl font-black text-zinc-900">${prod.precio}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 pt-0">
                          <button
                            onClick={(e) => agregarAlCarrito(prod, e)}
                            className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-amber-400/30 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-md"
                          >
                            <ShoppingCart className="w-4 h-4" /> Agregar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* SECCIÓN RUBROS EN LA PORTADA */
            <section>
              <div className="text-center mb-10">
                <span className="text-sm font-black uppercase tracking-widest text-amber-600">SECCIONES DESTACADAS</span>
                <h3 className="text-3xl sm:text-5xl font-black text-zinc-900 uppercase tracking-tight mt-1">NUESTROS RUBROS</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {categorias.map((cat) => (
                  <div
                    key={cat}
                    onClick={() => setCategoriaSeleccionada(cat)}
                    className="group relative h-80 sm:h-96 rounded-3xl overflow-hidden shadow-lg cursor-pointer flex items-end p-6 border border-zinc-200 transition-transform duration-300 hover:-translate-y-2"
                  >
                    <img
                      src={obtenerImagenCategoria(cat)}
                      alt={cat}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/30 to-transparent" />

                    <div className="relative z-10 w-full bg-zinc-950/90 backdrop-blur-md p-5 rounded-2xl text-center shadow-2xl border border-amber-500/20">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-widest">RUBRO</span>
                      <h4 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mt-0.5">{cat}</h4>
                      <span className="inline-block mt-3 px-5 py-2.5 bg-amber-500 text-zinc-950 text-xs sm:text-sm font-black rounded-xl uppercase tracking-wider transition-colors shadow-md">
                        EXPLORAR PRODUCTOS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Botón WhatsApp Flotante */}
      <a
        href={`https://wa.me/${configNegocio.whatsapp || "5493462368051"}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-20 right-6 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center border-2 border-white"
        title="Consultar por WhatsApp"
      >
        <MessageCircle className="w-8 h-8 fill-current" />
      </a>

      {/* MODAL LOGIN ADMIN */}
      {modalAdminAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-zinc-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-zinc-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" /> Acceso Panel Admin
              </h3>
              <button onClick={() => setModalAdminAbierto(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLoginAdmin} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-700 font-bold block mb-1">Email:</label>
                <input
                  type="email"
                  required
                  placeholder="admin@tiendaelasombro.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full p-3 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-700 font-bold block mb-1">Contraseña:</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full p-3 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {errorPassword && <p className="text-xs text-rose-600 font-bold">{errorPassword}</p>}

              <button
                type="submit"
                disabled={cargandoAuth}
                className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 text-amber-400 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 shadow-md"
              >
                {cargandoAuth ? 'Verificando...' : 'Ingresar al Panel'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER CARRITO DE COMPRAS */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-zinc-900">Tu Pedido ({totalItems})</h2>
              <div className="flex items-center gap-1">
                {carrito.length > 0 && (
                  <button
                    onClick={vaciarCarrito}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg uppercase tracking-wide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Vaciar
                  </button>
                )}
                <button onClick={() => setCarritoAbierto(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrito.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 text-xs font-medium">El carrito está vacío.</div>
              ) : (
                carrito.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center border-b border-zinc-100 pb-3">
                    <div className="w-12 h-12 bg-zinc-100 rounded-xl overflow-hidden flex-shrink-0">
                      {item.imagen_url ? (
                        <img src={item.imagen_url} alt={item.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-400">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-zinc-900 truncate">{item.titulo}</h4>
                      <p className="text-xs font-black text-amber-600">${item.precioEfectivo}</p>
                    </div>
                    <div className="flex items-center border border-zinc-200 rounded-lg">
                      <button onClick={() => modificarCantidad(item.id, -1)} className="p-1 text-zinc-600">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold">{item.cantidad}</span>
                      <button onClick={() => modificarCantidad(item.id, 1)} className="p-1 text-zinc-600">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <div className="p-4 border-t border-zinc-200 bg-zinc-50 space-y-3">
                <div className="flex justify-between items-center text-sm font-extrabold text-zinc-900">
                  <span>Total Estimado:</span>
                  <span className="text-lg font-black text-zinc-900">${totalCarrito}</span>
                </div>
                <button
                  onClick={enviarPedidoWhatsApp}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <MessageCircle className="w-4 h-4" /> Finalizar Pedido por WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE PRODUCTO */}
      {productoModal && (
        <ModalProducto
          producto={productoModal}
          onClose={() => setProductoModal(null)}
          configNegocio={configNegocio}
        />
      )}

      {/* FOOTER */}
      <footer className="bg-zinc-950 text-zinc-300 pt-12 pb-8 px-4 border-t border-amber-500/20 mt-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-left">
          
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <img src="/logo.jpg" alt="Tienda El Asombro" className="w-10 h-10 rounded-full border border-amber-400 object-cover" />
              <div>
                <h4 className="text-white font-bold text-lg leading-tight">{configNegocio.nombre}</h4>
                <span className="text-amber-400 text-xs font-medium tracking-wide">{configNegocio.subtitulo}</span>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
              Surtido de asombro. Blanquería, ropa, bazar y accesorios con el mejor precio y atención.
            </p>
            <div className="flex space-x-3">
              <a 
                href="https://www.instagram.com/tienda_el_asombro/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-zinc-900 border border-zinc-800 text-amber-400 hover:text-amber-300 hover:border-amber-400/50 px-3 py-1.5 rounded-lg text-xs transition"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>Instagram</span>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-lg mb-3 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <span>Locales y Contacto</span>
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                <strong className="text-amber-400">Sucursal Blanquería:</strong> Belgrano 535
              </p>
              <p className="text-zinc-300">
                <strong className="text-amber-400">Sucursal Indumentaria:</strong> Belgrano 81
              </p>
              <p className="text-zinc-400 text-xs">Venado Tuerto, Santa Fe (2600)</p>
              <p className="text-zinc-300 pt-1">
                📞 <strong>WhatsApp:</strong> 3462 368051
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-lg mb-3">Cómo llegar</h4>
            <a 
              href="https://maps.google.com/?q=Belgrano+81,+Venado+Tuerto" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-zinc-900 text-xs text-zinc-300 px-3 py-2 rounded-lg border border-zinc-800 hover:border-amber-400/50 hover:text-amber-300 transition mb-3"
            >
              <span>🗺️ Ver en Google Maps</span>
            </a>
            <div className="pt-2">
              <p className="text-xs text-zinc-500">
                Comercio Adherido a <a href={GUIA_CLIC_URL} target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold hover:underline">GuiaClic</a>
              </p>
            </div>
          </div>

        </div>

        <div className="border-t border-zinc-900 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Tienda El Asombro. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}