import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  ShoppingBag, Search, ShoppingCart, X, Plus, Minus, ExternalLink,
  MessageCircle, ArrowLeft, Lock, Edit3, Trash2, Tag, Check, Image as ImageIcon,
  KeyRound, LogOut, Upload, Loader2, Settings, Sparkles, MapPin,
  ChevronRight, ChevronLeft, ZoomIn, Share2
} from 'lucide-react';

const CLOUDINARY_CLOUD_NAME = "okej62yk";
const CLOUDINARY_UPLOAD_PRESET = "preset_elasombro";

// EMAIL AUTORIZADO PARA ESTA TIENDA
const EMAIL_AUTORIZADO = "tiendaelasombro@guiaclic.com.ar";

// Arma la galería de fotos de un producto combinando las fotos generales
// (imagenes[]) con la foto específica de cada variante (imagen_asociada_url),
// sin duplicar una misma URL dos veces. Cada foto queda etiquetada con la
// variante a la que pertenece (o null si es una foto general del producto),
// para poder sincronizar los selectores de medida/material/color al navegar.
function construirGaleria(prod) {
  if (!prod) return [];
  const fotosGenerales = (prod.imagenes && prod.imagenes.length > 0)
    ? prod.imagenes
    : (prod.imagen_url ? [prod.imagen_url] : []);
  const variantes = prod.variantes || [];

  const vistas = new Set();
  const galeria = [];

  fotosGenerales.forEach((url) => {
    if (url && !vistas.has(url)) {
      vistas.add(url);
      galeria.push({ url, variante: null });
    }
  });

  variantes.forEach((v) => {
    const url = v.imagen_asociada_url;
    if (url && !vistas.has(url)) {
      vistas.add(url);
      galeria.push({ url, variante: v });
    }
  });

  return galeria;
}

// El zoom que "sigue" al cursor solo tiene sentido con mouse real. En
// celular el mouse se emula al tocar, así que ahí usamos en cambio un
// zoom de "tocar para ampliar" + arrastrar para recorrer la foto.
function tieneMousePreciso() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export default function App() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloOfertas, setSoloOfertas] = useState(false);

  // Modal Detalle de Producto estilo Tiendanube (reemplaza a ModalProducto.jsx)
  const [productoDetalle, setProductoDetalle] = useState(null);
  const [imagenActivaIndex, setImagenActivaIndex] = useState(0);
  const [imagenVarianteDirecta, setImagenVarianteDirecta] = useState(null);
  const [lightboxAbierto, setLightboxAbierto] = useState(false);
  const [imagenHoverZoom, setImagenHoverZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [medidaSel, setMedidaSel] = useState('');
  const [materialSel, setMaterialSel] = useState('');
  const [colorSel, setColorSel] = useState('');
  const [cantidadSel, setCantidadSel] = useState(1);

  // Configuración Negocio con Logo Local (/logo.jpg) y WhatsApp Real
  const [configNegocio, setConfigNegocio] = useState({
    id: null,
    nombre: 'TIENDA EL ASOMBRO',
    subtitulo: 'BLANQUERÍA, NOVEDADES & BAZAR',
    logo_url: '/logo.jpg',
    whatsapp: '5493462368051'
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Carrito y Notificación Toast
  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [toastMensaje, setToastMensaje] = useState('');
  const [animarCarrito, setAnimarCarrito] = useState(false);

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
  const [subiendoImagenVarIdx, setSubiendoImagenVarIdx] = useState(null);
  const [formProd, setFormProd] = useState({
    titulo: '',
    categoria: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
    imagenes: []
  });

  // Estado para variantes en el form admin
  const [formVariantes, setFormVariantes] = useState([
    { medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }
  ]);

  const GUIA_CLIC_URL = "https://guiaclic.com.ar";

  useEffect(() => {
    fetchProductos();
    fetchConfigNegocio();
    verificarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email === EMAIL_AUTORIZADO) {
        setEsAdmin(true);
      } else {
        if (session) await supabase.auth.signOut();
        setEsAdmin(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Si la app se abrió desde un link compartido (?producto=ID&medida=..&
  // material=..&color=..), en cuanto llegan los productos abrimos
  // directamente ese detalle con esa variante ya seleccionada. Se aplica
  // una sola vez, para no reabrir el modal si el usuario ya lo cerró.
  const linkCompartidoAplicadoRef = useRef(false);

  useEffect(() => {
    if (linkCompartidoAplicadoRef.current) return;
    if (!productos || productos.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('producto');
    if (!prodId) {
      linkCompartidoAplicadoRef.current = true;
      return;
    }

    const prod = productos.find((p) => String(p.id) === String(prodId));
    linkCompartidoAplicadoRef.current = true;
    if (!prod) return;

    abrirDetalleProducto(prod);

    const medida = params.get('medida') || '';
    const material = params.get('material') || '';
    const color = params.get('color') || '';

    if (medida || material || color) {
      const variante = (prod.variantes || []).find((v) =>
        (medida === '' || v.medida === medida) &&
        (material === '' || v.material === material) &&
        (color === '' || v.color === color)
      );
      if (variante) {
        setMedidaSel(variante.medida || '');
        setMaterialSel(variante.material || '');
        setColorSel(variante.color || '');
        if (variante.imagen_asociada_url) {
          const galeria = construirGaleria(prod);
          const idx = galeria.findIndex((g) => g.url === variante.imagen_asociada_url);
          if (idx >= 0) setImagenActivaIndex(idx);
        }
      }
    }
  }, [productos]);

  // Navegación de la galería de fotos con las flechas del teclado (← →),
  // solo mientras el modal de detalle de producto está abierto.
  const touchStartXRef = useRef(null);

  // Referencias y estado para el gesto táctil dentro del lightbox (celular):
  // - Si la foto NO está ampliada: deslizar hacia los costados pasa a la
  //   foto siguiente/anterior (como MercadoLibre); un toque simple amplía.
  // - Si la foto SÍ está ampliada: arrastrar el dedo la recorre, moviéndola
  //   en el mismo sentido en que se arrastra; un toque simple (sin
  //   arrastre) la vuelve a tamaño normal.
  const lightboxImgRef = useRef(null);
  const arrastreZoomRef = useRef({ inicio: null, panInicial: { x: 0, y: 0 }, arrastro: false, esHorizontal: null });
  const [panZoom, setPanZoom] = useState({ x: 0, y: 0 });
  const panZoomRef = useRef(panZoom);
  useEffect(() => { panZoomRef.current = panZoom; }, [panZoom]);

  useEffect(() => {
    if (!lightboxAbierto) return;
    const el = lightboxImgRef.current;
    if (!el || tieneMousePreciso()) return; // en desktop el zoom ya sigue al mouse solo

    const handleTouchStart = (e) => {
      const t = e.touches[0];
      arrastreZoomRef.current = {
        inicio: { x: t.clientX, y: t.clientY },
        panInicial: { ...panZoomRef.current },
        arrastro: false,
        esHorizontal: null,
      };
    };

    const handleTouchMove = (e) => {
      const estado = arrastreZoomRef.current;
      if (!estado.inicio) return;
      const t = e.touches[0];
      const dx = t.clientX - estado.inicio.x;
      const dy = t.clientY - estado.inicio.y;

      if (estado.esHorizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        estado.esHorizontal = Math.abs(dx) > Math.abs(dy);
      }

      if (imagenHoverZoom) {
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) estado.arrastro = true;
        if (estado.arrastro) {
          e.preventDefault();
          const rect = el.getBoundingClientRect();
          const limiteX = rect.width * 0.65;
          const limiteY = rect.height * 0.65;
          const nuevoX = Math.min(limiteX, Math.max(-limiteX, estado.panInicial.x + dx));
          const nuevoY = Math.min(limiteY, Math.max(-limiteY, estado.panInicial.y + dy));
          setPanZoom({ x: nuevoX, y: nuevoY });
        }
      } else if (estado.esHorizontal) {
        if (Math.abs(dx) > 4) estado.arrastro = true;
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [lightboxAbierto, imagenHoverZoom]);

  useEffect(() => {
    if (!productoDetalle) return;

    const galeria = construirGaleria(productoDetalle);
    if (galeria.length <= 1) return;

    const irAIndice = (calcularNuevoIndice) => {
      setImagenVarianteDirecta(null);
      setImagenActivaIndex((prev) => {
        const nuevoIndex = calcularNuevoIndice(prev, galeria.length);
        const item = galeria[nuevoIndex];
        if (item?.variante) {
          setMedidaSel(item.variante.medida || '');
          setMaterialSel(item.variante.material || '');
          setColorSel(item.variante.color || '');
        }
        return nuevoIndex;
      });
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        irAIndice((prev, total) => (prev + 1) % total);
      } else if (e.key === 'ArrowLeft') {
        irAIndice((prev, total) => (prev - 1 + total) % total);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productoDetalle]);

  const mostrarToast = (mensaje) => {
    setToastMensaje(mensaje);
    setAnimarCarrito(true);
    setTimeout(() => setAnimarCarrito(false), 600);
    setTimeout(() => setToastMensaje(''), 3000);
  };

  // Toast simple, sin la animación del ícono del carrito (para avisos que
  // no son de "se agregó al carrito", como copiar un link).
  const mostrarToastSimple = (mensaje) => {
    setToastMensaje(mensaje);
    setTimeout(() => setToastMensaje(''), 3000);
  };

  // Arma un link directo al producto (y, si hay una variante elegida, a esa
  // variante puntual) y lo comparte con el share nativo del celular; si no
  // está disponible (por ejemplo en PC), copia el link al portapapeles.
  const compartirProducto = async () => {
    if (!productoDetalle) return;

    const params = new URLSearchParams();
    params.set('producto', productoDetalle.id);
    if (medidaSel) params.set('medida', medidaSel);
    if (materialSel) params.set('material', materialSel);
    if (colorSel) params.set('color', colorSel);

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const detalleVariante = [medidaSel, materialSel, colorSel].filter(Boolean).join(' / ');
    const titulo = `${productoDetalle.titulo}${detalleVariante ? ' - ' + detalleVariante : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
      } catch (error) {
        // El usuario canceló el cuadro de compartir nativo: no hacemos nada.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      mostrarToastSimple('¡Link copiado!');
    } catch (error) {
      mostrarToastSimple('No se pudo copiar el link');
    }
  };

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === EMAIL_AUTORIZADO) {
      setEsAdmin(true);
    } else {
      if (session) await supabase.auth.signOut();
      setEsAdmin(false);
    }
  }

  async function fetchProductos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tienda_el_asombro')
        .select(`
          *,
          variantes:tienda_el_asombro_variantes(*)
        `)
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

  const handleSubirImagen = async (e, esLogo = false, esVarianteIndex = null) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    try {
      if (esLogo) setSubiendoLogo(true);
      else if (esVarianteIndex !== null) setSubiendoImagenVarIdx(esVarianteIndex);
      else setSubiendoImagen(true);

      const urlsSubidas = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.secure_url) {
          urlsSubidas.push(data.secure_url);
        } else {
          throw new Error(data.error?.message || 'Error al subir la imagen');
        }
      }

      if (esLogo) {
        setConfigNegocio((prev) => ({ ...prev, logo_url: urlsSubidas[0] }));
      } else if (esVarianteIndex !== null) {
        setFormVariantes((prev) => {
          const copia = [...prev];
          copia[esVarianteIndex].imagen_asociada_url = urlsSubidas[0];
          return copia;
        });
      } else {
        setFormProd((prev) => ({
          ...prev,
          imagenes: [...prev.imagenes, ...urlsSubidas]
        }));
      }
    } catch (error) {
      alert('Error al subir la imagen: ' + error.message);
    } finally {
      if (esLogo) setSubiendoLogo(false);
      else if (esVarianteIndex !== null) setSubiendoImagenVarIdx(null);
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

      if (data.user?.email !== EMAIL_AUTORIZADO) {
        await supabase.auth.signOut();
        setErrorPassword('Usuario incorrecto.');
        return;
      }

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

  // Abrir Modal de Detalle de Producto
  const abrirDetalleProducto = (prod) => {
    setProductoDetalle(prod);
    setCantidadSel(1);
    setLightboxAbierto(false);
    setImagenHoverZoom(false);

    const vars = prod.variantes || [];
    const galeria = construirGaleria(prod);

    if (vars.length > 0) {
      setMedidaSel(vars[0].medida || '');
      setMaterialSel(vars[0].material || '');
      setColorSel(vars[0].color || '');
      const idxInicial = vars[0].imagen_asociada_url
        ? galeria.findIndex((g) => g.url === vars[0].imagen_asociada_url)
        : -1;
      setImagenActivaIndex(idxInicial >= 0 ? idxInicial : 0);
    } else {
      setMedidaSel('');
      setMaterialSel('');
      setColorSel('');
      setImagenActivaIndex(0);
    }
  };

  // Calcular variante seleccionada actualmente en el modal.
  // IMPORTANTE: si la combinación elegida no existe como variante real, devolvemos null
  // en vez de "adivinar" con la primera variante, para no mezclar variantes distintas
  // bajo un mismo ítem del carrito.
  const obtenerVarianteSeleccionada = () => {
    if (!productoDetalle || !productoDetalle.variantes || productoDetalle.variantes.length === 0) return null;
    return productoDetalle.variantes.find((v) =>
      (medidaSel === '' || v.medida === medidaSel) &&
      (materialSel === '' || v.material === materialSel) &&
      (colorSel === '' || v.color === colorSel)
    ) || null;
  };

  const varianteActual = obtenerVarianteSeleccionada();

  // Los 3 selectores (medida/material/color) NO son independientes: solo existen las
  // combinaciones que realmente están cargadas como filas en tienda_el_asombro_variantes.
  // Por eso, al tocar un selector, si la combinación resultante con los otros dos valores
  // ya elegidos no corresponde a ninguna variante real, reacomodamos esos otros dos para
  // que siempre queden apuntando a una variante que sí existe.
  const handleCambioVariante = (tipo, valor) => {
    const variantes = productoDetalle?.variantes || [];

    let m = medidaSel;
    let mat = materialSel;
    let c = colorSel;

    if (tipo === 'medida') m = valor;
    if (tipo === 'material') mat = valor;
    if (tipo === 'color') c = valor;

    const candidatas = variantes.filter((v) => {
      if (tipo === 'medida') return v.medida === valor;
      if (tipo === 'material') return v.material === valor;
      return v.color === valor;
    });

    const combinacionValida = candidatas.some((v) =>
      (m === '' || v.medida === m) &&
      (mat === '' || v.material === mat) &&
      (c === '' || v.color === c)
    );

    if (!combinacionValida && candidatas[0]) {
      m = candidatas[0].medida || '';
      mat = candidatas[0].material || '';
      c = candidatas[0].color || '';
    }

    setMedidaSel(m);
    setMaterialSel(mat);
    setColorSel(c);

    const encontrada = variantes.find((v) =>
      (m === '' || v.medida === m) &&
      (mat === '' || v.material === mat) &&
      (c === '' || v.color === c)
    ) || candidatas[0] || null;

    setImagenVarianteDirecta(encontrada?.imagen_asociada_url || null);
  };

  const tieneVariantes = (productoDetalle?.variantes || []).length > 0;

  const obtenerPrecioActual = () => {
    if (varianteActual) {
      const pOferta = varianteActual.precio_oferta ? Number(varianteActual.precio_oferta) : null;
      const pNormal = varianteActual.precio ? Number(varianteActual.precio) : Number(productoDetalle?.precio || 0);
      return {
        precio: pOferta || pNormal,
        precioOriginal: pOferta ? pNormal : null,
        stock: varianteActual.stock ?? 0
      };
    }
    if (tieneVariantes) {
      const pOferta = productoDetalle?.precio_oferta ? Number(productoDetalle.precio_oferta) : null;
      const pNormal = Number(productoDetalle?.precio || 0);
      return {
        precio: pOferta || pNormal,
        precioOriginal: pOferta ? pNormal : null,
        stock: 0
      };
    }
    const pOferta = productoDetalle?.precio_oferta ? Number(productoDetalle.precio_oferta) : null;
    const pNormal = Number(productoDetalle?.precio || 0);
    return {
      precio: pOferta || pNormal,
      precioOriginal: pOferta ? pNormal : null,
      stock: 999
    };
  };

  const agregarAlCarritoDesdeDetalle = () => {
    if (!productoDetalle) return;

    if (tieneVariantes && !varianteActual) {
      alert('Esa combinación no está disponible. Elegí otra opción.');
      return;
    }

    const infoPrecio = obtenerPrecioActual();

    const imgFinal = imagenVarianteDirecta ||
      (productoDetalle.imagenes && productoDetalle.imagenes[0]) ||
      productoDetalle.imagen_url || '';

    const varianteKey = varianteActual ? varianteActual.id : 'base';

    const itemCarrito = {
      id: `${productoDetalle.id}_${varianteKey}`,
      producto_id: productoDetalle.id,
      variante_id: varianteActual?.id || null,
      titulo: productoDetalle.titulo,
      medida: medidaSel,
      material: materialSel,
      color: colorSel,
      precioEfectivo: infoPrecio.precio,
      cantidad: cantidadSel,
      imagen: imgFinal
    };

    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === itemCarrito.id);
      if (existe) {
        return prev.map((item) =>
          item.id === itemCarrito.id ? { ...item, cantidad: item.cantidad + cantidadSel } : item
        );
      }
      return [...prev, itemCarrito];
    });

    setProductoDetalle(null);
    mostrarToast(`¡"${productoDetalle.titulo}" agregado al carrito!`);
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
      let detalles = [];
      if (item.medida) detalles.push(`Medida: ${item.medida}`);
      if (item.material) detalles.push(`Material: ${item.material}`);
      if (item.color) detalles.push(`Color: ${item.color}`);

      const strDetalles = detalles.length > 0 ? ` (${detalles.join(', ')})` : '';
      mensaje += `• *${item.titulo}*${strDetalles} x${item.cantidad} - $${item.precioEfectivo * item.cantidad}\n`;
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

  // ADMIN: Guardar Producto y sus Variantes
  const guardarProducto = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        titulo: formProd.titulo,
        categoria: normalizarCategoria(formProd.categoria),
        descripcion: formProd.descripcion,
        precio: Number(formProd.precio) || 0,
        precio_oferta: formProd.precio_oferta ? Number(formProd.precio_oferta) : null,
        imagenes: formProd.imagenes,
        imagen_url: formProd.imagenes[0] || ''
      };

      let prodId = productoEditar?.id;

      if (productoEditar) {
        const { error } = await supabase
          .from('tienda_el_asombro')
          .update(payload)
          .eq('id', prodId);
        if (error) throw error;

        // Borrar variantes viejas para reinsertar las actualizadas
        await supabase.from('tienda_el_asombro_variantes').delete().eq('producto_id', prodId);
      } else {
        const { data, error } = await supabase
          .from('tienda_el_asombro')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        prodId = data.id;
      }

      // Insertar Variantes con su foto correspondiente
      if (formVariantes.length > 0 && prodId) {
        const variantesPayload = formVariantes
          .filter((v) => v.medida || v.material || v.color)
          .map((v) => ({
            producto_id: prodId,
            medida: v.medida,
            material: v.material,
            color: v.color,
            stock: Number(v.stock) || 0,
            precio: v.precio ? Number(v.precio) : null,
            precio_oferta: v.precio_oferta ? Number(v.precio_oferta) : null,
            imagen_asociada_url: v.imagen_asociada_url || null
          }));

        if (variantesPayload.length > 0) {
          const { error: errVar } = await supabase
            .from('tienda_el_asombro_variantes')
            .insert(variantesPayload);
          if (errVar) throw errVar;
        }
      }

      setFormProd({ titulo: '', categoria: '', descripcion: '', precio: '', precio_oferta: '', imagenes: [] });
      setFormVariantes([{ medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }]);
      setProductoEditar(null);
      fetchProductos();
      alert('¡Producto y variantes guardados correctamente!');
    } catch (err) {
      alert('Error al guardar el producto: ' + err.message);
    }
  };

  const editarProducto = (prod, e) => {
    if (e) e.stopPropagation();
    setProductoEditar(prod);
    const imgs = prod.imagenes && prod.imagenes.length > 0 ? prod.imagenes : (prod.imagen_url ? [prod.imagen_url] : []);
    setFormProd({
      titulo: prod.titulo || '',
      categoria: prod.categoria || '',
      descripcion: prod.descripcion || '',
      precio: prod.precio || '',
      precio_oferta: prod.precio_oferta || '',
      imagenes: imgs
    });

    if (prod.variantes && prod.variantes.length > 0) {
      setFormVariantes(prod.variantes.map((v) => ({
        medida: v.medida || '',
        material: v.material || '',
        color: v.color || '',
        stock: v.stock ?? 10,
        precio: v.precio || '',
        precio_oferta: v.precio_oferta || '',
        imagen_asociada_url: v.imagen_asociada_url || ''
      })));
    } else {
      setFormVariantes([{ medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }]);
    }

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
      (p) => (p.categoria || '').trim().toLowerCase() === cat.trim().toLowerCase() &&
      ((p.imagenes && p.imagenes[0]) || p.imagen_url)
    );
    return (prod?.imagenes && prod?.imagenes[0]) || prod?.imagen_url || 'https://res.cloudinary.com/okej62yk/image/upload/v1787762681/frazadas.jpg';
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

  // Valores de medida/material/color ya cargados en CUALQUIER producto del catálogo,
  // usados como sugerencias (datalist) al cargar variantes en el panel admin.
  const medidasExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.medida || '').trim())).filter(Boolean)
  )].sort();
  const materialesExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.material || '').trim())).filter(Boolean)
  )].sort();
  const coloresExistentes = [...new Set(
    productos.flatMap((p) => (p.variantes || []).map((v) => (v.color || '').trim())).filter(Boolean)
  )].sort();

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
                className={`relative p-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-full transition-all duration-300 flex items-center gap-2 px-5 shadow-lg ${
                  animarCarrito ? 'scale-110 bg-amber-300 ring-4 ring-amber-200' : ''
                }`}
              >
                <ShoppingCart className="w-6 h-6" />
                <span className="text-sm font-black hidden sm:inline uppercase tracking-wider">Carrito</span>
                {totalItems > 0 && (
                  <span className={`bg-zinc-950 text-amber-400 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow transition-transform duration-300 ${
                    animarCarrito ? 'scale-150' : 'scale-100'
                  }`}>
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
              src={(productos[0]?.imagenes && productos[0]?.imagenes[0]) || productos[0]?.imagen_url || "https://res.cloudinary.com/okej62yk/image/upload/v1787769438/logo.jpg"}
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
                    placeholder="BLANQUERÍA, NOVEDADES & BAZAR"
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

            {/* CARGA DE PRODUCTOS Y VARIANTES */}
            <form onSubmit={guardarProducto} className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 space-y-6 shadow-sm text-zinc-200">
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
                  <label className="text-xs font-bold block mb-1">Precio Base ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="12000"
                    value={formProd.precio}
                    onChange={(e) => setFormProd({ ...formProd, precio: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-400 block mb-1">Precio Oferta Base ($ - Opcional)</label>
                  <input
                    type="number"
                    placeholder="Dejar vacío si no hay oferta"
                    value={formProd.precio_oferta}
                    onChange={(e) => setFormProd({ ...formProd, precio_oferta: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-rose-900/60 rounded-lg text-sm text-white focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold block mb-1">Imágenes Generales del Producto (Múltiples fotos)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 shadow transition-colors">
                      {subiendoImagen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {subiendoImagen ? 'Subiendo fotos...' : '📷 Agregar Fotos General'}
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleSubirImagen(e, false)}
                        disabled={subiendoImagen}
                        className="hidden"
                      />
                    </label>

                    {formProd.imagenes.map((url, idx) => (
                      <div key={idx} className="relative group w-10 h-10 border border-zinc-700 rounded-lg overflow-hidden">
                        <img src={url} alt="Cargada" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormProd(prev => ({ ...prev, imagenes: prev.imagenes.filter((_, i) => i !== idx) }))}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold block mb-1">Descripción Detallada</label>
                  <textarea
                    rows={2}
                    placeholder="Escribí características del producto, calidad, materiales, etc."
                    value={formProd.descripcion}
                    onChange={(e) => setFormProd({ ...formProd, descripcion: e.target.value })}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* GESTIÓN DE VARIANTES CON FOTO ESPECÍFICA */}
              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                    Variantes de Producto (Medida / Material / Color / Stock / Precio / Foto)
                  </h5>
                  <button
                    type="button"
                    onClick={() => setFormVariantes(prev => [...prev, { medida: '', material: '', color: '', stock: 10, precio: '', precio_oferta: '', imagen_asociada_url: '' }])}
                    className="text-xs font-bold bg-amber-500 text-zinc-950 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-400"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Variante
                  </button>
                </div>

                {/* Sugerencias de valores ya usados: el input sigue siendo libre, pero el
                    navegador ofrece autocompletar con lo ya cargado en el catálogo. */}
                <datalist id="datalist-medidas-asombro">
                  {medidasExistentes.map((m) => <option key={m} value={m} />)}
                </datalist>
                <datalist id="datalist-materiales-asombro">
                  {materialesExistentes.map((m) => <option key={m} value={m} />)}
                </datalist>
                <datalist id="datalist-colores-asombro">
                  {coloresExistentes.map((c) => <option key={c} value={c} />)}
                </datalist>

                {formVariantes.map((v, idx) => (
                  <div key={idx} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-3 items-center">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Medida/Talle</label>
                      <input
                        type="text"
                        list="datalist-medidas-asombro"
                        placeholder="2 1/2"
                        value={v.medida}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, medida: val } : item));
                        }}
                        className="w-full p-2 border border-zinc-700 rounded-lg text-xs font-medium bg-zinc-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Material</label>
                      <input
                        type="text"
                        list="datalist-materiales-asombro"
                        placeholder="Algodón"
                        value={v.material}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, material: val } : item));
                        }}
                        className="w-full p-2 border border-zinc-700 rounded-lg text-xs font-medium bg-zinc-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Color</label>
                      <input
                        type="text"
                        list="datalist-colores-asombro"
                        placeholder="Blanco"
                        value={v.color}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, color: val } : item));
                        }}
                        className="w-full p-2 border border-zinc-700 rounded-lg text-xs font-medium bg-zinc-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Stock</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={v.stock}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, stock: val } : item));
                        }}
                        className="w-full p-2 border border-zinc-700 rounded-lg text-xs font-medium bg-zinc-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Precio Variante</label>
                      <input
                        type="number"
                        placeholder="Si difiere"
                        value={v.precio}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, precio: val } : item));
                        }}
                        className="w-full p-2 border border-zinc-700 rounded-lg text-xs font-medium bg-zinc-950 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1">Foto Variante</label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-[11px] font-bold py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 w-full shadow-sm transition-colors border border-zinc-700">
                          {subiendoImagenVarIdx === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>{v.imagen_asociada_url ? 'Cambiar' : 'Subir'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSubirImagen(e, false, idx)}
                            disabled={subiendoImagenVarIdx === idx}
                            className="hidden"
                          />
                        </label>

                        {v.imagen_asociada_url && (
                          <div className="relative group w-8 h-8 border border-zinc-700 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={v.imagen_asociada_url} alt="Variante" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFormVariantes(prev => prev.map((item, i) => i === idx ? { ...item, imagen_asociada_url: '' } : item))}
                              className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 md:pt-4">
                      {formVariantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormVariantes(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-red-400 hover:bg-red-950 rounded-lg transition-colors"
                          title="Eliminar Variante"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={subiendoImagen || subiendoImagenVarIdx !== null}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> {productoEditar ? 'Guardar Cambios del Producto' : 'Publicar Producto'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* LISTADO DE PRODUCTOS */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {categoriaSeleccionada || busqueda || soloOfertas ? (
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-zinc-300">
                <button
                  onClick={() => { setCategoriaSeleccionada(null); setBusqueda(''); setSoloOfertas(false); }}
                  className="flex items-center gap-1.5 text-xs font-extrabold text-amber-600 hover:underline uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver a la portada
                </button>
                <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                  {soloOfertas ? '🔥 Ofertas Destacadas' : categoriaSeleccionada || `Búsqueda: "${busqueda}"`}
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
                    const fotoPrincipal = (prod.imagenes && prod.imagenes[0]) || prod.imagen_url;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => abrirDetalleProducto(prod)}
                        className="bg-white rounded-3xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between relative group cursor-pointer"
                      >
                        {tieneOferta && (
                          <div className="absolute top-3 left-3 z-10 bg-rose-600 text-white text-xs font-black uppercase px-3 py-1 rounded-full shadow-md">
                            OFERTA
                          </div>
                        )}

                        {esAdmin && (
                          <div
                            className="absolute top-2 right-2 z-20 flex gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                            {fotoPrincipal ? (
                              <img src={fotoPrincipal} alt={prod.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                            className="w-full py-3 bg-zinc-950 group-hover:bg-amber-500 group-hover:text-zinc-950 text-amber-400 border border-amber-400/30 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-md"
                          >
                            Ver Producto
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

      {/* MODAL DETALLE DE PRODUCTO ESTILO TIENDANUBE (con galería, variantes, zoom y compartir) */}
      {productoDetalle && (() => {
        const infoPrecio = obtenerPrecioActual();
        const galeriaCompleta = construirGaleria(productoDetalle);
        const listaImagenes = galeriaCompleta.map((g) => g.url);

        const imagenAMostrar = imagenVarianteDirecta || listaImagenes[imagenActivaIndex] || listaImagenes[0];

        const irImagenSiguiente = () => {
          if (listaImagenes.length <= 1) return;
          setImagenVarianteDirecta(null);
          setImagenHoverZoom(false);
          setPanZoom({ x: 0, y: 0 });
          setImagenActivaIndex((prev) => {
            const nuevoIndex = (prev + 1) % listaImagenes.length;
            const item = galeriaCompleta[nuevoIndex];
            if (item?.variante) {
              setMedidaSel(item.variante.medida || '');
              setMaterialSel(item.variante.material || '');
              setColorSel(item.variante.color || '');
            }
            return nuevoIndex;
          });
        };
        const irImagenAnterior = () => {
          if (listaImagenes.length <= 1) return;
          setImagenVarianteDirecta(null);
          setImagenHoverZoom(false);
          setPanZoom({ x: 0, y: 0 });
          setImagenActivaIndex((prev) => {
            const nuevoIndex = (prev - 1 + listaImagenes.length) % listaImagenes.length;
            const item = galeriaCompleta[nuevoIndex];
            if (item?.variante) {
              setMedidaSel(item.variante.medida || '');
              setMaterialSel(item.variante.material || '');
              setColorSel(item.variante.color || '');
            }
            return nuevoIndex;
          });
        };

        const seleccionarFoto = (idx) => {
          const item = galeriaCompleta[idx];
          setImagenActivaIndex(idx);
          setImagenVarianteDirecta(null);
          if (item?.variante) {
            setMedidaSel(item.variante.medida || '');
            setMaterialSel(item.variante.material || '');
            setColorSel(item.variante.color || '');
          }
        };

        // Zoom estilo MercadoLibre/Tiendanube: seguir el mouse para definir el
        // punto de la imagen que queda centrado al ampliarla.
        const manejarMouseMoveZoom = (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setZoomPos({ x, y });
        };

        const manejarFinDeToqueLightbox = (e) => {
          if (tieneMousePreciso()) return;
          const estado = arrastreZoomRef.current;
          const fueArrastre = estado.arrastro;
          const fueHorizontal = estado.esHorizontal;
          const inicio = estado.inicio;
          arrastreZoomRef.current = { inicio: null, panInicial: { x: 0, y: 0 }, arrastro: false, esHorizontal: null };

          if (imagenHoverZoom) {
            if (!fueArrastre) {
              e.preventDefault();
              e.stopPropagation();
              setImagenHoverZoom(false);
              setPanZoom({ x: 0, y: 0 });
            }
            return;
          }

          if (fueHorizontal && inicio) {
            const touch = e.changedTouches[0];
            const dx = touch.clientX - inicio.x;
            if (Math.abs(dx) > 40) {
              e.preventDefault();
              e.stopPropagation();
              if (dx < 0) irImagenSiguiente();
              else irImagenAnterior();
              return;
            }
          }

          if (!fueArrastre) {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.changedTouches[0];
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((touch.clientX - rect.left) / rect.width) * 100;
            const y = ((touch.clientY - rect.top) / rect.height) * 100;
            setZoomPos({ x, y });
            setPanZoom({ x: 0, y: 0 });
            setImagenHoverZoom(true);
          }
        };

        const cerrarDetalle = () => {
          setProductoDetalle(null);
          setLightboxAbierto(false);
          setImagenHoverZoom(false);
          setPanZoom({ x: 0, y: 0 });
        };

        const variantes = productoDetalle.variantes || [];
        const medidasDisponibles = [...new Set(variantes.map(v => v.medida).filter(Boolean))];
        const materialesDisponibles = [...new Set(variantes.map(v => v.material).filter(Boolean))];
        const coloresDisponibles = [...new Set(variantes.map(v => v.color).filter(Boolean))];

        return (
          <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-zinc-100 my-auto relative flex flex-col md:flex-row">
              <button
                onClick={cerrarDetalle}
                className="absolute top-4 right-4 z-20 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* GALERÍA DE FOTOS */}
              <div className="w-full md:w-1/2 p-6 bg-zinc-50 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-zinc-200">
                <div
                  className="w-full h-80 sm:h-[28rem] rounded-2xl overflow-hidden bg-white shadow-inner relative flex items-center justify-center group touch-pan-y cursor-zoom-in"
                  onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null) return;
                    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (Math.abs(deltaX) < 25) return;
                    e.preventDefault();
                    if (deltaX < 0) irImagenSiguiente();
                    else irImagenAnterior();
                  }}
                  onMouseEnter={() => { if (tieneMousePreciso()) setImagenHoverZoom(true); }}
                  onMouseLeave={() => setImagenHoverZoom(false)}
                  onMouseMove={(e) => { if (tieneMousePreciso()) manejarMouseMoveZoom(e); }}
                  onClick={() => imagenAMostrar && setLightboxAbierto(true)}
                >
                  {imagenAMostrar ? (
                    <img
                      src={imagenAMostrar}
                      alt={productoDetalle.titulo}
                      className="w-full h-full object-contain select-none transition-transform duration-150 ease-out"
                      style={imagenHoverZoom ? { transform: 'scale(2)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                      draggable={false}
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-zinc-300" />
                  )}

                  {imagenAMostrar && (
                    <div className="absolute bottom-3 right-3 z-10 bg-white/90 text-zinc-700 p-2 rounded-full shadow pointer-events-none">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  )}

                  {listaImagenes.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); irImagenAnterior(); }}
                        aria-label="Foto anterior"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-zinc-700 rounded-full p-2 shadow-md transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); irImagenSiguiente(); }}
                        aria-label="Foto siguiente"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-zinc-700 rounded-full p-2 shadow-md transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* MINIATURAS: fotos generales + foto de cada variante */}
                {listaImagenes.length > 1 && (
                  <div className="flex items-center gap-3 mt-4 overflow-x-auto max-w-full pb-2">
                    {galeriaCompleta.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => seleccionarFoto(idx)}
                        title={item.variante ? [item.variante.medida, item.variante.material, item.variante.color].filter(Boolean).join(' / ') : undefined}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${(!imagenVarianteDirecta && imagenActivaIndex === idx) ? 'border-amber-500 scale-105 shadow' : 'border-zinc-200 opacity-60'}`}
                      >
                        <img src={item.url} alt="Miniatura" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DETALLES Y OPCIONES DE VARIANTE */}
              <div className="w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-amber-600 uppercase tracking-widest">{productoDetalle.categoria}</span>
                      <h2 className="text-2xl font-black text-zinc-900 leading-tight mt-1">{productoDetalle.titulo}</h2>
                    </div>
                    <button
                      onClick={compartirProducto}
                      aria-label="Compartir"
                      title="Compartir"
                      className="flex-shrink-0 flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-2 rounded-xl transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="text-[11px] font-black uppercase tracking-wide hidden sm:inline">Compartir</span>
                    </button>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-zinc-900">${infoPrecio.precio}</span>
                    {infoPrecio.precioOriginal && (
                      <span className="text-sm font-bold text-zinc-400 line-through">${infoPrecio.precioOriginal}</span>
                    )}
                  </div>

                  {productoDetalle.descripcion && (
                    <p className="text-xs text-zinc-600 leading-relaxed font-medium bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      {productoDetalle.descripcion}
                    </p>
                  )}

                  {/* SELECTORES DE VARIANTES */}
                  <div className="space-y-3 pt-2">
                    {medidasDisponibles.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1">Medida / Talle:</label>
                        <select
                          value={medidaSel}
                          onChange={(e) => handleCambioVariante('medida', e.target.value)}
                          className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-400"
                        >
                          {medidasDisponibles.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {materialesDisponibles.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1">Material:</label>
                        <select
                          value={materialSel}
                          onChange={(e) => handleCambioVariante('material', e.target.value)}
                          className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-400"
                        >
                          {materialesDisponibles.map((mat) => (
                            <option key={mat} value={mat}>{mat}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {coloresDisponibles.length > 0 && (
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1">Color:</label>
                        <select
                          value={colorSel}
                          onChange={(e) => handleCambioVariante('color', e.target.value)}
                          className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-800 focus:ring-2 focus:ring-amber-400"
                        >
                          {coloresDisponibles.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* INDICADOR DE STOCK Y CANTIDAD */}
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-100">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider block text-zinc-500">Stock disponible:</span>
                      <span className={`text-xs font-black ${infoPrecio.stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {infoPrecio.stock > 0 ? `${infoPrecio.stock} unidades` : 'Sin stock'}
                      </span>
                    </div>

                    <div className="flex items-center border border-zinc-300 rounded-xl bg-zinc-50">
                      <button
                        onClick={() => setCantidadSel(prev => Math.max(1, prev - 1))}
                        className="p-2 text-zinc-600 hover:text-zinc-900"
                        disabled={cantidadSel <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-black">{cantidadSel}</span>
                      <button
                        onClick={() => setCantidadSel(prev => Math.min(infoPrecio.stock, prev + 1))}
                        className="p-2 text-zinc-600 hover:text-zinc-900"
                        disabled={cantidadSel >= infoPrecio.stock}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {tieneVariantes && !varianteActual && (
                  <p className="text-[11px] font-bold text-rose-600 text-center -mt-2">
                    Esa combinación no está disponible. Probá con otra opción.
                  </p>
                )}

                {/* BOTÓN AGREGAR AL CARRITO */}
                <button
                  onClick={agregarAlCarritoDesdeDetalle}
                  disabled={infoPrecio.stock <= 0}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {tieneVariantes && !varianteActual
                    ? 'Elegí una combinación'
                    : infoPrecio.stock > 0 ? 'Agregar al Carrito' : 'Sin Stock'}
                </button>
              </div>
            </div>
          </div>

          {/* LIGHTBOX: foto ampliada a pantalla completa, con zoom y navegación */}
          {lightboxAbierto && imagenAMostrar && (
            <div
              className="fixed inset-0 z-[60] bg-zinc-950/95 flex items-center justify-center p-4"
              onClick={() => { setLightboxAbierto(false); setImagenHoverZoom(false); setPanZoom({ x: 0, y: 0 }); }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxAbierto(false); setImagenHoverZoom(false); setPanZoom({ x: 0, y: 0 }); }}
                aria-label="Cerrar"
                className="absolute top-4 right-4 z-20 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              {listaImagenes.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); irImagenAnterior(); }}
                    aria-label="Foto anterior"
                    className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); irImagenSiguiente(); }}
                    aria-label="Foto siguiente"
                    className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              <div
                ref={lightboxImgRef}
                className="relative w-full h-full max-w-5xl max-h-[85vh] overflow-hidden flex items-center justify-center cursor-zoom-in"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => { if (tieneMousePreciso()) setImagenHoverZoom(true); }}
                onMouseLeave={() => setImagenHoverZoom(false)}
                onMouseMove={(e) => { if (tieneMousePreciso()) manejarMouseMoveZoom(e); }}
                onTouchEnd={manejarFinDeToqueLightbox}
              >
                <img
                  src={imagenAMostrar}
                  alt={productoDetalle.titulo}
                  className="max-w-full max-h-full object-contain select-none transition-transform duration-150 ease-out"
                  style={imagenHoverZoom ? { transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(2.2)`, transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                  draggable={false}
                />
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                <span className="sm:hidden text-white/70 text-[11px] font-bold">
                  {imagenHoverZoom
                    ? 'Arrastrá para recorrer · Tocá para volver'
                    : (listaImagenes.length > 1 ? 'Deslizá para ver más fotos · Tocá para ampliar' : 'Tocá la foto para ampliar')}
                </span>
                {listaImagenes.length > 1 && (
                  <span className="text-white/80 text-xs font-bold">
                    {imagenActivaIndex + 1} / {listaImagenes.length}
                  </span>
                )}
              </div>
            </div>
          )}
          </>
        );
      })()}

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
                  placeholder="tiendaelasombro@guiaclic.com.ar"
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
                      {item.imagen ? (
                        <img src={item.imagen} alt={item.titulo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-400">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-zinc-900 truncate">{item.titulo}</h4>
                      {(item.medida || item.material || item.color) && (
                        <p className="text-[10px] text-zinc-500 font-medium truncate">
                          {[item.medida, item.material, item.color].filter(Boolean).join(' / ')}
                        </p>
                      )}
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

      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      {toastMensaje && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-950/95 text-amber-300 text-xs font-bold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-amber-500/30 flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMensaje}</span>
        </div>
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
