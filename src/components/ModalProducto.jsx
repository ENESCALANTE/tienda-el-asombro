import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import { X, Play, MessageCircle } from 'lucide-react';

// Estilos de Swiper
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function ModalProducto({ producto, onClose, configNegocio }) {
  if (!producto) return null;

  // Estado para las variantes seleccionadas por el cliente
  const [variantesSeleccionadas, setVariantesSeleccionadas] = useState({});

  // Manejar cambio de opción en variantes
  const handleSelectVariante = (grupo, opcion) => {
    setVariantesSeleccionadas((prev) => ({
      ...prev,
      [grupo]: opcion,
    }));
  };

  // Armar el mensaje para WhatsApp con las variantes elegidas
  const enviarWhatsApp = () => {
    let mensaje = `¡Hola! Me interesa el producto: *${producto.titulo}*\n`;
    mensaje += `Precio: $${producto.precio.toLocaleString('es-AR')}\n`;

    const variantesTexto = Object.entries(variantesSeleccionadas)
      .map(([grupo, opcion]) => `- ${grupo}: ${opcion}`)
      .join('\n');

    if (variantesTexto) {
      mensaje += `\n*Detalles seleccionados:*\n${variantesTexto}\n`;
    }

    mensaje += `\n¿Tienen stock disponible?`;

    const numero = configNegocio?.whatsapp || "5493462368051";
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  // Combinar imágenes y video en una sola lista para el carrusel
  const galeria = [...(producto.imagenes || [])];
  if (producto.imagen_url && galeria.length === 0) {
    galeria.push(producto.imagen_url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col md:flex-row">
        
        {/* Botón de cierre */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* COLUMNA IZQUIERDA: Galería de Fotos Grandes y Video */}
        <div className="w-full md:w-1/2 bg-gray-100 flex items-center justify-center min-h-[300px] md:min-h-[450px]">
          <Swiper
            navigation
            pagination={{ clickable: true }}
            modules={[Navigation, Pagination]}
            className="w-full h-full max-h-[450px]"
          >
            {/* Fotos */}
            {galeria.map((img, idx) => (
              <SwiperSlide key={idx} className="flex items-center justify-center bg-gray-100">
                <img
                  src={img}
                  alt={`${producto.titulo} - Foto ${idx + 1}`}
                  className="w-full h-[350px] md:h-[450px] object-cover"
                />
              </SwiperSlide>
            ))}

            {/* Video (Si existe) */}
            {producto.video_url && (
              <SwiperSlide className="flex items-center justify-center bg-black">
                <video
                  src={producto.video_url}
                  controls
                  className="w-full h-[350px] md:h-[450px] object-contain"
                  poster={galeria[0]}
                />
              </SwiperSlide>
            )}
          </Swiper>
        </div>

        {/* COLUMNA DERECHA: Información y Variantes */}
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
              {producto.categoria}
            </span>

            <h2 className="text-2xl font-bold text-gray-800 mt-2">{producto.titulo}</h2>
            <p className="text-2xl font-extrabold text-emerald-600 my-2">
              ${producto.precio?.toLocaleString('es-AR')}
            </p>

            {producto.descripcion && (
              <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                {producto.descripcion}
              </p>
            )}

            {/* SECCIÓN DE VARIANTES (Talles, Colores, Materiales) */}
            {producto.variantes && producto.variantes.length > 0 && (
              <div className="space-y-4 my-4 border-t pt-4 border-gray-100">
                {producto.variantes.map((v, idx) => (
                  <div key={idx}>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                      {v.nombre}: <span className="text-emerald-600">{variantesSeleccionadas[v.nombre] || "Seleccionar"}</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {v.opciones?.map((opcion, oIdx) => {
                        const isSelected = variantesSeleccionadas[v.nombre] === opcion;
                        return (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectVariante(v.nombre, opcion)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-emerald-400'
                            }`}
                          >
                            {opcion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BOTÓN PEDIR POR WHATSAPP */}
          <button
            onClick={enviarWhatsApp}
            className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            Consultar / Pedir por WhatsApp
          </button>
        </div>

      </div>
    </div>
  );
}